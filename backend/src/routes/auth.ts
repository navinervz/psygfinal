// backend/src/routes/auth.ts
import { Router } from 'express';
import { AuthController } from '@/controllers/AuthController';
import { validate, schemas, sanitizeInputs } from '@/middleware/validation';
import { authLimiter } from '@/middleware/rateLimiting';
import { authenticate } from '@/middleware/auth';
import { asyncHandler } from '@/middleware/errorHandler';

const router = Router();
const ctrl = new AuthController();

/**
 * Helper: تضمینِ bind شدن this روی متدهای کلاس + هندلِ خطاهای async
 */
const wrap = (fn: (req: any, res: any, next: any) => Promise<any> | any) =>
  asyncHandler(fn.bind(ctrl));

/* -------------------- Public Routes -------------------- */
/**
 * POST /api/auth/register
 * ثبت‌نام کاربر جدید
 */
router.post(
  '/register',
  authLimiter,
  sanitizeInputs,
  validate(schemas.register),
  wrap(ctrl.register)
);

/**
 * POST /api/auth/login
 * لاگین با ایمیل/پسورد (در صورت نیاز 2FA)
 */
router.post(
  '/login',
  authLimiter,
  sanitizeInputs,
  validate(schemas.login),
  wrap(ctrl.login)
);

/**
 * POST /api/auth/web3-login
 * لاگین با آدرس کیف‌پول (ETH/Ton)
 */
router.post(
  '/web3-login',
  authLimiter,
  sanitizeInputs,
  validate(schemas.web3Login),
  wrap(ctrl.web3Login)
);

/**
 * POST /api/auth/refresh
 * دریافت اکسس‌توکن جدید با رفرش‌توکن (کوکی httpOnly)
 * (در صورت تمایل می‌توان authLimiter را برای این مسیر حذف کرد)
 */
router.post('/refresh', authLimiter, wrap(ctrl.refreshToken));

/**
 * POST /api/auth/logout
 * لاگ‌اوت (پاک‌کردن کوکی رفرش)
 */
router.post('/logout', wrap(ctrl.logout));

/* -------------------- Protected Routes (JWT لازم) -------------------- */
/**
 * GET /api/auth/profile
 * پروفایل کاربر جاری
 */
router.get('/profile', authenticate, wrap(ctrl.getProfile));

/**
 * PUT /api/auth/profile
 * آپدیت پروفایل کاربر (fullName/email)
 * اگر اسکیما دارید، validate(schemas.updateProfile) را فعال کنید.
 */
router.put(
  '/profile',
  authenticate,
  sanitizeInputs,
  // validate(schemas.updateProfile),
  wrap(ctrl.updateProfile)
);

/**
 * POST /api/auth/change-password
 * تغییر پسورد (فقط اکانت‌های Email)
 * اگر اسکیما دارید، validate(schemas.changePassword) را فعال کنید.
 */
router.post(
  '/change-password',
  authenticate,
  sanitizeInputs,
  // validate(schemas.changePassword),
  wrap(ctrl.changePassword)
);

/* -------------------- Admin 2FA (Protected) -------------------- */
/**
 * POST /api/auth/2fa/setup
 * شروع راه‌اندازی 2FA برای ادمین
 */
router.post('/2fa/setup', authenticate, wrap(ctrl.setup2FA));

/**
 * POST /api/auth/2fa/verify
 * فعال‌سازی 2FA
 */
router.post('/2fa/verify', authenticate, wrap(ctrl.verify2FA));

/**
 * POST /api/auth/2fa/disable
 * غیرفعال‌کردن 2FA
 */
router.post('/2fa/disable', authenticate, wrap(ctrl.disable2FA));

export default router;
