// backend/src/controllers/OrderController.ts
import { Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '@/config/database';
import { AuthenticatedRequest } from '@/middleware/auth';
import { logger } from '@/utils/logger';
import { AppError, ValidationError } from '@/utils/AppError';
import { CouponService } from '@/services/CouponService';
import { EmailService } from '@/services/EmailService';

type OrderStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'CANCELLED'
  // در پنل ادمین این‌ها هم وجود دارند؛ برای فیلتر کاربر هم قابل مشاهده باشند
  | 'FAILED'
  | 'REFUNDED';

const ALLOWED_STATUSES: readonly OrderStatus[] = [
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'CANCELLED',
  'FAILED',
  'REFUNDED',
];

const toBigInt = (v: number | string | bigint) =>
  typeof v === 'bigint' ? v : BigInt(Math.floor(Number(v)));

export class OrderController {
  private couponService = new CouponService();
  private emailService = new EmailService();

  /**
   * GET /api/orders
   * لیست سفارش‌های کاربر با صفحه‌بندی
   */
  public getOrders = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const page = Math.max(1, Number(req.query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 20)));
    const status = (req.query.status as string | undefined)?.toUpperCase() as
      | OrderStatus
      | undefined;

    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (status && (ALLOWED_STATUSES as readonly string[]).includes(status)) {
      where.status = status;
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          coupon: { select: { code: true, type: true, value: true } },
        },
      }),
      prisma.order.count({ where }),
    ]);

    res.json({
      success: true,
      orders: orders.map((o) => ({
        ...o,
        totalPrice: Number(o.totalPrice),
        discountAmount: o.discountAmount != null ? Number(o.discountAmount) : null,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  };

  /**
   * GET /api/orders/:id
   * جزئیات یک سفارش کاربر
   */
  public getOrderById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const { id } = req.params;

    const order = await prisma.order.findFirst({
      where: { id, userId },
      include: {
        coupon: { select: { code: true, type: true, value: true } },
        user: { select: { fullName: true, email: true } },
      },
    });

    if (!order) throw new AppError('Order not found', 404);

    res.json({
      success: true,
      order: {
        ...order,
        totalPrice: Number(order.totalPrice),
        discountAmount: order.discountAmount != null ? Number(order.discountAmount) : null,
      },
    });
  };

  /**
   * POST /api/orders
   * ایجاد سفارش جدید و کسر از کیف‌پول (اتمی و ضد race-condition)
   */
  public createOrder = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const {
      productId,
      optionName,
      quantity,
      totalPrice,
      telegramId,
      notes,
      couponCode,
    }: {
      productId: string;
      optionName: string;
      quantity: number;
      totalPrice: number;
      telegramId?: string;
      notes?: string;
      couponCode?: string;
    } = req.body;

    // اعتبارسنجی پایه روی سرور (جدای از Joi)
    const validProducts = ['telegram-premium', 'spotify', 'chatgpt'];
    if (!validProducts.includes(productId)) {
      throw new ValidationError('Invalid product ID');
    }
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > 100) {
      throw new ValidationError('Invalid quantity');
    }
    if (!Number.isFinite(totalPrice) || totalPrice < 1000) {
      throw new ValidationError('Invalid total price');
    }

    let finalPrice = Math.floor(Number(totalPrice));
    let couponId: string | null = null;
    let discountAmount: number | null = null;

    // اعمال کوپن (در صورت وجود)
    if (couponCode) {
      const couponResult = await this.couponService.validateAndApplyCoupon(
        couponCode.trim(),
        userId,
        finalPrice
      );

      if (couponResult.isValid) {
        finalPrice = Math.floor(Number(couponResult.finalAmount!));
        discountAmount = Math.floor(Number(couponResult.discountAmount!));
        couponId = couponResult.coupon!.id;
      } else {
        // فیلد درست 'error' است نه 'message'
        throw new ValidationError(couponResult.error || 'Invalid coupon code');
      }
    }

    // بررسی سقف و کف مبلغ نهایی
    if (finalPrice < 1000) throw new ValidationError('Final amount is too small');
    if (finalPrice > 50_000_000) throw new ValidationError('Final amount exceeds allowed limit');

    const need = toBigInt(finalPrice);

    // ایجاد سفارش + کسر موجودی + ثبت مصرف کوپن (اتمی)
    let createdOrderId = '';
    const order = await prisma
      .$transaction(async (tx) => {
        // 1) کسر کیف‌پول و اطمینان از غیرمنفی بودن
        // اگر کاربر وجود نداشته باشد، Prisma خطای P2025 می‌دهد
        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: { walletBalanceRial: { decrement: need } },
          select: { walletBalanceRial: true },
        });

        if (updatedUser.walletBalanceRial < 0n) {
          // رول‌بک: موجودی کافی نیست
          throw new ValidationError('Insufficient wallet balance');
        }

        // 2) ساخت سفارش
        const newOrder = await tx.order.create({
          data: {
            userId,
            productId,
            optionName,
            quantity,
            totalPrice: need,
            telegramId: telegramId || null,
            notes: notes || null,
            couponId,
            discountAmount: discountAmount != null ? toBigInt(discountAmount) : null,
            status: 'PENDING',
          },
        });
        createdOrderId = newOrder.id;

        // 3) ثبت مصرف کوپن (اگر بود)
        if (couponId) {
          await tx.couponUsage
            .create({
              data: {
                couponId,
                userId,
                orderId: newOrder.id,
                discountAmount: toBigInt(discountAmount!),
              },
            })
            .catch((e: any) => {
              // اگر ایندکس یکتا روی (couponId,userId) داشته باشیم
              if ((e as Prisma.PrismaClientKnownRequestError)?.code === 'P2002') {
                throw new ValidationError('شما قبلاً از این کد تخفیف استفاده کرده‌اید');
              }
              throw e;
            });

          await tx.coupon.update({
            where: { id: couponId },
            data: { usedCount: { increment: 1 } },
          });
        }

        return newOrder;
      })
      .catch((err) => {
        // نگاشت خطای عدم وجود کاربر
        if ((err as Prisma.PrismaClientKnownRequestError)?.code === 'P2025') {
          throw new AppError('User not found', 404);
        }
        throw err;
      });

    logger.info('Order created successfully', {
      userId,
      orderId: order.id,
      productId,
      totalPrice: finalPrice,
      discountAmount,
      ip: req.ip,
    });

    // ایمیل تایید سفارش (non-blocking)
    try {
      // اگر ایمیل کاربر موجود نباشد، EmailService خودش skip می‌کند
      void this.emailService.sendOrderConfirmation(userId, order);
    } catch {
      // بی‌صدا
    }

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      order: {
        ...order,
        totalPrice: Number(order.totalPrice),
        discountAmount: order.discountAmount != null ? Number(order.discountAmount) : null,
      },
    });
  };

  /**
   * PUT /api/orders/:id/cancel
   * لغو سفارش «در حال انتظار» و عودت مبلغ به کیف‌پول (اتمی)
   */
  public cancelOrder = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const { id } = req.params;

    await prisma.$transaction(async (tx) => {
      // 1) خواندن سفارش (برای کاربر جاری)
      const current = await tx.order.findFirst({
        where: { id, userId },
        select: { id: true, status: true, totalPrice: true, couponId: true },
      });

      if (!current || current.status !== 'PENDING') {
        throw new AppError('Order not found or cannot be cancelled', 404);
      }

      // 2) لغو سفارش
      await tx.order.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });

      // 3) عودت مبلغ به کیف‌پول
      await tx.user.update({
        where: { id: userId },
        data: { walletBalanceRial: { increment: current.totalPrice as unknown as bigint } },
      });

      // 4) اگر کوپن استفاده شده بود، شمارنده را کم کن
      if (current.couponId) {
        await tx.coupon.update({
          where: { id: current.couponId },
          data: { usedCount: { decrement: 1 } },
        });
        // (اختیاری) می‌توان رکورد couponUsage را هم مارک کرد/حذف نمود
      }

      logger.info('Order cancelled successfully', {
        userId,
        orderId: id,
        refundAmount: Number(current.totalPrice),
        ip: (req as any).ip,
      });
    });

    res.json({
      success: true,
      message: 'Order cancelled and refunded successfully',
    });
  };
}
