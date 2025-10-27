// backend/src/routes/wallet.ts
import { Router } from 'express';
import { WalletController } from '@/controllers/WalletController';
import { authenticate } from '@/middleware/auth';
import { validate, schemas, sanitizeInputs } from '@/middleware/validation';
import { paymentLimiter } from '@/middleware/rateLimiting';
import { asyncHandler } from '@/middleware/errorHandler';

const router = Router();
const ctrl = new WalletController();

// helper برای bind شدن this و هدایت خطاها به errorHandler
const wrap = (fn: (req: any, res: any, next: any) => Promise<any> | any) =>
  asyncHandler(fn.bind(ctrl));

/**
 * همهٔ مسیرهای کیف‌پول نیاز به احراز هویت دارند.
 * همچنین sanitize ورودی‌ها را روی کل روت فعال می‌کنیم.
 */
router.use(authenticate);
router.use(sanitizeInputs);

/* ----------------------------- Wallet ----------------------------- */
// دریافت اطلاعات کیف‌پول
router.get('/', wrap(ctrl.getWallet));

// افزایش موجودی (درخواست ریالی/کریپتو) — عملیات تغییردهنده → rate limit
router.post('/topup', paymentLimiter, validate(schemas.walletTopup), wrap(ctrl.topupWallet));

// لیست تراکنش‌های کیف‌پول با صفحه‌بندی
router.get('/transactions', validate(schemas.pagination), wrap(ctrl.getTransactions));

// انتقال بین کاربری — عملیات تغییردهنده → rate limit
router.post('/transfer', paymentLimiter, validate(schemas.walletTransfer), wrap(ctrl.transferFunds));

export default router;
