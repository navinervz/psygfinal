// backend/src/middleware/rateLimiting.ts
import rateLimit from 'express-rate-limit';
import { Request } from 'express';
import { config } from '@/config/environment';
import { securityLogger } from '@/utils/logger';

/**
 * مسیرهایی که لاگ و ریت‌لیمیت عمومی را شلوغ می‌کنند را رد کن
 * (هم‌راستا با requestLogger)
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

const ALLOWLIST_IPS: string[] =
  (config as any)?.rateLimit?.allowListIps?.filter(Boolean) || [];

// اگر IP تو allowlist بود، از لیمیت ردش کن
const isAllowListed = (req: Request) => {
  const ip = req.ip || '';
  return ALLOWLIST_IPS.includes(ip);
};

const shouldSkip = (req: Request) =>
  req.method === 'OPTIONS' ||
  req.method === 'HEAD' ||
  SKIP_PATHS.some((rx) => rx.test(req.originalUrl));

/**
 * با توجه به app.set('trust proxy', 1) از IP واقعی کلاینت استفاده می‌شود.
 * (express-rate-limit از req.ip استفاده می‌کند که با trust proxy سازگار است)
 */
const keyByIp = (req: Request) => req.ip || 'unknown';

/**
 * برای مسیرهای حساس (auth/payment/admin) اگر کاربر لاگین بود، بر اساس یوزر لیمیت کن
 * در غیر اینصورت بر اساس IP
 */
const keyByUserOrIp = (req: Request) => {
  const userId = (req as any)?.user?.id as string | undefined;
  return userId ? `u:${userId}` : keyByIp(req);
};

const retrySec = (ms: number) => Math.ceil(ms / 1000);

function onLimitReached(req: Request, statusMsg: string) {
  const requestId = (req.headers['x-request-id'] as string) || (req as any)?.id;
  securityLogger.warn(statusMsg, {
    id: requestId,
    ip: req.ip,
    ua: req.get('User-Agent'),
    path: req.originalUrl,
    method: req.method,
  });
}

/* -------------------- General limiter -------------------- */
export const generalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByIp,
  skip: (req) => shouldSkip(req) || isAllowListed(req),
  handler: (req, res) => {
    onLimitReached(req, 'Rate limit exceeded');
    const seconds = retrySec(config.rateLimit.windowMs);
    res.setHeader('Retry-After', String(seconds));
    res.status(429).json({
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: seconds,
    });
  },
});

/* -------------------- Auth limiter (strict) -------------------- */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15m
  max: config.rateLimit.authMaxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUserOrIp,
  skip: (req) => isAllowListed(req),
  // موفقیت‌ها را از شمارش خارج می‌کند تا کاربر به‌خاطر چند تلاش موفق محدود نشود
  skipSuccessfulRequests: true,
  handler: (req, res) => {
    onLimitReached(req, 'Auth rate limit exceeded');
    const seconds = 15 * 60;
    res.setHeader('Retry-After', String(seconds));
    res.status(429).json({
      error: 'Too many authentication attempts, please try again later.',
      retryAfter: seconds,
    });
  },
});

/* -------------------- Payment limiter -------------------- */
export const paymentLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5m
  max: config.rateLimit.paymentMaxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUserOrIp,
  skip: (req) => isAllowListed(req),
  handler: (req, res) => {
    onLimitReached(req, 'Payment rate limit exceeded');
    const seconds = 5 * 60;
    res.setHeader('Retry-After', String(seconds));
    res.status(429).json({
      error: 'Too many payment requests, please try again later.',
      retryAfter: seconds,
    });
  },
});

/* -------------------- Admin limiter -------------------- */
export const adminLimiter = rateLimit({
  windowMs: 60 * 1000, // 1m
  max: (config as any)?.rateLimit?.adminMaxRequests ?? 60, // قابل‌پیکربندی
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUserOrIp,
  skip: (req) => isAllowListed(req),
  handler: (req, res) => {
    onLimitReached(req, 'Admin rate limit exceeded');
    const seconds = 60;
    res.setHeader('Retry-After', String(seconds));
    res.status(429).json({
      error: 'Too many admin requests, please slow down.',
      retryAfter: seconds,
    });
  },
});

/* -------------------- Factory for custom limiters -------------------- */
export const createRateLimiter = (options: {
  windowMs: number;
  max: number;
  message: string;
  perUser?: boolean; // اگر true باشد keyGenerator بر اساس یوزر خواهد بود
  skipSuccessfulRequests?: boolean;
}) =>
  rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: options.perUser ? keyByUserOrIp : keyByIp,
    skipSuccessfulRequests: !!options.skipSuccessfulRequests,
    skip: (req) => isAllowListed(req),
    handler: (req, res) => {
      onLimitReached(req, 'Custom rate limit exceeded');
      const seconds = retrySec(options.windowMs);
      res.setHeader('Retry-After', String(seconds));
      res.status(429).json({
        error: options.message,
        retryAfter: seconds,
      });
    },
  });
