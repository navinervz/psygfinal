// backend/src/config/environment.ts
import 'dotenv/config';

/**
 * Helpers
 */
const env = (k: string) => process.env[k];
const num = (k: string, d: number) => {
  const v = env(k);
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) ? n : d;
};
const bool = (k: string, d = false) => {
  const v = (env(k) || '').toLowerCase().trim();
  if (['true', '1', 'yes', 'y'].includes(v)) return true;
  if (['false', '0', 'no', 'n'].includes(v)) return false;
  return d;
};
const arr = (k: string, d: string[] = []) =>
  (env(k) || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean) || d;

export interface Config {
  app: {
    name: string;
    env: 'development' | 'test' | 'production';
    port: number;
    domain: string;
    baseUrl: string;
  };
  database: { url: string };
  jwt: {
    secret: string;
    refreshSecret: string;
    accessExpiresIn: string;
    refreshExpiresIn: string;
  };
  email: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    fromEmail: string;
    fromName: string;
  };
  zarinpal: {
    merchantId: string;
    sandbox: boolean;
    callbackUrl: string;
  };
  payment4: {
    apiKey: string;
    sandbox: boolean;
    callbackUrl: string;
  };
  crypto: {
    storeEthWallet: string;
    storeTonWallet: string;
  };
  nobitex: {
    apiUrl: string;
    updateInterval: number; // ms
    cacheTimeout: number;   // seconds
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
    authMaxRequests: number;
    paymentMaxRequests: number;
    adminMaxRequests: number;
    allowListIps: string[];
  };
  security: {
    bcryptRounds: number;
    cookieSecret: string;
  };
  cors: { origins: string[] };
  support: { telegram: string; email: string; instagram: string };
  admin: {
    twoFactorEnabled: boolean;
    twoFactorIssuer: string;
    defaultEmail: string;
    defaultPassword: string;
  };
  logging: { level: string; maxSize: string; maxFiles: string };
  upload: { maxFileSize: number; uploadPath: string };
  alerts: {
    telegramBotToken: string;
    telegramChatId: string;
    emailEnabled: boolean;
    emailRecipients: string[];
  };
  /** NEW: قیمت‌گذاری */
  pricing: {
    /** کفِ حداقلی دلار (تومان به ازای هر ۱ USDT) */
    usdFloorToman: number;
    /** نرخ جایگزین (fallback) در صورت قطعی منبع قیمت */
    fallbackUsdtToman: number;
  };
  monitoring: {
    maxResponseTime: number;
    minFreeDisk: number; // GB
    minFreeMemory: number; // %
    maxLogSize: number; // MB
    healthCheckInterval: number; // ms
    sslWarningDays: number;
    sslCriticalDays: number;
    dbSlowQueryThreshold: number; // ms
    apiTimeoutThreshold: number; // ms
    highErrorCountThreshold: number;
    largeLogFileThreshold: number; // MB
    diskCriticalThreshold: number; // %
    memoryCriticalThreshold: number; // %
    cpuWarningThreshold: number; // %
    cpuCriticalThreshold: number; // %
  };
}

/**
 * Strict required envs:
 * - در Production اجباری → اگر نباشند، process.exit(1)
 * - در Dev/Test فقط هشدار می‌دهیم تا کار متوقف نشود.
 */
const MUST_HAVE_ALWAYS = ['DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET'] as const;
const MUST_HAVE_PROD = ['ZARINPAL_MERCHANT_ID', 'PAYMENT4_API_KEY', 'STORE_ETH_WALLET', 'STORE_TON_WALLET'] as const;

const NODE_ENV = (env('NODE_ENV') as Config['app']['env']) || 'development';
const isProd = NODE_ENV === 'production';

