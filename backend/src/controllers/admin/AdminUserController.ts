import { Response } from 'express';
import { prisma } from '@/config/database';
import { AuthenticatedRequest } from '@/middleware/auth';
import { logger, logAdminAction } from '@/utils/logger';
import { AppError, ValidationError } from '@/utils/AppError';

const ALLOWED_SORT_FIELDS = new Set([
  'createdAt',
  'fullName',
  'email',
  'lastLoginAt',
  'walletBalanceRial',
  'walletBalanceCrypto',
]);

const clampInt = (val: unknown, min: number, max: number, fallback: number) => {
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
};

export class AdminUserController {
  /**
   * Get all users (non-admin)
   */
  public getUsers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const adminId = req.user!.id;

    try {
      let {
        page = 1,
        limit = 20,
        search,
        authType,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = req.query as Record<string, string>;

      // sanitize / clamp paging & sorting
      const _page = clampInt(page, 1, 10_000, 1);
      const _limit = clampInt(limit, 1, 100, 20);
      const _sortBy = ALLOWED_SORT_FIELDS.has(String(sortBy)) ? String(sortBy) : 'createdAt';
      const _sortOrder = String(sortOrder).toLowerCase() === 'asc' ? 'asc' : 'desc';

      const skip = (_page - 1) * _limit;

      const where: any = { isAdmin: false };

      // Search filter (case-insensitive)
      if (search && String(search).trim().length > 0) {
        const term = String(search).trim();
        where.OR = [
          { fullName: { contains: term, mode: 'insensitive' } },
          { email: { contains: term, mode: 'insensitive' } },
          { walletAddress: { contains: term, mode: 'insensitive' } },
        ];
      }

      // Auth type filter
      if (authType && ['EMAIL', 'WEB3'].includes(String(authType))) {
        where.authType = String(authType);
      }

      // Sort options
      const orderBy: any = {};
      orderBy[_sortBy] = _sortOrder;

      // Query users + total
      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take: _limit,
          orderBy,
          select: {
            id: true,
            email: true,
            fullName: true,
            walletBalanceRial: true,
            walletBalanceCrypto: true,
            walletAddress: true,
            authType: true,
            isActive: true,
            emailVerified: true,
            lastLoginAt: true,
            createdAt: true,
          },
        }),
        prisma.user.count({ where }),
      ]);

      // Aggregate order stats for current page users in ONE query (avoid N+1)
      const ids = users.map((u) => u.id);
      const ordersAgg =
        ids.length === 0
          ? []
          : await prisma.order.groupBy({
              by: ['userId'],
              where: { userId: { in: ids } },
              _sum: { totalPrice: true },
              _count: { _all: true },
            });

      const statsMap = new Map<
        string,
        {
          totalOrders: number;
          totalSpent: number;
        }
      >();

      for (const row of ordersAgg) {
        statsMap.set(row.userId, {
          totalOrders: row._count._all,
          totalSpent: Number(row._sum.totalPrice || 0),
        });
      }

      const usersWithStats = users.map((user) => {
        const s = statsMap.get(user.id) || { totalOrders: 0, totalSpent: 0 };
        return {
          ...user,
          walletBalanceRial: Number(user.walletBalanceRial),
          walletBalanceCrypto: Number(user.walletBalanceCrypto),
          totalOrders: s.totalOrders,
          totalSpent: s.totalSpent,
        };
      });

      logAdminAction(adminId, 'view_users', {
        filters: { search, authType, sortBy: _sortBy, sortOrder: _sortOrder, page: _page, limit: _limit },
        ip: req.ip,
      });

      res.json({
        success: true,
        users: usersWithStats,
        pagination: {
          page: _page,
          limit: _limit,
          total,
          pages: Math.ceil(total / _limit),
        },
      });
    } catch (error) {
      logger.error('Admin getUsers failed', {
        adminId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new AppError('Failed to fetch users', 503);
    }
  };

  /**
   * Get user by ID (non-admin)
   */
  public getUserById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const adminId = req.user!.id;
    const { id } = req.params;

    try {
      const user = await prisma.user.findFirst({
        where: { id, isAdmin: false },
        include: {
          orders: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
          paymentRequests: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
          cryptoPaymentRequests: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      });

      if (!user) {
        throw new AppError('User not found', 404);
      }

      logAdminAction(adminId, 'view_user_details', {
        targetUserId: id,
        ip: req.ip,
      });

      res.json({
        success: true,
        user: {
          ...user,
          walletBalanceRial: Number(user.walletBalanceRial),
          walletBalanceCrypto: Number(user.walletBalanceCrypto),
          orders: user.orders.map((order) => ({
            ...order,
            totalPrice: Number(order.totalPrice),
          })),
          paymentRequests: user.paymentRequests.map((payment) => ({
            ...payment,
            amount: Number(payment.amount),
          })),
          cryptoPaymentRequests: user.cryptoPaymentRequests.map((payment) => ({
            ...payment,
            amount: Number(payment.amount),
            exchangeRate: Number(payment.exchangeRate),
          })),
        },
      });
    } catch (error) {
      logger.error('Admin getUserById failed', {
        adminId,
        userId: id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error instanceof AppError ? error : new AppError('Failed to fetch user details', 503);
    }
  };

  /**
   * Update user (non-admin)
   */
  public updateUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const adminId = req.user!.id;
    const { id } = req.params;
    const { fullName, email, isActive } = req.body as {
      fullName?: string;
      email?: string;
      isActive?: boolean;
    };

    try {
      // Ensure target is not admin
      const existingUser = await prisma.user.findFirst({
        where: { id, isAdmin: false },
      });

      if (!existingUser) {
        throw new AppError('User not found', 404);
      }

      // Email uniqueness
      if (email && email !== existingUser.email) {
        const emailExists = await prisma.user.findFirst({
          where: { email, id: { not: id } },
        });
        if (emailExists) {
          throw new ValidationError('Email is already taken');
        }
      }

      const updatedUser = await prisma.user.update({
        where: { id },
        data: {
          ...(fullName ? { fullName } : {}),
          ...(email ? { email, emailVerified: false } : {}),
          ...(typeof isActive === 'boolean' ? { isActive } : {}),
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          walletBalanceRial: true,
          walletBalanceCrypto: true,
          authType: true,
          isActive: true,
          emailVerified: true,
        },
      });

      logAdminAction(adminId, 'update_user', {
        targetUserId: id,
        changes: { fullName: !!fullName, email: !!email, isActive },
        ip: req.ip,
      });

      logger.info('User updated by admin', {
        adminId,
        userId: id,
        changes: { fullName: !!fullName, email: !!email, isActive },
      });

      res.json({
        success: true,
        message: 'User updated successfully',
        user: {
          ...updatedUser,
          walletBalanceRial: Number(updatedUser.walletBalanceRial),
          walletBalanceCrypto: Number(updatedUser.walletBalanceCrypto),
        },
      });
    } catch (error) {
      logger.error('Admin updateUser failed', {
        adminId,
        userId: id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error instanceof AppError ? error : new AppError('Failed to update user', 503);
    }
  };

  /**
   * Deactivate user (soft delete)
   */
  public deleteUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const adminId = req.user!.id;
    const { id } = req.params;

    try {
      const user = await prisma.user.findFirst({
        where: { id, isAdmin: false },
        select: { fullName: true, email: true },
      });

      if (!user) {
        throw new AppError('User not found', 404);
      }

      await prisma.user.update({
        where: { id },
        data: { isActive: false },
      });

      logAdminAction(adminId, 'delete_user', {
        targetUserId: id,
        userInfo: { fullName: user.fullName, email: user.email },
        ip: req.ip,
      });

      logger.info('User deactivated by admin', {
        adminId,
        userId: id,
        userInfo: user,
      });

      res.json({
        success: true,
        message: 'User deactivated successfully',
      });
    } catch (error) {
      logger.error('Admin deleteUser failed', {
        adminId,
        userId: id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error instanceof AppError ? error : new AppError('Failed to deactivate user', 503);
    }
  };

  /**
   * Adjust user wallet balance
   */
  public adjustWallet = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const adminId = req.user!.id;
    const { id } = req.params;
    const { amount, type, reason } = req.body as { amount: number; type: 'rial' | 'crypto'; reason?: string };

    try {
      if (!['rial', 'crypto'].includes(String(type))) {
        throw new ValidationError('Invalid wallet type');
      }
      if (!Number.isFinite(amount) || Number(amount) === 0) {
        throw new ValidationError('Amount must be a non-zero number');
      }

      const user = await prisma.user.findFirst({
        where: { id, isAdmin: false },
        select: {
          fullName: true,
          walletBalanceRial: true,
          walletBalanceCrypto: true,
        },
      });

      if (!user) {
        throw new AppError('User not found', 404);
      }

      // Prevent negative balance
      if (amount < 0) {
        const currentBalance = type === 'rial' ? Number(user.walletBalanceRial) : Number(user.walletBalanceCrypto);
        if (currentBalance + amount < 0) {
          throw new ValidationError('Insufficient balance for deduction');
        }
      }

      // Update wallet atomically
      const updateData: any = {};
      if (type === 'rial') {
        updateData.walletBalanceRial = { increment: amount };
      } else {
        updateData.walletBalanceCrypto = { increment: amount };
      }

      const updatedUser = await prisma.user.update({
        where: { id },
        data: updateData,
        select: {
          walletBalanceRial: true,
          walletBalanceCrypto: true,
        },
      });

      logAdminAction(adminId, 'adjust_wallet', {
        targetUserId: id,
        amount,
        type,
        reason,
        newBalance: type === 'rial'
          ? Number(updatedUser.walletBalanceRial)
          : Number(updatedUser.walletBalanceCrypto),
        ip: req.ip,
      });

      logger.info('Wallet balance adjusted by admin', {
        adminId,
        userId: id,
        amount,
        type,
        reason,
      });

      res.json({
        success: true,
        message: 'Wallet balance adjusted successfully',
        newBalance: {
          rial: Number(updatedUser.walletBalanceRial),
          crypto: Number(updatedUser.walletBalanceCrypto),
        },
      });
    } catch (error) {
      logger.error('Admin adjustWallet failed', {
        adminId,
        userId: id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error instanceof AppError ? error : new AppError('Failed to adjust wallet', 503);
    }
  };
}
