// backend/src/middleware/validation.ts
import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { AppError } from '@/utils/AppError';

/**
 * گزینه‌های پیش‌فرض برای تمام اعتبارسنجی‌ها:
 * - abortEarly: false  → همه خطاها با هم گزارش می‌شوند
 * - convert: true     → تایپ‌ها طبق اسکیما اتومات تبدیل می‌شوند (مثلاً string "10" → number 10)
 * - stripUnknown: true→ کلیدهای اضافه حذف می‌شوند (سخت‌گیرانه و امن‌تر)
 */
const defaultJoiOptions: Joi.ValidationOptions = {
  abortEarly: false,
  convert: true,
  stripUnknown: true,
  allowUnknown: false,
  errors: { label: 'key' },
};

/**
 * میان‌افزار اعتبارسنجی (Body/Query/Params)
 * - مقدارِ validate‌شده جایگزین req.body/req.query/req.params می‌شود (نرمال‌سازی ورودی‌ها)
 * - در صورت خطا، AppError با جزئیات ساخت‌یافته پرتاب می‌کند
 */
export const validate = (schema: {
  body?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
  params?: Joi.ObjectSchema;
}) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const errors: Array<{ where: 'body' | 'query' | 'params'; messages: string[] }> = [];

    // Body
    if (schema.body) {
      const { error, value } = schema.body.prefs(defaultJoiOptions).validate(req.body);
      if (error) {
        errors.push({
          where: 'body',
          messages: error.details.map((d) => d.message),
        });
      } else {
        req.body = value;
      }
    }

    // Query
    if (schema.query) {
      const { error, value } = schema.query.prefs(defaultJoiOptions).validate(req.query);
      if (error) {
        errors.push({
          where: 'query',
          messages: error.details.map((d) => d.message),
        });
      } else {
        req.query = value as any;
      }
    }

    // Params
    if (schema.params) {
      const { error, value } = schema.params.prefs(defaultJoiOptions).validate(req.params);
      if (error) {
        errors.push({
          where: 'params',
          messages: error.details.map((d) => d.message),
        });
      } else {
        req.params = value;
      }
    }

    if (errors.length > 0) {
      return next(
        new AppError('Validation failed', 400, true, {
          errors,
        })
      );
    }

    return next();
  };
};

/* ----------------------------- Common Schemas ----------------------------- */

const emailField = Joi.string().email().trim().lowercase();
const optionalEmail = emailField.optional();
const nameField = Joi.string().trim().min(2).max(100);
const passwordField = Joi.string().min(8).max(128);

// Ethereum (0x + 40 hex) یا TON (UQ + 46 base64url)
const walletAddressField = Joi.string().pattern(/^0x[a-fA-F0-9]{40}$|^UQ[a-zA-Z0-9_-]{46}$/);

