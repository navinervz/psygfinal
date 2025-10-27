// backend/src/routes/orders.ts
import { Router } from 'express';
import { OrderController } from '@/controllers/OrderController';
import { authenticate } from '@/middleware/auth';
import { validate, schemas, sanitizeInputs } from '@/middleware/validation';
import { generalLimiter } from '@/middleware/rateLimiting';
import { asyncHandler } from '@/middleware/errorHandler';

const router = Router();
const ctrl = new OrderController();

// helper برای bind شدن this و هدایت خطاهای async به errorHandler
const wrap = (fn: (req: any, res: any, next: any) => Promise<any> | any) =>
  asyncHandler(fn.bind(ctrl));

/**
 * همهٔ مسیرهای سفارش نیاز به احراز هویت دارند.
 * همچنین sanitize ورودی‌ها را روی کل روت فعال می‌کنیم.
 */
router.use(authenticate);
router.use(sanitizeInputs);

/* ----------------------------- Orders ----------------------------- */
// لیست سفارش‌ها (GET) — بدون rate limit تا UX بد نشود
router.get('/', validate(schemas.pagination), wrap(ctrl.getOrders));

// دریافت جزئیات سفارش
router.get('/:id', validate(schemas.idParam), wrap(ctrl.getOrderById));

// ایجاد سفارش — عملیات تغییردهنده → rate limit
router.post('/', generalLimiter, validate(schemas.createOrder), wrap(ctrl.createOrder));

// لغو سفارش — عملیات تغییردهنده → rate limit
router.put('/:id/cancel', generalLimiter, validate(schemas.idParam), wrap(ctrl.cancelOrder));

export default router;
