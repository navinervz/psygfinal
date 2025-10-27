// backend/src/routes/admin/alerts.ts
import { Router } from 'express';
import { AlertController } from '@/controllers/AlertController';
import { validate } from '@/middleware/validation';
import { adminLimiter } from '@/middleware/rateLimiting';
import { asyncHandler } from '@/middleware/errorHandler';
import { sanitizeInputs } from '@/middleware/validation';
import Joi from 'joi';

const router = Router();
const ctrl = new AlertController();

/* ---------------------------- Local Schemas ---------------------------- */
const alertSchemas = {
  sendAlert: {
    body: Joi.object({
      severity: Joi.string().valid('CRITICAL', 'WARNING', 'INFO').required(),
      title: Joi.string().min(3).max(100).required(),
      message: Joi.string().min(10).max(1000).required(),
      metadata: Joi.object().unknown(true).optional(),
    }),
  },
  updateConfig: {
    body: Joi.object({
      telegramToken: Joi.string().allow('').optional(),
      telegramChatId: Joi.string().allow('').optional(),
      emailEnabled: Joi.boolean().optional(),
      emailRecipients: Joi.array().items(Joi.string().email()).optional(),
      thresholds: Joi.object({
        maxResponseTime: Joi.number().positive().optional(),
        minFreeDisk: Joi.number().min(1).max(99).optional(),
        minFreeMemory: Joi.number().min(1).max(99).optional(),
        maxLogSize: Joi.number().positive().optional(),
        sslWarningDays: Joi.number().positive().optional(),
      }).optional(),
    }),
  },
};

/* ------------------------------ Middleware ---------------------------- */
// ترتیب: rate-limit → sanitize (auth/admin در index.ts اعمال می‌شود)
router.use(adminLimiter);
router.use(sanitizeInputs);

// helper برای اتصال this و هندل خطاهای async
const wrap = (fn: any) => asyncHandler(fn.bind(ctrl));

/* -------------------------------- Routes ------------------------------ */
/**
 * @swagger
 * /api/admin/alerts/test:
 *   post:
 *     tags: [Admin - Alerts]
 *     summary: Test alert system
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Alert test completed
 */
router.post('/test', wrap(ctrl.testAlerts));

/**
 * @swagger
 * /api/admin/alerts:
 *   post:
 *     tags: [Admin - Alerts]
 *     summary: Send manual alert
 *     security:
 *       - bearerAuth: []
 */
router.post('/', validate(alertSchemas.sendAlert), wrap(ctrl.sendAlert));

/**
 * @swagger
 * /api/admin/alerts/config:
 *   get:
 *     tags: [Admin - Alerts]
 *     summary: Get alert configuration
 *     security:
 *       - bearerAuth: []
 */
router.get('/config', wrap(ctrl.getAlertConfig));

/**
 * @swagger
 * /api/admin/alerts/config:
 *   put:
 *     tags: [Admin - Alerts]
 *     summary: Update alert configuration
 *     security:
 *       - bearerAuth: []
 */
router.put('/config', validate(alertSchemas.updateConfig), wrap(ctrl.updateAlertConfig));

export default router;