function assertEnv() {
  const missingAlways = MUST_HAVE_ALWAYS.filter((k) => !env(k));
  const missingProd = MUST_HAVE_PROD.filter((k) => !env(k));

  if (missingAlways.length) {
    const msg = `Missing required environment variable(s): ${missingAlways.join(', ')}`;
    if (isProd) {
      console.error(msg);
      process.exit(1);
    } else {
      console.warn('[ENV WARN - dev/test]', msg);
    }
  }

  if (isProd && missingProd.length) {
    console.error(`Missing production-only env(s): ${missingProd.join(', ')}`);
    process.exit(1);
  } else if (!isProd && missingProd.length) {
    console.warn('[ENV WARN - dev/test] Missing optional env(s) for production:', missingProd.join(', '));
  }
}
assertEnv();

/**
 * Derive sensible defaults
 */
const APP_PORT = num('PORT', 3000);
const DOMAIN = env('DOMAIN') || 'psygstore.com';
const BASE_URL =
  env('BASE_URL') ||
  (isProd ? `https://${DOMAIN}` : `http://127.0.0.1:${APP_PORT}`);

const defaultCors = [BASE_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'];

/**
 * Final config
 */
export const config: Config = {
  app: {
    name: env('APP_NAME') || 'PSYGStore',
    env: NODE_ENV,
    port: APP_PORT,
    domain: DOMAIN,
    baseUrl: BASE_URL,
  },
  database: {
    url: env('DATABASE_URL') || '',
  },
  jwt: {
    secret: env('JWT_SECRET') || 'dev-secret',
    refreshSecret: env('JWT_REFRESH_SECRET') || 'dev-refresh-secret',
    accessExpiresIn: env('JWT_ACCESS_EXPIRES_IN') || '15m',
    refreshExpiresIn: env('JWT_REFRESH_EXPIRES_IN') || '7d',
  },
  email: {
    host: env('SMTP_HOST') || 'smtp.gmail.com',
    port: num('SMTP_PORT', 587),
    secure: bool('SMTP_SECURE', false),
    user: env('SMTP_USER') || '',
    pass: env('SMTP_PASS') || '',
    fromEmail: env('FROM_EMAIL') || 'noreply@psygstore.com',
    fromName: env('FROM_NAME') || 'PSYGStore',
  },
  zarinpal: {
    merchantId: env('ZARINPAL_MERCHANT_ID') || '',
    sandbox: bool('ZARINPAL_SANDBOX', false),
    callbackUrl: env('ZARINPAL_CALLBACK_URL') || `${BASE_URL}/api/payment/zarinpal/callback`,
  },
  payment4: {
    apiKey: env('PAYMENT4_API_KEY') || '',
    sandbox: bool('PAYMENT4_SANDBOX', false),
    callbackUrl: env('PAYMENT4_CALLBACK_URL') || `${BASE_URL}/api/payment/payment4/callback`,
  },
  crypto: {
    storeEthWallet: env('STORE_ETH_WALLET') || '',
    storeTonWallet: env('STORE_TON_WALLET') || '',
  },
  nobitex: {
    apiUrl: env('NOBITEX_API_URL') || 'https://api.nobitex.ir/market/stats',
    updateInterval: num('PRICE_UPDATE_INTERVAL', 300_000), // 5m
    cacheTimeout: num('PRICE_CACHE_TTL', 300), // 5m
  },
  rateLimit: {
    windowMs: num('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000), // 15m
    maxRequests: num('RATE_LIMIT_MAX_REQUESTS', 100),
    authMaxRequests: num('AUTH_RATE_LIMIT_MAX', 5),
    paymentMaxRequests: num('PAYMENT_RATE_LIMIT_MAX', 10),
    adminMaxRequests: num('ADMIN_RATE_LIMIT_MAX', 60),
    allowListIps: arr('RATE_LIMIT_ALLOWLIST_IPS'),
  },
  security: {
    bcryptRounds: num('BCRYPT_ROUNDS', 12),
    cookieSecret: env('COOKIE_SECRET') || 'default-cookie-secret',
  },
  cors: {
    origins: (env('CORS_ORIGINS') || defaultCors.join(','))
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  },
  support: {
    telegram: env('TELEGRAM_SUPPORT') || '@Psygsupport',
    email: env('SUPPORT_EMAIL') || 'support@psygstore.com',
    instagram: env('INSTAGRAM_USERNAME') || 'psygstore',
  },
  admin: {
    twoFactorEnabled: bool('ADMIN_2FA_ENABLED', false),
    twoFactorIssuer: env('ADMIN_2FA_ISSUER') || 'PSYGStore',
    defaultEmail: env('ADMIN_EMAIL') || 'admin@psygstore.com',
    defaultPassword: env('ADMIN_DEFAULT_PASSWORD') || 'change-this-password-immediately',
  },
  logging: {
    level: env('LOG_LEVEL') || 'info',
    maxSize: env('LOG_MAX_SIZE') || '20m',
    maxFiles: env('LOG_MAX_FILES') || '14d',
  },
  upload: {
    maxFileSize: num('MAX_FILE_SIZE', 10 * 1024 * 1024), // 10MB
    uploadPath: env('UPLOAD_PATH') || 'uploads/',
  },
  alerts: {
    telegramBotToken: env('TELEGRAM_BOT_TOKEN') || '',
    telegramChatId: env('TELEGRAM_CHAT_ID') || '',
    emailEnabled: bool('ALERT_EMAIL_ENABLED', false),
    emailRecipients: (env('ALERT_EMAIL_RECIPIENTS') || '')
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean),
  },
  /** NEW: قیمت‌گذاری */
  pricing: {
    usdFloorToman: num('USDT_FLOOR_TOMAN', 110_000),       // حداقل ۱۱۰هزار
    fallbackUsdtToman: num('FALLBACK_USDT_TOMAN', 115_000) // پیش‌فرض ۱۱۵هزار
  },
  monitoring: {
    maxResponseTime: num('MAX_RESPONSE_TIME', 5000),
    minFreeDisk: num('MIN_FREE_DISK', 10),
    minFreeMemory: num('MIN_FREE_MEMORY', 10),
    maxLogSize: num('MAX_LOG_SIZE', 500),
    healthCheckInterval: num('HEALTH_CHECK_INTERVAL', 300_000),
    sslWarningDays: num('SSL_WARNING_DAYS', 30),
    sslCriticalDays: num('SSL_CRITICAL_DAYS', 7),
    dbSlowQueryThreshold: num('DB_SLOW_QUERY_THRESHOLD', 3000),
    apiTimeoutThreshold: num('API_TIMEOUT_THRESHOLD', 10_000),
    highErrorCountThreshold: num('HIGH_ERROR_COUNT_THRESHOLD', 50),
    largeLogFileThreshold: num('LARGE_LOG_FILE_THRESHOLD', 100),
    diskCriticalThreshold: num('DISK_CRITICAL_THRESHOLD', 90),
    memoryCriticalThreshold: num('MEMORY_CRITICAL_THRESHOLD', 90),
    cpuWarningThreshold: num('CPU_WARNING_THRESHOLD', 80),
    cpuCriticalThreshold: num('CPU_CRITICAL_THRESHOLD', 90),
  },
};

/**
 * Dev-only pretty print (بدون لو دادن رازها)
 */
if (!isProd) {
  const mask = (s: string) => (s ? s.slice(0, 6) + '…' : '');
  const safeDbUrl = (config.database.url || '').replace(/:\/\/([^:]+):[^@]+@/, '://$1:***@');
  // eslint-disable-next-line no-console
  console.info('Configuration loaded (dev):', {
    app: config.app,
    database: { url: safeDbUrl },
    jwt: { secret: mask(config.jwt.secret), refresh: mask(config.jwt.refreshSecret) },
    zarinpal: { merchantId: mask(config.zarinpal.merchantId) },
    payment4: { apiKey: mask(config.payment4.apiKey) },
    cors: config.cors.origins,
    rateLimit: { ...config.rateLimit, allowListIps: config.rateLimit.allowListIps },
    pricing: config.pricing,
  });
}

export default config;
