// backend/src/utils/logger.ts
import fs from 'fs';
import path from 'path';
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { config } from '@/config/environment';
import { prisma } from '@/config/database';

// --- ensure logs directory exists
const LOG_DIR = process.env.LOG_DIR || 'logs';
fs.mkdirSync(LOG_DIR, { recursive: true });

// --- custom levels & colors
const levels = { error: 0, warn: 1, info: 2, http: 3, debug: 4 } as const;
const colors = { error: 'red', warn: 'yellow', info: 'green', http: 'magenta', debug: 'white' } as const;
winston.addColors(colors as any);

const isProd = config.app.env === 'production';

// --- helpers: formats
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const rest = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level}: ${message}${rest}`;
  })
);

const fileJsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// فقط این level را نگه‌دار (برای دسترسی)
const onlyLevel = (target: keyof typeof levels) =>
  winston.format((info) => (info.level === target ? info : false))();

// این level را حذف کن (برای حذف http از combined)
const excludeLevel = (target: keyof typeof levels) =>
  winston.format((info) => (info.level === target ? false : info))();

// --- transports
const consoleTransport = new winston.transports.Console({
  level: isProd ? 'info' : 'debug',
  handleExceptions: true,
  format: consoleFormat,
});

// access.log فقط برای http
const accessRotate = new DailyRotateFile({
  filename: path.join(LOG_DIR, 'access-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  level: 'http',
  maxSize: config.logging.maxSize,
  maxFiles: config.logging.maxFiles,
  zippedArchive: true,
  format: winston.format.combine(onlyLevel('http'), fileJsonFormat),
});

// error.log
const errorRotate = new DailyRotateFile({
  filename: path.join(LOG_DIR, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  level: 'error',
  handleExceptions: true,
  maxSize: config.logging.maxSize,
  maxFiles: config.logging.maxFiles,
  zippedArchive: true,
  format: fileJsonFormat,
});

// combined.log (بدون http)
const combinedRotate = new DailyRotateFile({
  filename: path.join(LOG_DIR, 'combined-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  level: config.logging.level,
  maxSize: config.logging.maxSize,
  maxFiles: config.logging.maxFiles,
  zippedArchive: true,
  format: winston.format.combine(excludeLevel('http'), fileJsonFormat),
});

// --- main logger
export const logger = winston.createLogger({
  level: config.logging.level,
  levels,
  transports: [consoleTransport, errorRotate, combinedRotate, accessRotate],
  exitOnError: false,
  defaultMeta: { service: 'psygstore-backend', env: config.app.env },
});

// --- specialized loggers
const makeRotator = (name: string, level: keyof typeof levels = 'info') =>
  new DailyRotateFile({
    filename: path.join(LOG_DIR, `${name}-%DATE%.log`),
    datePattern: 'YYYY-MM-DD',
    level,
    maxSize: config.logging.maxSize,
    maxFiles: config.logging.maxFiles,
    zippedArchive: true,
    format: fileJsonFormat,
  });

export const adminLogger = winston.createLogger({
  level: 'info',
  transports: [
    ...(isProd ? [] : [new winston.transports.Console({ level: 'info', format: consoleFormat })]),
    makeRotator('admin', 'info'),
  ],
  defaultMeta: { category: 'admin', service: 'psygstore-backend' },
});

export const paymentLogger = winston.createLogger({
  level: 'info',
  transports: [
    ...(isProd ? [] : [new winston.transports.Console({ level: 'info', format: consoleFormat })]),
    makeRotator('payments', 'info'),
  ],
  defaultMeta: { category: 'payments', service: 'psygstore-backend' },
});

export const securityLogger = winston.createLogger({
  level: 'warn',
  transports: [
    ...(isProd ? [] : [new winston.transports.Console({ level: 'warn', format: consoleFormat })]),
    makeRotator('security', 'warn'),
  ],
  defaultMeta: { category: 'security', service: 'psygstore-backend' },
});

// --- helpers
export const logAdminAction = (adminId: string, action: string, details: any) => {
  adminLogger.info('Admin Action', {
    adminId,
    action,
    details,
    timestamp: new Date().toISOString(),
    ip: details?.ip || 'unknown',
  });

  // Fire-and-forget: ذخیره در DB اگر جدول/مدل موجود باشد
  (async () => {
    try {
      await prisma.adminLog.create({
        data: {
          adminId,
          action,
          ip: details?.ip || null,
          details,
        },
      });
    } catch {
      // اگر مدل/جدول موجود نباشد یا هر خطایی، بی‌صدا رد می‌کنیم
    }
  })();
};

export const logPaymentEvent = (event: string, details: any) => {
  paymentLogger.info('Payment Event', {
    event,
    details,
    timestamp: new Date().toISOString(),
  });
};

export const logSecurityEvent = (event: string, details: any) => {
  securityLogger.warn('Security Event', {
    event,
    details,
    timestamp: new Date().toISOString(),
    ip: details?.ip || 'unknown',
  });
};

// استریم برای morgan (HTTP access logs → level: http)
export const loggerStream = {
  write: (message: string) => {
    // message معمولاً انتهاش \n داره
    logger.http(message.trim());
  },
};

// Optional: child logger with default module tag
export const childLogger = (module: string) => logger.child({ module });
