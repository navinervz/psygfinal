// backend/src/controllers/WalletController.ts
import { Response } from 'express';
import { prisma } from '@/config/database';
import { AuthenticatedRequest } from '@/middleware/auth';
import { logger } from '@/utils/logger';
import { AppError, ValidationError } from '@/utils/AppError';

type TxType = 'rial' | 'crypto';

const toInt = (v: unknown, fb = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : fb;
};
const toBig = (v: number | string | bigint) =>
  typeof v === 'bigint' ? v : BigInt(Math.floor(Number(v)));

export class WalletController {
  /**
   * GET /api/wallet
   * اطلاعات کیف‌پول کاربر
   */
  public getWallet = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        walletBalanceRial: true,
        walletBalanceCrypto: true,
        walletAddress: true,
      },
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

  /**
   * POST /api/wallet/topup
   * تاپ‌آپ باید از مسیر پرداخت انجام شود؛ این متد فقط اطلاع‌رسانی می‌کند.
   */
  public topupWallet = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const { amount, method }: { amount: number; method: TxType } = req.body;

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new ValidationError('Amount must be positive');
    }
    if (method && method !== 'rial' && method !== 'crypto') {
      throw new ValidationError('Invalid topup method');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { walletBalanceRial: true, walletBalanceCrypto: true },
    });
    if (!user) throw new AppError('User not found', 404);

    res.json({
      success: true,
      message: 'برای افزایش موجودی از مسیرهای پرداخت استفاده کنید',
      wallet: {
        balanceRial: Number(user.walletBalanceRial),
        balanceCrypto: Number(user.walletBalanceCrypto),
      },
    });
  };

  /**
   * GET /api/wallet/transactions
   * لیست تراکنش‌ها (ریالی + کریپتو) با صفحه‌بندی درست
   * - اگر type مشخص شود، فقط همان نوع برمی‌گردد با pagination دقیق همان جدول
   * - اگر type مشخص نشود، از هر دو منبع جمع‌آوری، ادغام، مرتب‌سازی و سپس paginate می‌کنیم
   */
  public getTransactions = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const page = Math.max(1, toInt(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(1, toInt(req.query.limit ?? 20)));
    const type = (req.query.type as TxType | undefined)?.toLowerCase() as TxType | undefined;
    const skip = (page - 1) * limit;

    // فقط ریالی
    if (type === 'rial') {
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

      const mapped = items.map((p) => ({
        id: p.id,
        type: 'rial' as const,
        amount: Number(p.amount),
        currency: 'IRT',
        description: p.description,
        status: p.status,
        createdAt: p.createdAt,
      }));

      return res.json({
        success: true,
        transactions: mapped,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      });
    }

    // فقط کریپتو
    if (type === 'crypto') {
      const [items, total] = await Promise.all([
        prisma.cryptoPaymentRequest.findMany({
          where: { userId },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            amount: true,
            currency: true,
            description: true,
            status: true,
            exchangeRate: true,
            createdAt: true,
          },
        }),
        prisma.cryptoPaymentRequest.count({ where: { userId } }),
      ]);

      const mapped = items.map((p) => ({
        id: p.id,
        type: 'crypto' as const,
        amount: Number(p.amount),
        currency: p.currency,
        description: p.description,
        status: p.status,
        exchangeRate: Number(p.exchangeRate),
        tomanEquivalent: Number(p.amount) * Number(p.exchangeRate),
        createdAt: p.createdAt,
      }));

      return res.json({
        success: true,
        transactions: mapped,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      });
    }

    // هر دو: جمع‌آوری و ادغام
    const [totalRial, totalCrypto] = await Promise.all([
      prisma.paymentRequest.count({ where: { userId } }),
      prisma.cryptoPaymentRequest.count({ where: { userId } }),
    ]);
    const total = totalRial + totalCrypto;

    // برای صفحه N باید بتوانیم skip انجام دهیم؛ از هر منبع (skip+limit) تا حداکثر معقول می‌خوانیم
    const fetchSize = Math.min(1000, skip + limit); // سقف محافظه‌کارانه
    const [rialPayments, cryptoPayments] = await Promise.all([
      prisma.paymentRequest.findMany({
        where: { userId },
        take: fetchSize,
        orderBy: { createdAt: 'desc' },
        select: { id: true, amount: true, description: true, status: true, createdAt: true },
      }),
      prisma.cryptoPaymentRequest.findMany({
        where: { userId },
        take: fetchSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          amount: true,
          currency: true,
          description: true,
          status: true,
          exchangeRate: true,
          createdAt: true,
        },
      }),
    ]);

    const merged = [
      ...rialPayments.map((p) => ({
        id: p.id,
        type: 'rial' as const,
        amount: Number(p.amount),
        currency: 'IRT',
        description: p.description,
        status: p.status,
        createdAt: p.createdAt,
      })),
      ...cryptoPayments.map((p) => ({
        id: p.id,
        type: 'crypto' as const,
        amount: Number(p.amount),
        currency: p.currency,
        description: p.description,
        status: p.status,
        exchangeRate: Number(p.exchangeRate),
        tomanEquivalent: Number(p.amount) * Number(p.exchangeRate),
        createdAt: p.createdAt,
      })),
    ]
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .slice(skip, skip + limit);

    res.json({
      success: true,
      transactions: merged,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  };

  /**
   * POST /api/wallet/transfer
   * انتقال بین کاربری (داخلی)
   */
  public transferFunds = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const fromUserId = req.user!.id;
    const { toUserId, amount, description } = req.body as {
      toUserId: string;
      amount: number;
      description?: string;
    };

    const amt = toInt(amount);
    if (!Number.isFinite(amt) || amt <= 0) throw new ValidationError('Amount must be positive');
    if (fromUserId === toUserId) throw new ValidationError('Cannot transfer to yourself');

    // بررسی موجودی فرستنده
    const fromUser = await prisma.user.findUnique({
      where: { id: fromUserId },
      select: { walletBalanceRial: true },
    });
    if (!fromUser) throw new AppError('User not found', 404);

    const current = fromUser.walletBalanceRial as unknown as bigint;
    if (current < toBig(amt)) throw new ValidationError('Insufficient balance');

    // گیرنده باید وجود داشته باشد
    const toUser = await prisma.user.findUnique({
      where: { id: toUserId },
      select: { id: true },
    });
    if (!toUser) throw new AppError('Recipient not found', 404);

    // تراکنش اتمی انتقال
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: fromUserId },
        data: { walletBalanceRial: { decrement: toBig(amt) } },
      });

      await tx.user.update({
        where: { id: toUserId },
        data: { walletBalanceRial: { increment: toBig(amt) } },
      });

      // (اختیاری) می‌توان جدول ledger داخلی ثبت کرد
    });

    logger.info('Wallet transfer completed', {
      fromUserId,
      toUserId,
      amount: amt,
      description,
      ip: req.ip,
    });

    res.json({ success: true, message: 'Transfer completed successfully' });
  };
}
