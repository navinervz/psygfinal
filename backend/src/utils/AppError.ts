// backend/src/utils/AppError.ts

/**
 * Base application error with HTTP semantics and safe extras.
 */
export class AppError extends Error {
  // name دیگر readonly نیست تا بتوانیم در کلاس پایه آن را تنظیم کنیم
  public name: string;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: unknown;
  public readonly code?: string;   // optional machine-readable code (e.g. VALIDATION_ERROR)
  public readonly cause?: unknown; // optional original error

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    details?: unknown,
    code?: string,
    cause?: unknown
  ) {
    super(message);

    // Fix prototype chain for TS -> JS transpilation so `instanceof` works
    Object.setPrototypeOf(this, new.target.prototype);

    // به صورت خودکار نام کلاس را روی name می‌گذاریم
    this.name = new.target.name || 'AppError';

    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;
    this.code = code;
    this.cause = cause;

    // Keep proper stack trace (Node)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /** Convert to a plain object (never exposes stack by default). */
  toObject(includeStack = false) {
    const base: Record<string, unknown> = {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      isOperational: this.isOperational,
      code: this.code,
      details: this.details,
    };
    if (includeStack && this.stack) base.stack = this.stack;
    return base;
  }

  /** Type guard */
  static isAppError(err: unknown): err is AppError {
    return err instanceof AppError;
  }

  /** Normalize unknown errors to AppError */
  static fromUnknown(err: unknown, fallbackMessage = 'Internal server error'): AppError {
    if (AppError.isAppError(err)) return err;
    if (err instanceof Error) {
      return new AppError(err.message || fallbackMessage, 500, false, undefined, 'INTERNAL_ERROR', err);
    }
    return new AppError(fallbackMessage, 500, false, { original: err }, 'INTERNAL_ERROR');
  }
}

/** 400 – Bad Request (validation, format, etc.) */
export class ValidationError extends AppError {
  constructor(message: string = 'Validation failed', details?: unknown, code = 'VALIDATION_ERROR') {
    super(message, 400, true, details, code);
    // this.name را دیگر دستکاری نمی‌کنیم؛ خود کلاس پایه آن را برابر ValidationError می‌گذارد
  }
}

/** 401 – Authentication required or invalid credentials */
export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required', code = 'AUTH_REQUIRED') {
    super(message, 401, true, undefined, code);
  }
}

/** 403 – User authenticated but lacks permissions */
export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions', code = 'FORBIDDEN') {
    super(message, 403, true, undefined, code);
  }
}

/** 404 – Resource not found */
export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found', details?: unknown, code = 'NOT_FOUND') {
    super(message, 404, true, details, code);
  }
}

/** 409 – Conflict (duplicate, state conflict, etc.) */
export class ConflictError extends AppError {
  constructor(message: string = 'Resource already exists', details?: unknown, code = 'CONFLICT') {
    super(message, 409, true, details, code);
  }
}

/** 400/402 – Payment / checkout errors (kept 400 here to avoid exposing billing specifics) */
export class PaymentError extends AppError {
  constructor(message: string = 'Payment error', details?: unknown, code = 'PAYMENT_ERROR', statusCode = 400) {
    super(message, statusCode, true, details, code);
  }
}

/** 502 – Upstream API/service failure */
export class ExternalServiceError extends AppError {
  constructor(service: string, message: string, details?: unknown, code = 'UPSTREAM_ERROR') {
    super(`${service} service error: ${message}`, 502, true, details, code);
  }
}
