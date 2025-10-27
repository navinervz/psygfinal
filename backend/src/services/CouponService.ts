// backend/src/services/CouponService.ts
import { prisma } from '@/config/database';
import { logger } from '@/utils/logger';

export interface CouponValidationResult {
  isValid: boolean;
  coupon?: {
    id: string;
    code: string;
    type: 'PERCENTAGE' | 'FIXED';
    value: number;          // عدد نهایی (Number) برای محاسبات
    maxDiscount?: number | null;
  };
  discountAmount?: number;  // ریال (Number، گرد‌شده به پایین)
  finalAmount?: number;     // ریال (Number، >= 0)
  error?: string;
}

const MIN_ORDER_AMOUNT = 1_000; // حداقل مبلغ معتبر سفارش (ریال)

/* ----------------------------- Utils ----------------------------- */
const clamp = (n: number, min: number, max: number) =>
  Math.min(max, Math.max(min, n));

/** به عدد صحیح (floor) تبدیل می‌کند؛ در صورت نامعتبر بودن fallback می‌دهد */
const toInt = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
};

const normalizeCode = (code: string) => code.trim().toUpperCase();

/* ----------------------------- Service ----------------------------- */
export class CouponService {
  /**
   * بررسی اعتبار کد تخفیف و محاسبهٔ مبلغ نهایی
   * - فقط ولیدیشن/محاسبه انجام می‌دهد. اعمال نهایی (ثبت استفاده و …) در تراکنش ساخت سفارش انجام می‌شود.
   */
  public async validateCoupon(
    code: string,
    userId: string,
    orderAmount: number
  ): Promise<CouponValidationResult> {
    try {
      const normalized = normalizeCode(code);
      if (normalized.length < 3) {
        return { isValid: false, error: 'کد تخفیف معتبر نیست' };
      }

      const amount = toInt(orderAmount);
      if (amount < MIN_ORDER_AMOUNT) {
        return { isValid: false, error: 'مبلغ سفارش نامعتبر است' };
      }

      // فقط فیلدهای لازم را می‌خوانیم
      const coupon = await prisma.coupon.findUnique({
        where: { code: normalized },
        select: {
          id: true,
          code: true,
          isActive: true,
          type: true,           // 'PERCENTAGE' | 'FIXED'
          value: true,          // Decimal/number
          maxDiscount: true,    // Nullable
          minAmount: true,      // Nullable
          usageLimit: true,     // Nullable
          usedCount: true,
          validFrom: true,      // Nullable
          validUntil: true,     // Nullable
        },
      });

      if (!coupon) return { isValid: false, error: 'کد تخفیف معتبر نیست' };
      if (!coupon.isActive) return { isValid: false, error: 'کد تخفیف غیرفعال است' };

      const now = new Date();
      if (coupon.validFrom && now < coupon.validFrom) {
        return { isValid: false, error: 'کد تخفیف هنوز فعال نشده است' };
      }
      if (coupon.validUntil && now > coupon.validUntil) {
        return { isValid: false, error: 'کد تخفیف منقضی شده است' };
      }

      const minAmount = toInt(coupon.minAmount, 0);
      if (minAmount > 0 && amount < minAmount) {
        return {
          isValid: false,
          error: `حداقل مبلغ خرید برای استفاده از این کد تخفیف ${minAmount.toLocaleString()} تومان است`,
        };
      }

      if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
        return { isValid: false, error: 'ظرفیت استفاده از این کد تخفیف تکمیل شده است' };
      }

      // هر کاربر فقط یک‌بار؟
      const alreadyUsed = await prisma.couponUsage.findFirst({
        where: { couponId: coupon.id, userId },
        select: { id: true },
      });
      if (alreadyUsed) {
        return { isValid: false, error: 'شما قبلاً از این کد تخفیف استفاده کرده‌اید' };
      }

      // محاسبهٔ تخفیف با محافظت از پیکربندی اشتباه
      const valueRaw = toInt(coupon.value, 0);
      let discountAmount = 0;

      if (coupon.type === 'PERCENTAGE') {
        // درصد را در بازه 1..100 clamp می‌کنیم تا misconfig بی‌اثر شود
        const pct = clamp(valueRaw, 1, 100);
        if (pct !== valueRaw) {
          logger.warn('Coupon percentage value out of bounds; clamped', {
            code: coupon.code,
            original: valueRaw,
            clamped: pct,
          });
        }
        discountAmount = Math.floor((amount * pct) / 100);

        const maxDiscount = toInt(coupon.maxDiscount, 0);
        if (maxDiscount > 0 && discountAmount > maxDiscount) {
          discountAmount = maxDiscount;
        }
      } else {
        // FIXED
        const fixed = Math.max(0, valueRaw);
        if (fixed !== valueRaw) {
          logger.warn('Coupon fixed value negative; clamped to 0', {
            code: coupon.code,
            original: valueRaw,
          });
        }
        discountAmount = Math.min(fixed, amount);
      }

      if (discountAmount < 0) discountAmount = 0;
      const finalAmount = Math.max(0, amount - discountAmount);

      logger.info('Coupon validated', {
        userId,
        couponCode: normalized,
        orderAmount: amount,
        discountAmount,
        finalAmount,
      });

      return {
        isValid: true,
        coupon: {
          id: coupon.id,
          code: coupon.code,
          type: coupon.type as 'PERCENTAGE' | 'FIXED',
          value: valueRaw,
          maxDiscount: coupon.maxDiscount != null ? toInt(coupon.maxDiscount, 0) : null,
        },
        discountAmount,
        finalAmount,
      };
    } catch (err: any) {
      logger.error('Coupon validation error', {
        userId,
        couponCode: code,
        error: err?.message || 'Unknown error',
      });
      return { isValid: false, error: 'خطا در بررسی کد تخفیف' };
    }
  }

  /**
   * همان validateCoupon به‌علاوهٔ لاگ «اعمال در سفارش»
   * (نکته: اعمال واقعی در OrderController و داخل تراکنش انجام می‌شود)
   */
  public async validateAndApplyCoupon(
    code: string,
    userId: string,
    orderAmount: number
  ): Promise<CouponValidationResult> {
    const result = await this.validateCoupon(code, userId, orderAmount);
    if (result.isValid) {
      logger.info('Coupon will be applied to order', {
        userId,
        couponCode: normalizeCode(code),
        discountAmount: result.discountAmount,
        finalAmount: result.finalAmount,
      });
    }
    return result;
  }

  /**
   * آمار استفاده از کوپن (برای پنل ادمین)
   */
  public async getCouponStats(couponId: string): Promise<{
    totalUsage: number;
    totalDiscount: number;
    recentUsage: Array<{
      id: string;
      discountAmount: number;
      usedAt: Date;
      user: { fullName: string | null; email: string | null };
      order: { productId: string; totalPrice: number };
    }>;
  }> {
    const [totalUsage, sumAgg, recent] = await Promise.all([
      prisma.couponUsage.count({ where: { couponId } }),
      prisma.couponUsage.aggregate({
        where: { couponId },
        _sum: { discountAmount: true },
      }),
      prisma.couponUsage.findMany({
        where: { couponId },
        take: 10,
        orderBy: { usedAt: 'desc' },
        select: {
          id: true,
          discountAmount: true,
          usedAt: true,
          user: { select: { fullName: true, email: true } },
          order: { select: { productId: true, totalPrice: true } },
        },
      }),
    ]);

    const totalDiscount = toInt(sumAgg._sum.discountAmount, 0);

    const recentUsage = recent.map((u) => ({
      id: u.id,
      discountAmount: toInt(u.discountAmount, 0),
      usedAt: u.usedAt,
      user: {
        fullName: u.user?.fullName ?? null,
        email: u.user?.email ?? null,
      },
      order: {
        productId: u.order!.productId,
        totalPrice: toInt(u.order!.totalPrice, 0),
      },
    }));

    return { totalUsage, totalDiscount, recentUsage };
  }
}
