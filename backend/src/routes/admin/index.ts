// backend/src/routes/admin/index.ts
import { Router } from 'express';
import { authenticate, requireAdmin } from '@/middleware/auth';
import { adminLimiter } from '@/middleware/rateLimiting';
import { validate, schemas, sanitizeInputs } from '@/middleware/validation';
import { asyncHandler } from '@/middleware/errorHandler';

import { AdminDashboardController } from '@/controllers/admin/AdminDashboardController';
import { AdminUserController } from '@/controllers/admin/AdminUserController';
import { AdminOrderController } from '@/controllers/admin/AdminOrderController';
import { AdminArticleController } from '@/controllers/admin/AdminArticleController';
import { AdminCouponController } from '@/controllers/admin/AdminCouponController';
import { AdminReportController } from '@/controllers/admin/AdminReportController';
import { AdminPriceController } from '@/controllers/admin/AdminPriceController';

import alertRoutes from './alerts';

const router = Router();

/* ------------------------- Middlewares (global) ------------------------- */
// ترتیب مهم است: rate limit → auth → admin → sanitize
router.use(adminLimiter);
router.use(authenticate);
router.use(requireAdmin);
router.use(sanitizeInputs);

/* ----------------------------- Controllers ----------------------------- */
const dashboardController = new AdminDashboardController();
const userController = new AdminUserController();
const orderController = new AdminOrderController();
const articleController = new AdminArticleController();
const couponController = new AdminCouponController();
const reportController = new AdminReportController();
const priceController = new AdminPriceController();

/* ------------------------------- Helper -------------------------------- */
// wrap برای حفظ this داخل متدهای کلاس و هدایت خطاهای async به errorHandler
const wrap = <T extends (...args: any[]) => any>(fn: T) => asyncHandler(fn.bind(null));

/* ------------------------------ Dashboard ------------------------------ */
router.get('/dashboard', wrap(dashboardController.getDashboard));
router.get('/dashboard/stats', wrap(dashboardController.getStats));

/* ------------------------------ Users (CRUD) --------------------------- */
router.get('/users', validate(schemas.pagination), wrap(userController.getUsers));
router.get('/users/:id', validate(schemas.idParam), wrap(userController.getUserById));
router.put('/users/:id', validate(schemas.idParam), wrap(userController.updateUser));
router.delete('/users/:id', validate(schemas.idParam), wrap(userController.deleteUser));
router.post(
  '/users/:id/wallet/adjust',
  validate(schemas.idParam),
  wrap(userController.adjustWallet)
);

/* ------------------------------ Orders (CRUD) -------------------------- */
router.get('/orders', validate(schemas.pagination), wrap(orderController.getOrders));
router.get('/orders/:id', validate(schemas.idParam), wrap(orderController.getOrderById));
router.put('/orders/:id', validate(schemas.idParam), wrap(orderController.updateOrder));
router.delete('/orders/:id', validate(schemas.idParam), wrap(orderController.deleteOrder));
router.post('/orders/:id/refund', validate(schemas.idParam), wrap(orderController.refundOrder));

/* ----------------------------- Articles (CRUD) ------------------------- */
router.get('/articles', validate(schemas.pagination), wrap(articleController.getArticles));
router.get('/articles/:id', validate(schemas.idParam), wrap(articleController.getArticleById));
router.post('/articles', wrap(articleController.createArticle));
router.put('/articles/:id', validate(schemas.idParam), wrap(articleController.updateArticle));
router.delete('/articles/:id', validate(schemas.idParam), wrap(articleController.deleteArticle));
router.post('/articles/:id/publish', validate(schemas.idParam), wrap(articleController.publishArticle));
router.post('/articles/:id/unpublish', validate(schemas.idParam), wrap(articleController.unpublishArticle));

/* ------------------------------ Coupons (CRUD) ------------------------- */
router.get('/coupons', validate(schemas.pagination), wrap(couponController.getCoupons));
router.get('/coupons/:id', validate(schemas.idParam), wrap(couponController.getCouponById));
router.post('/coupons', wrap(couponController.createCoupon));
router.put('/coupons/:id', validate(schemas.idParam), wrap(couponController.updateCoupon));
router.delete('/coupons/:id', validate(schemas.idParam), wrap(couponController.deleteCoupon));
router.get('/coupons/:id/usage', validate(schemas.idParam), wrap(couponController.getCouponUsage));

/* -------------------------------- Reports ------------------------------ */
// اگر بعداً اسکیما برای فیلتر تاریخ/نوع گزارش اضافه شد، اینجا validate اضافه می‌کنیم.
router.get('/reports/sales', wrap(reportController.getSalesReport));
router.get('/reports/revenue', wrap(reportController.getRevenueReport));
router.get('/reports/users', wrap(reportController.getUsersReport));
router.get('/reports/products', wrap(reportController.getProductsReport));
router.get('/reports/payments', wrap(reportController.getPaymentsReport));
router.get('/reports/export/:type', wrap(reportController.exportReport));

/* -------------------------------- Prices ------------------------------- */
router.get('/prices', wrap(priceController.getCurrentPrices));
router.post('/prices/update', wrap(priceController.updatePrices));
router.get('/prices/history/:currency', validate(schemas.priceHistory), wrap(priceController.getPriceHistory));
router.get('/prices/service/status', wrap(priceController.getServiceStatus));
router.post('/prices/service/restart', wrap(priceController.restartService));

/* -------------------------------- System ------------------------------- */
router.get('/system/health', wrap(dashboardController.getSystemHealth));
router.get('/system/logs', wrap(dashboardController.getSystemLogs));
router.post('/system/cleanup', wrap(dashboardController.cleanupSystem));

/* -------------------------------- Alerts ------------------------------- */
router.use('/alerts', alertRoutes);

export default router;
