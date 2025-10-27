// backend/src/routes/prices.ts
import { Router, Request, Response, NextFunction } from 'express';
import { PriceController } from '@/controllers/PriceController';
import { optionalAuth } from '@/middleware/auth';
import { validate, schemas, sanitizeInputs } from '@/middleware/validation';
import { generalLimiter } from '@/middleware/rateLimiting';
import { asyncHandler } from '@/middleware/errorHandler';

const router = Router();
const ctrl = new PriceController();

/** 
 * helper برای هدایت خطاهای async به errorHandler و حفظ this کنترلر 
 * حتماً bind(ctrl) می‌کنیم تا متدها به نمونه‌ی کنترلر متصل بمانند.
 */
const wrap = (fn: (...args: any[]) => any) => asyncHandler(fn.bind(ctrl));

/** کش سبک برای endpointهای read-only (قابل استفاده پشت CDN) */
const cache =
  (seconds: number) =>
  (_req: Request, res: Response, next: NextFunction) => {
    // public: اجازه‌ی کش سمت CDN/کلاینت
    res.set('Cache-Control', `public, max-age=${seconds}`);
    next();
  };

// ریت‌لیمیت عمومی + احراز هویت اختیاری + sanitize ورودی‌ها
router.use(generalLimiter);
router.use(optionalAuth);
router.use(sanitizeInputs);

/* ------------------------- قیمت‌های لحظه‌ای (ارزها) ------------------------- */
router.get('/current', cache(15), wrap(ctrl.getCurrentPrices));

/* ------- قیمت تومانی محصولات دلاری بر اساس نرخ USDT فعلی (Public) -------- */
router.get('/products', cache(60), wrap(ctrl.getProductPrices));

/* ---------------------------- تاریخچه قیمت ارز ---------------------------- */
router.get(
  '/history/:currency',
  validate(schemas.priceHistory),
  cache(300),
  wrap(ctrl.getPriceHistory)
);

/* ------------------------------ داده‌ی نمودار ------------------------------ */
router.get(
  '/chart/:currency',
  validate(schemas.priceChart),
  cache(300),
  wrap(ctrl.getPriceChart)
);

export default router;
