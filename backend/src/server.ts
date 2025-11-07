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

// Ensure BigInt -> string in JSON
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

const app = express();

// JSON replacer for BigInt
app.set('json replacer', (_key, value) =>
  typeof value === 'bigint' ? value.toString() : value
);

// trust proxy
app.set('trust proxy', 1);

// Security
app.disable('x-powered-by');
app.use(securityHeaders);
app.use(helmet({ contentSecurityPolicy: false }));

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

// Compression
app.use(compression());

// Request logs
app.use(requestLogger);

// ───────────── Health ─────────────
// لایو: بدون وابستگی به DB → برای پاس‌شدن Healthcheck
app.get('/', (_req, res) =>
  res.status(200).json({ status: 'ok', time: new Date().toISOString() })
);
app.get('/health', (_req, res) => res.status(200).send('ok'));
app.get('/healthz', (_req, res) => res.status(200).json({ status: 'ok' }));

// Readiness: وضعیت واقعی با چک DB و سرویس‌ها
let servicesReady = false;
app.get(['/ready', '/api/health'], async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: servicesReady ? 'ready' : 'starting',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.app.env,
      version: process.env.npm_package_version || '1.0.0',
    });
  } catch (error) {
    logger.error('Readiness check failed:', error as any);
    res.status(503).json({ status: 'unhealthy', error: 'DB not ready' });
  }
});

// Swagger
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'PSYGStore API',
      version: process.env.npm_package_version || '1.0.0',
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
    },
  },
  apis: ['./src/routes/**/*.ts', './src/controllers/**/*.ts'],
};
const specs = swaggerJsdoc(swaggerOptions as any);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// Routes
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

// 404
app.use(notFoundHandler);

// Errors
app.use(errorHandler);

// Graceful shutdown
async function shutdown(signal: 'SIGTERM' | 'SIGINT') {
  logger.info(`${signal} received, shutting down gracefully`);
  try {
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

// ───────────── Start ─────────────
// اول لیسن. سپس اتصال DB و سرویس‌ها به‌صورت پس‌زمینه.
const PORT = Number(process.env.PORT) || Number(config.app.port) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  logger.info(`🚀 PSYGStore Backend listening on http://${HOST}:${PORT}`);
  logger.info(`📊 Environment: ${config.app.env}`);
  logger.info(`📚 API Documentation: ${config.app.baseUrl}/api-docs`);
});

(async () => {
  try {
    await connectDatabase();
    const priceUpdateService = new PriceUpdateService();
    const priceCronService = new PriceCronService();
    priceUpdateService.start();
    priceCronService.start();
    servicesReady = true;
    logger.info('✅ DB connected and services started');
  } catch (err) {
    logger.error('❌ Background init failed:', err);
  }
})();

export default app;
