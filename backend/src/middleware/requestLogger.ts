// backend/src/middleware/requestLogger.ts
import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { logger } from '@/utils/logger';
import { config } from '@/config/environment';

/**
 * Request logging middleware:
 * - Correlation ID (X-Request-Id) → generate if missing
 * - High precision timing via hrtime.bigint()
 * - Adds X-Response-Time header
 * - Skips noisy paths (health/docs/static)
 * - Redacts sensitive headers
 * - Logs aborted connections (client disconnect)
 * - Marks slow requests (> monitoring.maxResponseTime) as warn
 */

const SKIP_PATHS = [
  /^\/healthz?$/i,
  /^\/api\/health$/i,
  /^\/api-docs(?:\/.*)?$/i,
  /^\/favicon\.ico$/i,
  /^\/robots\.txt$/i,
  /^\/assets\/.*/i,
  /^\/static\/.*/i,
];

const REDACT_HEADERS = new Set(['authorization', 'cookie', 'set-cookie']);

function shouldSkipLogging(req: Request) {
  if (req.method === 'OPTIONS' || req.method === 'HEAD') return true;
  return SKIP_PATHS.some((rx) => rx.test(req.originalUrl));
}

function redactHeaders(headers: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(headers || {})) {
    out[k] = REDACT_HEADERS.has(k.toLowerCase()) ? '***' : v;
  }
  return out;
}

function parseContentLength(val: number | string | string[] | undefined): number {
  if (typeof val === 'number') return val;
  if (Array.isArray(val)) return parseInt(val[0] || '0', 10) || 0;
  if (typeof val === 'string') return parseInt(val, 10) || 0;
  return 0;
}

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const skip = shouldSkipLogging(req);

  // Correlation ID
  const reqId =
    (req.headers['x-request-id'] as string) ||
    (req.headers['request-id'] as string) ||
    crypto.randomUUID();

  (req as any).id = reqId; // usable in other layers
  res.setHeader('X-Request-Id', reqId);

  const start = process.hrtime.bigint();

  if (!skip) {
    logger.http('Incoming request', {
      id: reqId,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      httpVersion: `HTTP/${req.httpVersion}`,
      ua: req.get('User-Agent'),
      referer: req.get('Referer'),
      forwardedFor: req.get('x-forwarded-for'),
      // headers without sensitive ones
      headers: redactHeaders(req.headers as Record<string, unknown>),
      reqBytes: parseContentLength(req.headers['content-length']),
    });
  }

  const finalize = (aborted: boolean) => {
    if (skip) return;

    const diffMs = Number(process.hrtime.bigint() - start) / 1e6;
    const durationMs = Math.round(diffMs);
    res.setHeader('X-Response-Time', `${durationMs}ms`);

    const resBytes = parseContentLength(res.getHeader('content-length'));
    const payload = {
      id: reqId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
      bytes: resBytes,
      ip: req.ip,
      aborted,
      route: (req as any).route?.path || undefined,
      baseUrl: (req as any).baseUrl || undefined,
    };

    // Slow request?
    if (durationMs > config.monitoring.maxResponseTime) {
      logger.warn('Slow request detected', payload);
      return;
    }

    // 5xx → error, else http
    if (res.statusCode >= 500) {
      logger.error('Request completed (server error)', payload);
    } else {
      logger.http('Request completed', payload);
    }
  };

  res.once('finish', () => finalize(false));
  // If client disconnects before finish
  res.once('close', () => {
    // Node emits 'close' also after 'finish' in some cases; guard with headersSent+statusCode
    if (!res.writableEnded) finalize(true);
  });

  next();
};
