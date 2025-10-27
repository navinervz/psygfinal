// backend/src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import jwt, { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { prisma } from '@/config/database';
import { config } from '@/config/environment';
import { logger, securityLogger } from '@/utils/logger';
import { AppError } from '@/utils/AppError';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    fullName: string;
    isAdmin: boolean;
    authType: string;
    twoFactorEnabled?: boolean;
    emailVerified?: boolean;
  };
}

interface JWTPayload {
  userId: string;
  email?: string;
  isAdmin: boolean;
  type: 'access' | 'refresh';
  iat: number;
  exp: number;
}

const ADMIN_REQUIRE_2FA = process.env.ADMIN_REQUIRE_2FA === 'true';
const JWT_CLOCK_TOLERANCE_SEC = Number(process.env.JWT_CLOCK_TOLERANCE ?? 0);

/* ------------------------------ Helpers -------------------------------- */

function extractToken(req: Request): string | null {
  // Authorization: Bearer <token>
  const header = (req.headers.authorization || (req.headers as any).Authorization) as string | undefined;
  if (typeof header === 'string') {
    const parts = header.trim().split(/\s+/);
    if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
      return parts[1];
    }
  }
  // Alternate headers (if ever used)
  const headerToken = (req.headers['x-access-token'] as string) || (req.headers['access-token'] as string);
  if (headerToken) return headerToken;
  // Cookie (if you choose to place access token in cookie)
  const cookieToken = (req as any)?.cookies?.access_token;
  if (cookieToken) return cookieToken;

  return null;
}

function verifyAccessToken(token: string): JWTPayload {
  const decoded = jwt.verify(token, config.jwt.secret, {
    clockTolerance: JWT_CLOCK_TOLERANCE_SEC,
  }) as JWTPayload;
  if (decoded.type !== 'access') {
    throw new AppError('Invalid token type', 401);
  }
  return decoded;
}

async function attachUserToRequest(req: AuthenticatedRequest, payload: JWTPayload): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      email: true,
      fullName: true,
      isAdmin: true,
      authType: true,
      isActive: true,
      emailVerified: true,
      twoFactorEnabled: true,
    },
  });

  if (!user) {
    securityLogger.warn('Token used for non-existent user', {
      userId: payload.userId,
      ip: req.ip,
      ua: req.get('User-Agent'),
      path: req.originalUrl,
    });
    throw new AppError('User not found', 401);
  }

  if (!user.isActive) {
    securityLogger.warn('Token used for inactive user', {
      userId: user.id,
      ip: req.ip,
      ua: req.get('User-Agent'),
      path: req.originalUrl,
    });
    throw new AppError('Account is deactivated', 401);
  }

  req.user = {
    id: user.id,
    email: user.email || undefined,
    fullName: user.fullName,
    isAdmin: user.isAdmin,
    authType: user.authType,
    twoFactorEnabled: user.twoFactorEnabled ?? false,
    emailVerified: user.emailVerified ?? false,
  };
}

/* ----------------------------- Middlewares ------------------------------ */

/**
 * Require a valid Access JWT; attaches req.user
 */
export const authenticate = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractToken(req);
    if (!token) throw new AppError('Authorization token required', 401);

    const payload = verifyAccessToken(token);
    await attachUserToRequest(req, payload);

    return next();
  } catch (error: any) {
    if (error instanceof TokenExpiredError) {
      return next(new AppError('Token expired', 401));
    }
    if (error instanceof JsonWebTokenError) {
      securityLogger.warn('Invalid JWT token', {
        reason: error.message,
        ip: req.ip,
        ua: req.get('User-Agent'),
        path: req.originalUrl,
      });
      return next(new AppError('Invalid token', 401));
    }
    return next(error);
  }
};

/**
 * Allow request without token; if valid token exists, attaches req.user
 */
export const optionalAuth = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractToken(req);
    if (!token) return next();

    const payload = verifyAccessToken(token);
    await attachUserToRequest(req, payload);

    return next();
  } catch (error) {
    // Silent by design for public endpoints; optionally log at debug level
    logger.debug?.('optionalAuth: token ignored', {
      path: req.originalUrl,
      ip: req.ip,
    });
    return next();
  }
};

/**
 * Require admin role (after authenticate)
 */
export const requireAdmin = (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void => {
  if (!req.user) return next(new AppError('Authentication required', 401));
  if (!req.user.isAdmin) {
    securityLogger.warn('Non-admin user attempted admin access', {
      userId: req.user.id,
      email: req.user.email,
      ip: req.ip,
      ua: req.get('User-Agent'),
      path: req.originalUrl,
    });
    return next(new AppError('Admin privileges required', 403));
  }

  // Optional enforcement: require 2FA for admin accounts
  if (ADMIN_REQUIRE_2FA && !req.user.twoFactorEnabled) {
    securityLogger.warn('Admin access blocked due to missing 2FA', {
      userId: req.user.id,
      ip: req.ip,
      path: req.originalUrl,
    });
    return next(new AppError('Admin 2FA is required', 403));
  }

  return next();
};

/* ------------------------------ Token utils ----------------------------- */

export const generateAccessToken = (user: { id: string; email?: string; isAdmin: boolean }): string => {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      isAdmin: user.isAdmin,
      type: 'access',
    },
    config.jwt.secret as jwt.Secret,
    { expiresIn: config.jwt.accessExpiresIn as string }
  );
};

export const generateRefreshToken = (user: { id: string; email?: string }): string => {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      type: 'refresh',
    },
    config.jwt.refreshSecret as jwt.Secret,
    { expiresIn: config.jwt.refreshExpiresIn as string }
  );
};

export const verifyRefreshToken = (token: string): JWTPayload => {
  const decoded = jwt.verify(token, config.jwt.refreshSecret, {
    clockTolerance: JWT_CLOCK_TOLERANCE_SEC,
  }) as JWTPayload;
  if (decoded.type !== 'refresh') {
    throw new AppError('Invalid token type', 401);
  }
  return decoded;
};

export default authenticate;
