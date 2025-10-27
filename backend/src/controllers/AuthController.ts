// backend/src/controllers/AuthController.ts
import { Request, Response, CookieOptions } from 'express';
import bcrypt from 'bcryptjs';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { prisma } from '@/config/database';
import { config } from '@/config/environment';
import { logger, securityLogger } from '@/utils/logger';
import { AppError, ValidationError, AuthenticationError } from '@/utils/AppError';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '@/middleware/auth';
import { EmailService } from '@/services/EmailService';
import type { AuthenticatedRequest } from '@/middleware/auth';

const isProd = config.app.env === 'production';
const refreshCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: 'strict',
  path: '/',
  domain: isProd ? config.app.domain : undefined,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

export class AuthController {
  private emailService = new EmailService();

  /**
   * Register new user
   */
  public register = async (req: Request, res: Response): Promise<void> => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const fullName = String(req.body.fullName || '').trim();
    const password = String(req.body.password || '');

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ValidationError('User with this email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, config.security.bcryptRounds);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        fullName,
        passwordHash,
        authType: 'EMAIL',
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        walletBalanceRial: true,
        walletBalanceCrypto: true,
        authType: true,
        isAdmin: true,
        isActive: true,
        createdAt: true,
      },
    });

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', refreshToken, refreshCookieOptions);

    // (اختیاری) ایمیل خوشامدگویی — خطاهای ایمیل نباید ثبت‌نام را خراب کنند
    try {
      await this.emailService.sendWelcome?.(user.email!, user.fullName);
    } catch (e) {
      logger.warn('Welcome email failed', { email: user.email, error: (e as any)?.message });
    }

    logger.info('User registered successfully', { userId: user.id, email: user.email, ip: req.ip });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user,
      accessToken,
    });
  };

  /**
   * Login user (email/password + optional 2FA)
   */
  public login = async (req: Request, res: Response): Promise<void> => {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const twoFactorCode = String(req.body.twoFactorCode || '');

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        fullName: true,
        passwordHash: true,
        walletBalanceRial: true,
        walletBalanceCrypto: true,
        authType: true,
        isAdmin: true,
        isActive: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
        lastLoginAt: true,
      },
    });

    if (!user || !user.passwordHash) {
      securityLogger.warn('Login attempt with invalid email', { email, ip: req.ip, ua: req.get('User-Agent') });
      throw new AuthenticationError('Invalid credentials');
    }

    if (!user.isActive) {
      securityLogger.warn('Login attempt for inactive user', { userId: user.id, email, ip: req.ip });
      throw new AuthenticationError('Account is deactivated');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      securityLogger.warn('Login attempt with invalid password', { userId: user.id, email, ip: req.ip, ua: req.get('User-Agent') });
      throw new AuthenticationError('Invalid credentials');
    }

    // Check 2FA if enabled
    if (user.twoFactorEnabled && user.twoFactorSecret) {
      if (!twoFactorCode) {
        res.json({ success: false, requiresTwoFactor: true, message: '2FA code required' });
        return;
      }

      const isValidToken = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: twoFactorCode,
        window: 2,
      });

      if (!isValidToken) {
        securityLogger.warn('Invalid 2FA code provided', { userId: user.id, email, ip: req.ip });
        throw new AuthenticationError('Invalid 2FA code');
      }
    }

    // Update last login
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', refreshToken, refreshCookieOptions);

    logger.info('User logged in successfully', { userId: user.id, email: user.email, ip: req.ip });

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        walletBalanceRial: user.walletBalanceRial,
        walletBalanceCrypto: user.walletBalanceCrypto,
        authType: user.authType,
        isAdmin: user.isAdmin,
      },
      accessToken,
    });
  };

  /**
   * Web3 wallet login
   */
  public web3Login = async (req: Request, res: Response): Promise<void> => {
    const walletAddress = String(req.body.walletAddress || '').trim();

    // Validate wallet address format
    if (!this.isValidWalletAddress(walletAddress)) {
      throw new ValidationError('Invalid wallet address format');
    }

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { walletAddress },
      select: {
        id: true,
        email: true,
        fullName: true,
        walletBalanceRial: true,
        walletBalanceCrypto: true,
        authType: true,
        isAdmin: true,
        isActive: true,
      },
    });

    if (!user) {
      // Create new Web3 user
      user = await prisma.user.create({
        data: {
          fullName: `کاربر ${walletAddress.slice(0, 6)}`,
          walletAddress,
          authType: 'WEB3',
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          walletBalanceRial: true,
          walletBalanceCrypto: true,
          authType: true,
          isAdmin: true,
          isActive: true,
        },
      });

      logger.info('New Web3 user created', { userId: user.id, walletAddress, ip: req.ip });
    } else {
      // Update last login
      await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
      logger.info('Web3 user logged in', { userId: user.id, walletAddress, ip: req.ip });
    }

    if (!user.isActive) {
      throw new AuthenticationError('Account is deactivated');
    }

    // Generate tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // Set refresh token as httpOnly cookie
    res.cookie('refreshToken', refreshToken, refreshCookieOptions);

    res.json({ success: true, message: 'Web3 login successful', user, accessToken });
  };

  /**
   * Refresh access token (rotating refresh)
   */
  public refreshToken = async (req: Request, res: Response): Promise<void> => {
    const token = req.cookies?.refreshToken;

    if (!token) throw new AuthenticationError('Refresh token not found');

    try {
      const decoded = verifyRefreshToken(token);
      if (decoded.type !== 'refresh') throw new AuthenticationError('Invalid token type');

      // Get user
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          email: true,
          fullName: true,
          walletBalanceRial: true,
          walletBalanceCrypto: true,
          authType: true,
          isAdmin: true,
          isActive: true,
        },
      });
      if (!user || !user.isActive) throw new AuthenticationError('User not found or inactive');

      // Generate new tokens (rotate refresh)
      const newAccessToken = generateAccessToken(user);
      const newRefreshToken = generateRefreshToken(user);

      res.cookie('refreshToken', newRefreshToken, refreshCookieOptions);

      res.json({ success: true, user, accessToken: newAccessToken });
    } catch (e) {
      // Invalidate cookie on any verification error
      res.clearCookie('refreshToken', refreshCookieOptions);
      throw new AuthenticationError('Invalid refresh token');
    }
  };

  /**
   * Logout user
   */
  public logout = async (_req: Request, res: Response): Promise<void> => {
    res.clearCookie('refreshToken', refreshCookieOptions);
    res.json({ success: true, message: 'Logged out successfully' });
  };

  /**
   * Setup 2FA for admin
   */
  public setup2FA = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) throw new AuthenticationError();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true, email: true, twoFactorEnabled: true },
    });

    if (!user?.isAdmin) throw new AppError('2FA setup is only available for admin users', 403);
    if (user.twoFactorEnabled) throw new ValidationError('2FA is already enabled for this account');

    const secret = speakeasy.generateSecret({
      name: `${config.admin.twoFactorIssuer} (${user.email})`,
      issuer: config.admin.twoFactorIssuer,
    });

    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);

    await prisma.user.update({ where: { id: userId }, data: { twoFactorSecret: secret.base32 } });

    res.json({
      success: true,
      secret: secret.base32,
      qrCode: qrCodeUrl,
      manualEntryKey: secret.base32,
    });
  };

  /**
   * Verify and enable 2FA
   */
  public verify2FA = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const token = String((req.body?.token ?? '')).trim();
    const userId = req.user?.id;
    if (!userId) throw new AuthenticationError();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorSecret: true, isAdmin: true },
    });

    if (!user?.isAdmin || !user.twoFactorSecret) throw new ValidationError('2FA setup not found');

    const isValid = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
      window: 2,
    });
    if (!isValid) throw new ValidationError('Invalid 2FA code');

    await prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: true } });
    logger.info('2FA enabled for admin user', { userId });

    res.json({ success: true, message: '2FA enabled successfully' });
  };

  /**
   * Disable 2FA
   */
  public disable2FA = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const token = String((req.body?.token ?? '')).trim();
    const password = String((req.body?.password ?? '')).trim();
    const userId = req.user?.id;
    if (!userId) throw new AuthenticationError();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorSecret: true, twoFactorEnabled: true, passwordHash: true, isAdmin: true },
    });

    if (!user?.isAdmin || !user.twoFactorEnabled) throw new ValidationError('2FA is not enabled');

    // Verify password
    if (!user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new AuthenticationError('Invalid password');
    }

    // Verify 2FA token
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

    logger.info('2FA disabled for admin user', { userId });
    res.json({ success: true, message: '2FA disabled successfully' });
  };

  /**
   * Get current user profile
   */
  public getProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) throw new AuthenticationError();

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
        lastLoginAt: true,
        createdAt: true,
      },
    });

    if (!user) throw new AppError('User not found', 404);

    res.json({ success: true, user });
  };

  /**
   * Update user profile
   */
  public updateProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) throw new AuthenticationError();

    const fullName = req.body.fullName ? String(req.body.fullName).trim() : undefined;
    const email = req.body.email ? String(req.body.email).trim().toLowerCase() : undefined;

    if (email) {
      const exists = await prisma.user.findFirst({ where: { email, id: { not: userId } } });
      if (exists) throw new ValidationError('Email is already taken');
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { ...(fullName && { fullName }), ...(email && { email }) },
      select: {
        id: true,
        email: true,
        fullName: true,
        walletBalanceRial: true,
        walletBalanceCrypto: true,
        authType: true,
        isAdmin: true,
      },
    });

    logger.info('User profile updated', { userId, changes: { fullName: !!fullName, email: !!email } });
    res.json({ success: true, message: 'Profile updated successfully', user: updatedUser });
  };

  /**
   * Change password (EMAIL accounts only)
   */
  public changePassword = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) throw new AuthenticationError();

    const currentPassword = String(req.body.currentPassword || '');
    const newPassword = String(req.body.newPassword || '');

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true, authType: true },
    });

    if (!user || user.authType !== 'EMAIL' || !user.passwordHash) {
      throw new ValidationError('Password change not available for this account type');
    }

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      securityLogger.warn('Invalid current password in change password attempt', { userId, ip: (req as any).ip });
      throw new AuthenticationError('Current password is incorrect');
    }

    const newPasswordHash = await bcrypt.hash(newPassword, config.security.bcryptRounds);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash: newPasswordHash } });

    logger.info('Password changed successfully', { userId });
    res.json({ success: true, message: 'Password changed successfully' });
  };

  /**
   * Validate wallet address format
   */
  private isValidWalletAddress(address: string): boolean {
    const ethRegex = /^0x[a-fA-F0-9]{40}$/;       // Ethereum (0x + 40 hex)
    const tonRegex = /^UQ[a-zA-Z0-9_-]{46}$/;     // TON (سطح پایه)
    return ethRegex.test(address) || tonRegex.test(address);
  }
}
