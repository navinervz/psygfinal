// backend/src/server.ts
import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';

import { config } from '@/config/environment';
import { logger } from '@/utils/logger';
import { errorHandler, notFoundHandler } from '@/middleware/errorHandler';
import { requestLogger } from '@/middleware/requestLogger';
import { securityHeaders } from '@/middleware/securityHeaders';
import { prisma, connectDatabase, disconnectDatabase } from '@/config/database';

// Services
import { PriceUpdateService } from '@/services/PriceUpdateService';
import { PriceCronService } from '@/services/PriceCronService';

// --- BigInt -> string برای خروجی JSON
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

const app = express();

// تبدیل BigInt در تمام پاسخ‌های JSON
app.set('json replacer', (_key, value) => (typeof value === 'bigint' ? value.toString() : value));

// پشت پروکسی (برای نرخ‌دهی و IP واقعی)
app.set('trust proxy', 1);

// امنیت پایه
app.disable('x-powered-by');
app.use(securityHeaders);
app.use(
  helmet({
    // برخی گزینه‌ها در نسخه‌های جدید خودکار هستند؛ CSP را دستی غیرفعال می‌کنیم تا Swagger و فرانت محلی راحت باشند
    contentSecurityPolicy: false,
  })
);

// CORS
app.use(
  cors({
    origin: config.cors.origins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  })
);

// Parsers
app.use(
  express.json({
    limit: '10mb',
    verify: (req, _res, buf) => {
      (req as any).rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser(config.security.cookieSecret));

// فشرده‌سازی
app.use(compression());

// لاگ ریکوئست‌ها
app.use(requestLogger);

// --- Health endpoints سبک (برای Docker و LB)
app.get('/', (_req, res) => {
  res.status(200).json({ status: 'ok', time: new Date().toISOString() });
});

app.get('/healthz', (_req, res) => {
  res.status(200).json({ status: 'ok', time: new Date().toISOString() });
});

// --- Swagger
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'PSYGStore API',
      version: '1.0.0',
      description: 'API documentation for PSYGStore backend',
    },
    servers: [
      { url: config.app.baseUrl, description: 'App base URL' },
      { url: 'http://127.0.0.1:3000', description: 'Local dev' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: {
        ErrorResponse: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Internal server error' },
            statusCode: { type: 'integer', example: 500 },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
      },
      responses: {
        UnauthorizedError: {
          description: 'Unauthorized',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
        },
        ValidationError: {
          description: 'Validation error',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
        },
        RateLimitError: {
          description: 'Too many requests',
          headers: { 'Retry-After': { schema: { type: 'integer', example: 60 } } },
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
        },
      },
    },
  },
  apis: ['./src/routes/**/*.ts', './src/controllers/**/*.ts'],
};
const specs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// --- Routes
import authRoutes from '@/routes/auth';
import userRoutes from '@/routes/users';
import orderRoutes from '@/routes/orders';
import articleRoutes from '@/routes/articles';
import paymentRoutes from '@/routes/payments';
import walletRoutes from '@/routes/wallet';
import couponRoutes from '@/routes/coupons';
import priceRoutes from '@/routes/prices';
import subscriptionRoutes from '@/routes/subscriptions';
import adminRoutes from '@/routes/admin';

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/articles', articleRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/prices', priceRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/admin', adminRoutes);

// --- Health پیشرفته با چک دیتابیس و سرویس‌ها
const priceUpdateService = new PriceUpdateService();
const priceCronService = new PriceCronService();

app.get(['/health', '/api/health'], async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.app.env,
      version: process.env.npm_package_version || '1.0.0',
      database: 'connected',
      priceService: priceUpdateService?.getStatus?.() ?? 'unknown',
      cronService: priceCronService?.getStatus?.() ?? 'unknown',
    });
  } catch (error) {
    logger.error('Health check failed:', error as any);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Database connection failed',
    });
  }
});

// 404
app.use(notFoundHandler);

// Errors (باید آخر از همه بیاد)
app.use(errorHandler);

// Graceful shutdown
async function shutdown(signal: 'SIGTERM' | 'SIGINT') {
  logger.info(`${signal} received, shutting down gracefully`);
  try {
    priceUpdateService.stop?.();
    priceCronService.stop?.();
    await disconnectDatabase();
  } finally {
    process.exit(0);
  }
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => {
  logger.error('UnhandledRejection:', reason as any);
});
process.on('uncaughtException', (err) => {
  logger.error('UncaughtException:', err);
  process.exit(1);
});

// Start
const PORT = config.app.port;

async function start() {
  // ابتدا دیتابیس
  await connectDatabase();

  // سپس سرویس‌ها
  priceUpdateService.start?.();
  logger.info(`💰 Price update service started`);

  priceCronService.start?.();
  logger.info(`⏰ Price cron service started`);

  // بعد سرور
  app.listen(PORT, () => {
    logger.info(`🚀 PSYGStore Backend started on port ${PORT}`);
    logger.info(`📊 Environment: ${config.app.env}`);
    logger.info(`📚 API Documentation: ${config.app.baseUrl}/api-docs`);
  });
}

start().catch((err) => {
  logger.error('Server start failed:', err);
  process.exit(1);
});

export default app;
