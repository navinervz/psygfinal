// backend/src/routes/users.ts
import { Router } from 'express';
import { UserController } from '@/controllers/UserController';
import { authenticate } from '@/middleware/auth';
import { validate, schemas, sanitizeInputs } from '@/middleware/validation';
import { generalLimiter } from '@/middleware/rateLimiting';
import { asyncHandler } from '@/middleware/errorHandler';

const router = Router();
const ctrl = new UserController();

// helper برای bind شدن this و هدایت خطاهای async به errorHandler
const wrap = (fn: (req: any, res: any, next: any) => Promise<any> | any) =>
  asyncHandler(fn.bind(ctrl));

/**
 * همهٔ روت‌های کاربر نیاز به احراز هویت دارند و ورودی‌ها sanitize می‌شوند.
 */
router.use(authenticate);
router.use(sanitizeInputs);

/* ----------------------------- Profile ----------------------------- */
// برای سازگاری، هر دو مسیر /profile و /me به یک متد وصل‌اند
router.get('/profile', wrap(ctrl.getProfile));
router.get('/me', wrap(ctrl.getProfile));

router.put('/profile', validate(schemas.updateProfile), wrap(ctrl.updateProfile));

// تغییر رمز عبور (عملیات تغییردهنده → rate limit مناسب)
router.post('/change-password', generalLimiter, validate(schemas.changePassword), wrap(ctrl.changePassword));

/* ------------------------------- 2FA (Admin) ------------------------------- */
// فعال‌سازی 2FA فقط برای ادمین‌هاست (چک داخل کنترلر انجام می‌شود)
router.post('/setup-2fa', generalLimiter, wrap(ctrl.setup2FA));
router.post('/verify-2fa', generalLimiter, validate(schemas.verify2FA), wrap(ctrl.verify2FA));
router.post('/disable-2fa', generalLimiter, validate(schemas.disable2FA), wrap(ctrl.disable2FA));

/* ----------------------- Deprecated wallet passthroughs ---------------------- */
// توصیه می‌شود از /api/wallet استفاده شود؛ این‌ها برای سازگاری نگه داشته شده‌اند
router.get('/wallet', wrap(ctrl.getWallet));
router.get('/wallet/transactions', validate(schemas.pagination), wrap(ctrl.getWalletTransactions));

export default router;
