// backend/src/controllers/UserController.ts
import { Response } from 'express';
import bcrypt from 'bcryptjs';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { prisma } from '@/config/database';
import { config } from '@/config/environment';
import { AuthenticatedRequest } from '@/middleware/auth';
import { logger, securityLogger } from '@/utils/logger';
import { AppError, ValidationError, AuthenticationError } from '@/utils/AppError';
import { EmailService } from '@/services/EmailService';

const toInt = (v: unknown, fb = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : fb;
};

export class UserController {
  private emailService = new EmailService();

  /**
   * GET /api/users/me
   * دریافت پروفایل کاربر جاری
   */
  public getProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        walletBalanceRial: true,
        walletBalanceCrypto: true,
        walletAddress: true,
        authType: true,
        isAdmin: true,
        twoFactorEnabled: true,
        emailVerified: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    res.json({
      success: true,
      user: {
        ...user,
        walletBalanceRial: Number(user.walletBalanceRial),
        walletBalanceCrypto: Number(user.walletBalanceCrypto),
      },
    });
  };

  /**
   * PUT /api/users/me
   * به‌روزرسانی پروفایل کاربر
   */
  public updateProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const { fullName, email } = req.body as { fullName?: string; email?: string };

    if (!fullName && !email) {
      throw new ValidationError('No changes provided');
    }

    // اگر ایمیل تغییر کند: تکراری نباشد
    if (email) {
      const existing = await prisma.user.findFirst({
        where: { email, id: { not: userId } },
        select: { id: true },
      });
      if (existing) throw new ValidationError('Email is already taken');
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(fullName ? { fullName } : {}),
        ...(email ? { email, emailVerified: false } : {}),
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        walletBalanceRial: true,
        walletBalanceCrypto: true,
        authType: true,
        isAdmin: true,
        emailVerified: true,
      },
    });

    // اگر ایمیل تغییر کرده، ایمیل تأیید ارسال شود (عدم شکست پاسخ در صورت خطا)
    if (email && email !== req.user!.email) {
      try {
        await this.emailService.sendVerificationEmail(updated.id, email);
      } catch (err: any) {
        logger.warn('Failed to send verification email', {
          userId,
          email,
          error: err?.message || err,
        });
      }
    }

    logger.info('User profile updated', {
      userId,
      changes: { fullName: !!fullName, email: !!email },
      ip: req.ip,
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        ...updated,
        walletBalanceRial: Number(updated.walletBalanceRial),
        walletBalanceCrypto: Number(updated.walletBalanceCrypto),
      },
    });
  };

  /**
   * POST /api/users/change-password
   * تغییر رمز عبور
   */
  public changePassword = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const { currentPassword, newPassword } = req.body as {
      currentPassword: string;
      newPassword: string;
    };

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true, authType: true },
    });

    if (!user || user.authType !== 'EMAIL' || !user.passwordHash) {
      throw new ValidationError('Password change not available for this account type');
    }

    const isCurrentValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      securityLogger.warn('Invalid current password in change password attempt', {
        userId,
        ip: req.ip,
      });
      throw new AuthenticationError('Current password is incorrect');
    }

    if (currentPassword === newPassword) {
      throw new ValidationError('New password must be different from current password');
    }

    const newHash = await bcrypt.hash(newPassword, config.security.bcryptRounds);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash: newHash } });

    logger.info('Password changed successfully', { userId, ip: req.ip });

    res.json({ success: true, message: 'Password changed successfully' });
  };

  /**
   * POST /api/users/2fa/setup  (فقط ادمین)
   */
  public setup2FA = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;

    if (!req.user!.isAdmin) {
      throw new AppError('2FA setup is only available for admin users', 403);
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, twoFactorEnabled: true },
    });
    if (!user) throw new AppError('User not found', 404);
    if (user.twoFactorEnabled) throw new ValidationError('2FA is already enabled for this account');

    const secret = speakeasy.generateSecret({
      name: `${config.admin.twoFactorIssuer} (${user.email})`,
      issuer: config.admin.twoFactorIssuer,
    });

    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);

    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: secret.base32 },
    });

    logger.info('2FA setup initiated', { userId, ip: req.ip });

    res.json({
      success: true,
      secret: secret.base32,
      qrCode: qrCodeUrl,
      manualEntryKey: secret.base32,
    });
  };

  /**
   * POST /api/users/2fa/verify  (فقط ادمین)
   */
  public verify2FA = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { token } = req.body as { token: string };
    const userId = req.user!.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorSecret: true, isAdmin: true },
    });

    if (!user?.isAdmin || !user.twoFactorSecret) throw new ValidationError('2FA setup not found');
    if (!token || String(token).length !== 6) throw new ValidationError('Invalid 2FA code');

    const isValid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
      window: 2,
    });
    if (!isValid) throw new ValidationError('Invalid 2FA code');

    await prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: true } });

    logger.info('2FA enabled for admin user', { userId, ip: req.ip });

    res.json({ success: true, message: '2FA enabled successfully' });
  };

  /**
   * POST /api/users/2fa/disable  (فقط ادمین)
   */
  public disable2FA = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { token, password } = req.body as { token: string; password: string };
    const userId = req.user!.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        twoFactorSecret: true,
        twoFactorEnabled: true,
        passwordHash: true,
        isAdmin: true,
      },
    });

    if (!user?.isAdmin || !user.twoFactorEnabled) {
      throw new ValidationError('2FA is not enabled');
    }
    if (!user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new AuthenticationError('Invalid password');
    }

    const isValid = speakeasy.totp.verify({
      secret: user.twoFactorSecret!,
      encoding: 'base32',
      token,
      window: 2,
    });
    if (!isValid) throw new ValidationError('Invalid 2FA code');

    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });

    logger.info('2FA disabled for admin user', { userId, ip: req.ip });

    res.json({ success: true, message: '2FA disabled successfully' });
  };

  /**
   * ⚠️ DEPRECATED: استفاده از UserController برای کیف‌پول پیشنهاد نمی‌شود.
   * از روت‌های /api/wallet و WalletController استفاده کن.
   * متدهای زیر برای سازگاری باقی مانده‌اند.
   */

  // GET /api/users/wallet (Deprecated)
  public getWallet = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { walletBalanceRial: true, walletBalanceCrypto: true, walletAddress: true },
    });

    if (!user) throw new AppError('User not found', 404);

    res.json({
      success: true,
      wallet: {
        balanceRial: Number(user.walletBalanceRial),
        balanceCrypto: Number(user.walletBalanceCrypto),
        address: user.walletAddress,
      },
    });
  };

  // GET /api/users/wallet/transactions (Deprecated: فقط ریالی)
  public getWalletTransactions = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const page = Math.max(1, toInt(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(1, toInt(req.query.limit ?? 20)));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.paymentRequest.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: { id: true, amount: true, description: true, status: true, createdAt: true },
      }),
      prisma.paymentRequest.count({ where: { userId } }),
    ]);

    res.json({
      success: true,
      transactions: items.map((t) => ({ ...t, amount: Number(t.amount) })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  };
}
