// backend/src/config/database.ts
import { PrismaClient, Prisma } from '@prisma/client';
import config from '@/config/environment';
import { logger } from '@/utils/logger';

/**
 * Singleton برای جلوگیری از ایجاد چندین PrismaClient
 * (به‌خصوص در dev با nodemon/hot-reload)
 */
const g = globalThis as unknown as { prisma?: PrismaClient };

// تنظیمات لاگ‌ها
const isProd = config.app.env === 'production';
const enableQueryLogging =
  !isProd || (process.env.PRISMA_LOG_QUERIES || '').toLowerCase() === 'true';

// Prisma client واحد
export const prisma: PrismaClient =
  g.prisma ??
  new PrismaClient({
    datasources: { db: { url: config.database.url } },
    log: [
      ...(enableQueryLogging ? ([{ emit: 'event', level: 'query' }] as const) : []),
      { emit: 'event', level: 'error' },
      { emit: 'event', level: 'warn' },
      ...(!isProd ? ([{ emit: 'event', level: 'info' }] as const) : []),
    ],
  });

if (!g.prisma) g.prisma = prisma;

/**
 * جلوگیری از دوبار ثبت لیسنر/میان‌افزار در hot-reload
 */
const anyPrisma = prisma as any;

if (!anyPrisma.__listenersAdded__) {
  // لاگ Queryها (Dev یا با PRISMA_LOG_QUERIES=true)
  if (enableQueryLogging) {
    prisma.$on('query', (e) => {
      // پارامترها ممکن است شامل رازها باشند—پیش‌نمایش محدود
      const paramsPreview =
        e.params?.length > 512 ? `${e.params.slice(0, 512)}…` : e.params;
      logger.debug('DB Query', {
        query: e.query,
        params: paramsPreview,
        durationMs: e.duration,
      });
    });
  }

  prisma.$on('error', (e) => {
    logger.error('DB Error', { target: (e as any).target, message: (e as any).message || e });
  });

  prisma.$on('warn', (e) => {
    logger.warn('DB Warn', { target: (e as any).target, message: (e as any).message || e });
  });

  if (!isProd) {
    prisma.$on('info', (e) => {
      logger.info('DB Info', { target: (e as any).target, message: (e as any).message || e });
    });
  }

  anyPrisma.__listenersAdded__ = true;
}

if (!anyPrisma.__middlewareAdded__) {
  // میان‌افزار برای تشخیص Query کند
  prisma.$use(async (params, next) => {
    const started = Date.now();
    const result = await next(params);
    const took = Date.now() - started;
    if (took > config.monitoring.dbSlowQueryThreshold) {
      logger.warn('DB Slow Query', {
        model: params.model,
        action: params.action,
        durationMs: took,
      });
    }
    return result;
  });

  anyPrisma.__middlewareAdded__ = true;
}

/**
 * اتصال/قطع اتصال/سلامت
 */
export const connectDatabase = async (): Promise<void> => {
  try {
    await prisma.$connect();
    // تست سبک اتصال
    await prisma.$queryRaw`SELECT 1`;
    logger.info('✅ Database connected & ping ok');
  } catch (error) {
    logger.error('❌ Database connection failed', { error });
    if (isProd) process.exit(1);
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  try {
    await prisma.$disconnect();
    logger.info('🛑 Database disconnected');
  } catch (error) {
    logger.error('❌ Database disconnection failed', { error });
  }
};

export const pingDatabase = async (): Promise<boolean> => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
};

/**
 * Helper: اجرای کد داخل تراکنش
 */
export const withTransaction = async <T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> => {
  return prisma.$transaction(async (tx) => fn(tx));
};
