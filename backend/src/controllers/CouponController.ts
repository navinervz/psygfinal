// backend/src/controllers/CouponController.ts
import { Response } from 'express';
import { AuthenticatedRequest } from '@/middleware/auth';
import { logger } from '@/utils/logger';
import { AppError } from '@/utils/AppError';
import { CouponService } from '@/services/CouponService';

export class CouponController {
  private couponService = new CouponService();

  /**
   * Validate coupon
   * POST /api/coupons/validate  { code, orderAmount }
   */
  public validateCoupon = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) throw new AppError('Authentication required', 401);

    const code: string = String(req.body?.code || '').trim();
    const orderAmount = Number(req.body?.orderAmount);

    if (!Number.isFinite(orderAmount) || orderAmount <= 0) {
      throw new AppError('Invalid order amount', 400);
    }

    try {
      const result = await this.couponService.validateCoupon(code, userId, orderAmount);

      if (!result.isValid) {
        res.status(400).json({
          success: false,
          error: result.error || 'Invalid coupon',
        });
        return;
      }

      const c = result.coupon!;
      const discountAmount = Number(result.discountAmount || 0);
      const finalAmount = Math.max(0, Number(result.finalAmount || 0));

      logger.info('Coupon validated successfully', {
        userId,
        couponCode: code,
        orderAmount,
        discountAmount,
        finalAmount,
        ip: req.ip,
      });

      res.json({
        success: true,
        coupon: {
          id: c.id,
          code: c.code,
          type: c.type,
          value: Number(c.value),
          discountAmount,
          finalAmount,
          savings: discountAmount,
        },
      });
    } catch (error: any) {
      logger.error('Coupon validation error', {
        userId,
        couponCode: code,
        error: error?.message || error,
        ip: req.ip,
      });
      throw error;
    }
  };
}
