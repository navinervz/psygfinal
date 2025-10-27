import { Response } from 'express';
import { prisma } from '@/config/database';
import { AuthenticatedRequest } from '@/middleware/auth';
import { logger, logAdminAction } from '@/utils/logger';
import { AppError, ValidationError } from '@/utils/AppError';
import { EmailService } from '@/services/EmailService';

const ALLOWED_SORT_FIELDS = new Set(['createdAt', 'status', 'totalPrice', 'productId']);
const VALID_STATUSES = new Set([
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
  'REFUNDED',
]);

const clampInt = (val: unknown, min: number, max: number, fallback: number) => {
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
};

export class AdminOrderController {
  private emailService = new EmailService();

  /**
   * Get all orders
   */
  public getOrders = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const adminId = req.user!.id;

    try {
      let {
        page = '1',
        limit = '20',
        search,
        status,
        productId,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = req.query as Record<string, string>;

      const _page = clampInt(page, 1, 100000, 1);
      const _limit = clampInt(limit, 1, 100, 20);
      const skip = (_page - 1) * _limit;

      const _sortBy = ALLOWED_SORT_FIELDS.has(String(sortBy)) ? String(sortBy) : 'createdAt';
      const _sortOrder = String(sortOrder).toLowerCase() === 'asc' ? 'asc' : 'desc';

      const where: any = {};

      // Search filter (case-insensitive)
      if (search && search.trim().length > 0) {
        const term = search.trim();
        where.OR = [
          { id: { contains: term, mode: 'insensitive' } },
          { productId: { contains: term, mode: 'insensitive' } },
          { optionName: { contains: term, mode: 'insensitive' } },
          { adminNotes: { contains: term, mode: 'insensitive' } },
          { user: { is: { fullName: { contains: term, mode: 'insensitive' } } } },
          { user: { is: { email: { contains: term, mode: 'insensitive' } } } },
        ];
      }

      // Status filter
      if (status) {
        if (!VALID_STATUSES.has(String(status))) {
          throw new ValidationError('Invalid status filter');
        }
        where.status = String(status);
      }

      // Product filter
      if (productId && productId.trim()) {
        where.productId = productId.trim();
      }

      // Sort options
      const orderBy: any = {};
      orderBy[_sortBy] = _sortOrder;

      const [orders, total] = await Promise.all([
        prisma.order.findMany({
          where,
          skip,
          take: _limit,
          orderBy,
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                walletAddress: true,
              },
            },
            coupon: {
              select: {
                id: true,
                code: true,
                type: true,
                value: true,
              },
            },
          },
        }),
        prisma.order.count({ where }),
      ]);

      logAdminAction(adminId, 'view_orders', {
        filters: { search, status, productId, sortBy: _sortBy, sortOrder: _sortOrder, page: _page, limit: _limit },
        ip: req.ip,
      });

      res.json({
        success: true,
        orders: orders.map((o) => ({
          ...o,
          totalPrice: Number(o.totalPrice),
          discountAmount: o.discountAmount ? Number(o.discountAmount) : null,
        })),
        pagination: {
          page: _page,
          limit: _limit,
          total,
          pages: Math.ceil(total / _limit),
        },
      });
    } catch (error) {
      logger.error('Admin getOrders failed', {
        adminId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new AppError('Failed to fetch orders', 503);
    }
  };

  /**
   * Get order by ID
   */
  public getOrderById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const adminId = req.user!.id;
    const { id } = req.params;

    try {
      const order = await prisma.order.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              walletAddress: true,
              authType: true,
            },
          },
          coupon: {
            select: {
              id: true,
              code: true,
              type: true,
              value: true,
            },
          },
        },
      });

      if (!order) {
        throw new AppError('Order not found', 404);
      }

      logAdminAction(adminId, 'view_order_details', {
        targetOrderId: id,
        ip: req.ip,
      });

      res.json({
        success: true,
        order: {
          ...order,
          totalPrice: Number(order.totalPrice),
          discountAmount: order.discountAmount ? Number(order.discountAmount) : null,
        },
      });
    } catch (error) {
      logger.error('Admin getOrderById failed', {
        adminId,
        orderId: id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error instanceof AppError ? error : new AppError('Failed to fetch order', 503);
    }
  };

  /**
   * Update order status / notes
   */
  public updateOrder = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const adminId = req.user!.id;
    const { id } = req.params;
    const { status, adminNotes } = req.body as { status?: string; adminNotes?: string };

    try {
      if (status && !VALID_STATUSES.has(status)) {
        throw new ValidationError('Invalid order status');
      }

      // Get current order with minimal fields
      const current = await prisma.order.findUnique({
        where: { id },
        include: {
          user: { select: { id: true, fullName: true, email: true } },
        },
      });

      if (!current) {
        throw new AppError('Order not found', 404);
      }

      // Only notes update (no status change)
      if (!status || status === current.status) {
        await prisma.order.update({
          where: { id },
          data: { adminNotes },
        });

        logAdminAction(adminId, 'update_order_notes', {
          targetOrderId: id,
          adminNotes,
          ip: req.ip,
        });

        return void res.json({ success: true, message: 'Order notes updated' });
      }

      // Handle transition to REFUNDED (atomic)
      if (status === 'REFUNDED' && current.status !== 'REFUNDED') {
        await prisma.$transaction(async (tx) => {
          // Update order
          await tx.order.update({
            where: { id },
            data: { status, adminNotes },
          });

          // Refund wallet
          await tx.user.update({
            where: { id: current.userId },
            data: {
              walletBalanceRial: { increment: Number(current.totalPrice) },
            },
          });

          // If coupon used, decrement usedCount (align with cancel flow)
          if (current.couponId) {
            await tx.coupon.update({
              where: { id: current.couponId },
              data: { usedCount: { decrement: 1 } },
            });
          }
        });
      } else {
        // Regular status change
        await prisma.order.update({
          where: { id },
          data: { status, adminNotes },
        });

        // If moved to COMPLETED for the first time → send confirmation email (best-effort)
        if (status === 'COMPLETED' && current.status !== 'COMPLETED' && current.user?.email) {
          try {
            await this.emailService.sendOrderConfirmation(current.userId, {
              id: current.id,
              productId: current.productId,
              optionName: (current as any).optionName,
              totalPrice: Number(current.totalPrice),
            });
          } catch (e) {
            logger.warn('sendOrderConfirmation failed (ignored)', {
              orderId: current.id,
              error: e instanceof Error ? e.message : String(e),
            });
          }
        }
      }

      logAdminAction(adminId, 'update_order', {
        targetOrderId: id,
        oldStatus: current.status,
        newStatus: status,
        adminNotes,
        ip: req.ip,
      });

      logger.info('Order updated by admin', {
        adminId,
        orderId: id,
        oldStatus: current.status,
        newStatus: status,
      });

      res.json({
        success: true,
        message: 'Order updated successfully',
      });
    } catch (error) {
      logger.error('Admin updateOrder failed', {
        adminId,
        orderId: id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error instanceof AppError ? error : new AppError('Failed to update order', 503);
    }
  };

  /**
   * Delete order
   */
  public deleteOrder = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const adminId = req.user!.id;
    const { id } = req.params;

    try {
      const order = await prisma.order.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          totalPrice: true,
          userId: true,
          productId: true,
          couponId: true,
        },
      });

      if (!order) {
        throw new AppError('Order not found', 404);
      }

      // Only allow deletion of cancelled or failed orders
      if (!['CANCELLED', 'FAILED'].includes(order.status)) {
        throw new ValidationError('Only cancelled or failed orders can be deleted');
      }

      // (Optional) اگر دوست داری سابقه کوپن هم پاک بشه، اینجا می‌شه اضافه کرد.
      await prisma.order.delete({ where: { id } });

      logAdminAction(adminId, 'delete_order', {
        targetOrderId: id,
        orderInfo: {
          status: order.status,
          totalPrice: Number(order.totalPrice),
          productId: order.productId,
        },
        ip: req.ip,
      });

      logger.info('Order deleted by admin', {
        adminId,
        orderId: id,
        orderStatus: order.status,
      });

      res.json({
        success: true,
        message: 'Order deleted successfully',
      });
    } catch (error) {
      logger.error('Admin deleteOrder failed', {
        adminId,
        orderId: id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error instanceof AppError ? error : new AppError('Failed to delete order', 503);
    }
  };

  /**
   * Refund order
   */
  public refundOrder = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const adminId = req.user!.id;
    const { id } = req.params;
    const { reason } = req.body as { reason?: string };

    try {
      const order = await prisma.order.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
      });

      if (!order) {
        throw new AppError('Order not found', 404);
      }

      if (order.status === 'REFUNDED') {
        throw new ValidationError('Order is already refunded');
      }

      if (!['COMPLETED', 'PROCESSING'].includes(order.status)) {
        throw new ValidationError('Only completed or processing orders can be refunded');
      }

      await prisma.$transaction(async (tx) => {
        // Update order status
        await tx.order.update({
          where: { id },
          data: {
            status: 'REFUNDED',
            adminNotes: reason || 'Refunded by admin',
          },
        });

        // Refund to user wallet
        await tx.user.update({
          where: { id: order.userId },
          data: {
            walletBalanceRial: {
              increment: Number(order.totalPrice),
            },
          },
        });

        // If coupon used, decrement usedCount
        if (order.couponId) {
          await tx.coupon.update({
            where: { id: order.couponId },
            data: { usedCount: { decrement: 1 } },
          });
        }
      });

      logAdminAction(adminId, 'refund_order', {
        targetOrderId: id,
        refundAmount: Number(order.totalPrice),
        reason,
        ip: req.ip,
      });

      logger.info('Order refunded by admin', {
        adminId,
        orderId: id,
        refundAmount: Number(order.totalPrice),
        reason,
      });

      res.json({
        success: true,
        message: 'Order refunded successfully',
        refundAmount: Number(order.totalPrice),
      });
    } catch (error) {
      logger.error('Admin refundOrder failed', {
        adminId,
        orderId: id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error instanceof AppError ? error : new AppError('Failed to refund order', 503);
    }
  };
}
