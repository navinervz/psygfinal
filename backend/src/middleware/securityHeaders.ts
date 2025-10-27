// backend/src/middleware/securityHeaders.ts
import type { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { config } from '@/config/environment';

/**
 * Security headers using Helmet (v7)
 * - فقط از آپشن‌های معتبر Helmet v7 استفاده شده
 * - CSP سازگار با Swagger UI و فرانت (inline style/script)
 * - HSTS فقط در production
 * - Permissions-Policy سفارشی (غیرفعال‌کردن FLoC/Topics)
 */
const isProd = config.app.env === 'production';

// مبدأهای مجاز برای connect/img/fonts با توجه به دامنه‌های فرانت
const CORS_ORIGINS = Array.from(
  new Set<string>([
    ...config.cors.origins,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ])
);

const helmetCore = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      // Swagger UI و بعضی لایبرری‌ها به inline نیاز دارند
      styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https:'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      connectSrc: ["'self'", 'https:', 'wss:', ...CORS_ORIGINS],
      fontSrc: ["'self'", 'data:', 'https:'],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", 'https:'],
      frameSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      // فقط در تولید، درخواست‌های http را به https ارتقا بده
      ...(isProd ? { upgradeInsecureRequests: [] } : {}),
    },
  },

  // بعضی ابزارها (مثل Swagger UI) با COEP مشکل دارند
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  // برای بارگذاری ریسورس‌ها از ساب‌دامین‌ها/دامنه‌های مجاز
  crossOriginResourcePolicy: { policy: 'cross-origin' },

  dnsPrefetchControl: { allow: false },

  // جلوگیری از کلیک‌جکینگ
  frameguard: { action: 'deny' },

  // فقط در تولید HSTS بگذار
  hsts: isProd
    ? { maxAge: 31536000, includeSubDomains: true, preload: true }
    : false,

  // nosniff و originAgentCluster به‌صورت پیش‌فرض فعال‌اند
  originAgentCluster: true,

  // Referrer Policy پیشنهاد‌شده
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
});

/**
 * Permissions-Policy (جایگزین Feature-Policy)
 * بر اساس نیاز قابل تغییر است.
 */
function setPermissionsPolicy(_req: Request, res: Response, next: NextFunction) {
  res.setHeader(
    'Permissions-Policy',
    [
      'camera=()',
      'microphone=()',
      'geolocation=()',
      'payment=()',
      'fullscreen=(self)',
      'interest-cohort=()',
      'browsing-topics=()',
    ].join(', ')
  );
  next();
}

/**
 * اکسپورت یک میدل‌ور که پشت‌سرهم helmet و هدر سفارشی را ست می‌کند
 */
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  helmetCore(req, res, (err?: unknown) => {
    if (err) return next(err);
    setPermissionsPolicy(req, res, next);
  });
};
