// backend/src/middleware/errorHandler.ts
import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import type { AxiosError } from 'axios';
import { logger, securityLogger } from '@/utils/logger';
import { AppError } from '@/utils/AppError';
import { config } from '@/config/environment';

type AnyObject = Record<string, any>;

const isDev = config.app.env === 'development';
const isTest = config.app.env === 'test';
const MAX_UPLOAD_BYTES = Number(config.upload?.maxFileSize ?? 10 * 1024 * 1024);

/* --------------------------------- Prisma -------------------------------- */

function mapPrismaError(err: Prisma.PrismaClientKnownRequestError) {
  // https://www.prisma.io/docs/reference/api-reference/error-reference
  switch (err.code) {
    case 'P2002':
      return { statusCode: 409, message: 'Duplicate entry. This record already exists.' };
    case 'P2025':
      return { statusCode: 404, message: 'Record not found.' };
    case 'P2003':
      return { statusCode: 400, message: 'Foreign key constraint failed.' };
    case 'P2000':
      return { statusCode: 400, message: 'Invalid value for a database field.' };
    case 'P2014':
      return { statusCode: 400, message: 'Invalid nested write operation.' };
    default:
      return { statusCode: 400, message: 'Database operation failed.' };
  }
}

/* ---------------------------------- Axios --------------------------------- */

function isAxiosError(e: any): e is AxiosError {
  return !!e && !!(e as AxiosError).isAxiosError;
}

function mapAxiosError(err: AxiosError) {
  // 5xx سمت سرویس بالادستی → 502، تایم‌اوت/شبکه → 504
  if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
    return { statusCode: 504, message: 'Upstream timeout.' };
  }
  const http = err.response?.status ?? 0;
  if (http >= 500) return { statusCode: 502, message: 'Upstream service error.' };
  if (http === 429) return { statusCode: 429, message: 'Upstream rate limit exceeded.' };
  if (http >= 400) return { statusCode: 502, message: 'Upstream request failed.' };
  // خطای شبکه/نامشخص
  return { statusCode: 503, message: 'Upstream service unavailable.' };
}

/* ----------------------------- Global Handler ----------------------------- */

export const errorHandler = (error: any, req: Request, res: Response, _next: NextFunction): void => {
  let statusCode = 500;
  let message = 'Internal server error';
  let details: AnyObject | undefined;

  const requestId =
    (req.headers['x-request-id'] as string) ||
    (req as AnyObject).id ||
    (req as AnyObject).requestId;

  // AppError
  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
    details = error.details;
  }
  // Prisma
  else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const mapped = mapPrismaError(error);
    statusCode = mapped.statusCode;
    message = mapped.message;
  } else if (error instanceof Prisma.PrismaClientValidationError) {
    statusCode = 400;
    message = 'Invalid data provided.';
  } else if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    statusCode = 500;
    message = 'Database error occurred.';
  }
  // Axios / upstream
  else if (isAxiosError(error)) {
    const mapped = mapAxiosError(error);
    statusCode = mapped.statusCode;
    message = mapped.message;
    if (isDev || isTest) {
      details = {
        ...(details || {}),
        upstream: {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
          code: error.code,
        },
      };
    }
  }
  // Body parser JSON error
  else if (error instanceof SyntaxError && 'body' in error) {
    statusCode = 400;
    message = 'Invalid JSON payload.';
  }
  // Auth/JWT
  else if (error?.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token.';
  } else if (error?.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired.';
  } else if (error?.name === 'NotBeforeError') {
    statusCode = 401;
    message = 'Token not active yet.';
  }
  // Validation libraries (fallback – معمولاً ما AppError می‌فرستیم)
  else if (error?.name === 'ValidationError' && Array.isArray((error as AnyObject).details)) {
    statusCode = 400;
    message = 'Validation error.';
    details = (error as AnyObject).details.map((d: any) => ({
      message: d.message,
      path: d.path,
      type: d.type,
    }));
  } else if (Array.isArray(error?.errors)) {
    statusCode = 400;
    message = 'Validation error.';
    details = error.errors.map((e: any) => ({ msg: e.msg, param: e.param, location: e.location }));
  }

  // Multer (file upload)
  if (error?.code === 'LIMIT_FILE_SIZE') {
    statusCode = 413;
    message = 'Uploaded file too large.';
    details = { maxBytes: MAX_UPLOAD_BYTES };
  } else if (error?.code === 'LIMIT_FILE_COUNT') {
    statusCode = 413;
    message = 'Too many files uploaded.';
  } else if (error?.code === 'LIMIT_UNEXPECTED_FILE') {
    statusCode = 400;
    message = 'Unexpected file field.';
  }

  // Fallback overrides
  if (error?.statusCode && Number.isInteger(error.statusCode)) {
    statusCode = error.statusCode;
  }
  if (error?.message && message === 'Internal server error') {
    message = error.message;
  }

  // Logging
  logger.error('Error occurred', {
    error: error?.message || String(error),
    stack: error?.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    ua: req.get('User-Agent'),
    statusCode,
    requestId,
  });

  if ([401, 403, 429].includes(statusCode)) {
    securityLogger.warn('Security event', {
      reason: message,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      ua: req.get('User-Agent'),
      requestId,
    });
  }

  // Response body
  const errorResponse: AnyObject = {
    error: message,
    statusCode,
    timestamp: new Date().toISOString(),
  };
  if (requestId) {
    errorResponse.requestId = requestId;
    // مفیده که requestId را به هدر هم بفرستیم
    res.setHeader('X-Request-Id', String(requestId));
  }

  if (isDev || isTest) {
    if (details) errorResponse.details = details;
    if (error?.stack) errorResponse.stack = error.stack;
    if (error?.code && !errorResponse.details) errorResponse.details = { code: error.code };
  }

  // هدرهای خاص
  if (statusCode === 429) {
    const retryAfter =
      (error?.retryAfter && Number(error.retryAfter)) ||
      Number(config.rateLimit?.retryAfterSeconds ?? 60);
    if (Number.isFinite(retryAfter) && retryAfter > 0) {
      res.setHeader('Retry-After', String(retryAfter));
    }
  }

  if (res.headersSent) return;
  res.status(statusCode).json(errorResponse);
};

/* --------------------------------- 404 ---------------------------------- */

export const notFoundHandler = (req: Request, _res: Response, next: NextFunction): void => {
  next(new AppError(`Route ${req.originalUrl} not found`, 404));
};

/* --------------------------- Async wrapper (typed) -------------------------- */

export const asyncHandler = <T extends (...args: any[]) => Promise<any>>(fn: T) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
