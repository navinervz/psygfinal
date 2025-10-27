// backend/src/routes/coupons.ts
import { Router } from 'express';
import { CouponController } from '@/controllers/CouponController';
import { authenticate } from '@/middleware/auth';
import { validate, schemas, sanitizeInputs } from '@/middleware/validation';
import { generalLimiter } from '@/middleware/rateLimiting';
import { asyncHandler } from '@/middleware/errorHandler';

const router = Router();
const ctrl = new CouponController();

// helper برای هدایت خطاهای async به errorHandler و حفظ this کنترلر
const wrap = (fn: any) => asyncHandler(fn.bind(ctrl));

// احراز هویت + ریت‌لیمیت + پاکسازی ورودی‌ها
router.use(authenticate);
router.use(generalLimiter);
router.use(sanitizeInputs);

/**
 * POST /api/coupons/validate
 * بدنه: { code: string, orderAmount: number }
 * خروجی: { isValid, discountAmount, finalAmount, ... }
 */
router.post('/validate', validate(schemas.validateCoupon), wrap(ctrl.validateCoupon));

export default router;
