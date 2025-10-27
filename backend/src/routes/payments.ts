// backend/src/routes/payments.ts
import { Router } from 'express';
import Joi from 'joi';
import { PaymentController } from '@/controllers/PaymentController';
import { authenticate, optionalAuth } from '@/middleware/auth';
import { validate, schemas, sanitizeInputs } from '@/middleware/validation';
import { paymentLimiter } from '@/middleware/rateLimiting';
import { asyncHandler } from '@/middleware/errorHandler';

const router = Router();
const ctrl = new PaymentController();

// helper برای bind شدن this و هندل خطاهای async
const wrap = (fn: (req: any, res: any, next: any) => Promise<any> | any) =>
  asyncHandler(fn.bind(ctrl));

/* -------------------------------- ZarinPal ------------------------------- */
// ساخت درخواست پرداخت (محافظت‌شده + ریت‌لیمیت)
router.post(
  '/zarinpal/request',
  authenticate,
  paymentLimiter,
  sanitizeInputs,
  validate(schemas.createPayment),
  wrap(ctrl.createZarinpalPayment)
);

// تایید پرداخت (پس از ریدایرکت؛ auth اختیاری + ریت‌لیمیت)
router.get(
  '/zarinpal/verify',
  optionalAuth,
  paymentLimiter,
  sanitizeInputs,
  wrap(ctrl.verifyZarinpalPayment)
);

// کال‌بک سرور-به-سرور از زرین‌پال (بدون ریت‌لیمیت/احراز هویت)
// ⚠️ مطمئن شو ZARINPAL_CALLBACK_URL روی `${BASE_URL}/api/payments/zarinpal/callback` ست شده.
router.post('/zarinpal/callback', wrap(ctrl.zarinpalCallback));

/* --------------------------------- Crypto -------------------------------- */
// ارزهای پشتیبانی‌شده
router.get('/crypto/currencies', optionalAuth, wrap(ctrl.getSupportedCurrencies));

// ساخت درخواست پرداخت کریپتو (محافظت‌شده + ریت‌لیمیت)
router.post(
  '/crypto/request',
  authenticate,
  paymentLimiter,
  sanitizeInputs,
  validate(schemas.createCryptoPayment),
  wrap(ctrl.createCryptoPayment)
);

// تایید پرداخت کریپتو (محافظت‌شده + ریت‌لیمیت)
// اسکیما اختصاصی برای paymentId (عدم استفاده از schemas.idParam که :id می‌خواهد)
const paymentIdParam = {
  params: Joi.object({
    paymentId: Joi.string().required(),
  }),
};

router.get(
  '/crypto/verify/:paymentId',
  authenticate,
  paymentLimiter,
  sanitizeInputs,
  validate(paymentIdParam),
  wrap(ctrl.verifyCryptoPayment)
);

// کال‌بک سرور-به-سرور از درگاه رمز‌ارز (بدون ریت‌لیمیت/احراز هویت)
// ⚠️ مطمئن شو PAYMENT4_CALLBACK_URL روی `${BASE_URL}/api/payments/crypto/callback` یا `${BASE_URL}/api/payments/payment4/callback` ست شده.
router.post('/crypto/callback', wrap(ctrl.cryptoCallback));
// آدرس معادل برای سازگاری با نام‌گذاری
router.post('/payment4/callback', wrap(ctrl.cryptoCallback));

/* ------------------------------- Prices (Public) ------------------------------ */
router.get('/prices/current', optionalAuth, wrap(ctrl.getCurrentPrices));
router.get(
  '/prices/history/:currency',
  sanitizeInputs,
  validate(schemas.priceHistory),
  wrap(ctrl.getPriceHistory)
);

export default router;