export const schemas = {
  // Auth schemas
  register: {
    body: Joi.object({
      email: emailField.required(),
      fullName: nameField.required(),
      password: passwordField.required(),
    }),
  },

  login: {
    body: Joi.object({
      email: emailField.required(),
      password: Joi.string().required(),
      twoFactorCode: Joi.string().length(6).pattern(/^\d+$/).optional(),
    }),
  },

  web3Login: {
    body: Joi.object({
      walletAddress: walletAddressField.required(),
      signature: Joi.string().optional(),
    }),
  },

  // Order schemas
  createOrder: {
    body: Joi.object({
      productId: Joi.string()
        .valid('telegram-premium', 'spotify', 'chatgpt')
        .required(),
      optionName: Joi.string().trim().required(),
      quantity: Joi.number().integer().min(1).max(100).required(),
      totalPrice: Joi.number().integer().min(1000).required(),
      telegramId: Joi.string().optional(),
      notes: Joi.string().max(1000).optional(),
      couponCode: Joi.string().optional(),
    }),
  },

  // Payment schemas
  createPayment: {
    body: Joi.object({
      amount: Joi.number().integer().min(1000).max(50_000_000).required(),
      description: Joi.string().max(255).required(),
      orderId: Joi.string().optional(),
    }),
  },

  createCryptoPayment: {
    body: Joi.object({
      amount: Joi.number().positive().required(),
      currency: Joi.string().valid('USDT', 'BTC', 'ETH', 'TON').required(),
      description: Joi.string().max(255).required(),
      orderId: Joi.string().optional(),
    }),
  },

  // Wallet schemas
  walletTopup: {
    body: Joi.object({
      amount: Joi.number().integer().min(1000).max(50_000_000).required(),
      method: Joi.string().valid('rial', 'crypto').required(),
    }),
  },

  walletTransfer: {
    body: Joi.object({
      toUserId: Joi.string().required(),
      amount: Joi.number().integer().min(1000).max(50_000_000).required(),
      description: Joi.string().max(255).optional(),
    }),
  },

  // Coupon schemas
  validateCoupon: {
    body: Joi.object({
      code: Joi.string().required(),
      orderAmount: Joi.number().integer().min(1000).required(),
    }),
  },

  createCoupon: {
    body: Joi.object({
      code: Joi.string().trim().min(3).max(50).required(),
      type: Joi.string().valid('PERCENTAGE', 'FIXED').required(),
      value: Joi.number().positive().required(),
      minAmount: Joi.number().integer().min(0).optional(),
      maxDiscount: Joi.number().integer().positive().optional(),
      usageLimit: Joi.number().integer().positive().optional(),
      validUntil: Joi.date().greater('now').optional(),
    }),
  },

  // Article schemas
  createArticle: {
    body: Joi.object({
      title: Joi.string().trim().min(5).max(500).required(),
      slug: Joi.string().trim().min(3).max(255).optional(),
      excerpt: Joi.string().max(1000).optional(),
      content: Joi.string().min(100).required(),
      imageUrl: Joi.string().uri().optional(),
      category: Joi.string().max(100).optional(),
      readTime: Joi.number().integer().min(1).max(120).optional(),
      keywords: Joi.array().items(Joi.string()).optional(),
      metaDescription: Joi.string().max(160).optional(),
      isPublished: Joi.boolean().optional(),
    }),
  },

  updateArticle: {
    body: Joi.object({
      title: Joi.string().trim().min(5).max(500).optional(),
      slug: Joi.string().trim().min(3).max(255).optional(),
      excerpt: Joi.string().max(1000).optional(),
      content: Joi.string().min(100).optional(),
      imageUrl: Joi.string().uri().optional(),
      category: Joi.string().max(100).optional(),
      readTime: Joi.number().integer().min(1).max(120).optional(),
      keywords: Joi.array().items(Joi.string()).optional(),
      metaDescription: Joi.string().max(160).optional(),
      isPublished: Joi.boolean().optional(),
    }),
  },

  // Health check schemas
  healthCheck: {
    query: Joi.object({
      detailed: Joi.boolean().default(false),
    }),
  },

  // Price history / chart
  priceHistory: {
    params: Joi.object({
      currency: Joi.string().valid('USDT', 'BTC', 'ETH', 'TON').required(),
    }),
    query: Joi.object({
      days: Joi.number().integer().min(1).max(365).default(7),
      interval: Joi.string().valid('hour', 'day', 'week').default('hour'),
    }),
  },

  priceChart: {
    params: Joi.object({
      currency: Joi.string().valid('USDT', 'BTC', 'ETH', 'TON').required(),
    }),
    query: Joi.object({
      period: Joi.string().valid('1h', '24h', '7d', '30d', '90d').default('24h'),
    }),
  },

  // Article list (public)
  getArticles: {
    query: Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20),
      search: Joi.string().max(255).optional(),
      category: Joi.string().max(100).optional(),
      sortBy: Joi.string().valid('publishedAt', 'title', 'readTime').default('publishedAt'),
      sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
    }),
  },

  slugParam: {
    params: Joi.object({
      slug: Joi.string().required(),
    }),
  },

  categoryParam: {
    params: Joi.object({
      category: Joi.string().required(),
    }),
  },

  // User profile schemas
  updateProfile: {
    body: Joi.object({
      fullName: nameField.optional(),
      email: optionalEmail,
    }),
  },

  changePassword: {
    body: Joi.object({
      currentPassword: Joi.string().required(),
      newPassword: passwordField.required(),
    }),
  },

  verify2FA: {
    body: Joi.object({
      token: Joi.string().length(6).pattern(/^\d+$/).required(),
    }),
  },

  disable2FA: {
    body: Joi.object({
      token: Joi.string().length(6).pattern(/^\d+$/).required(),
      password: Joi.string().required(),
    }),
  },

  // Common
  pagination: {
    query: Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20),
      search: Joi.string().max(255).optional(),
      sortBy: Joi.string().optional(),
      sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
    }),
  },

  idParam: {
    params: Joi.object({
      id: Joi.string().required(),
    }),
  },
} as const;

/* ----------------------------- Sanitization ----------------------------- */

/**
 * پاک‌سازی ورودی‌ها به شکل عمیق:
 * - حذف `<` و `>` برای کاهش ریسک XSS ساده
 * - trim رشته‌ها
 * - برش طول رشته‌ها (حداکثر 10000 کاراکتر)
 * - جلوگیری از Prototype Pollution با نادیده‌گرفتن کلیدهای خطرناک
 */
export const sanitizeInput = (input: any): any => {
  if (typeof input === 'string') {
    return input.replace(/[<>]/g, '').trim().substring(0, 10000);
  }

  if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  }

  if (input && typeof input === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }

  return input;
};

/**
 * Middleware to sanitize all inputs before validation
 */
export const sanitizeInputs = (req: Request, _res: Response, next: NextFunction): void => {
  req.body = sanitizeInput(req.body);
  req.query = sanitizeInput(req.query);
  req.params = sanitizeInput(req.params);
  next();
};
