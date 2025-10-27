import { Response } from 'express';
import { prisma } from '@/config/database';
import { AuthenticatedRequest } from '@/middleware/auth';
import { logger, logAdminAction } from '@/utils/logger';
import { AppError, ValidationError } from '@/utils/AppError';
import { CouponService } from '@/services/CouponService';

/* ----------------------------- helpers & guards ----------------------------- */
const ALLOWED_SORT_FIELDS = new Set([
  'createdAt',
  'updatedAt',
  'validFrom',
  'validUntil',
  'code',
  'type',
  'value',
  'minAmount',
  'maxDiscount',
  'usageLimit',
  'usedCount',
  'isActive',
]);

const clampInt = (val: unknown, min: number, max: number, fallback: number) => {
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
};

const parseDateOrNull = (v: unknown): Date | null => {
  if (!v) return null;
  const d = new Date(v as any);
  return Number.isFinite(d.getTime()) ? d : null;
};

const normalizeCode = (code: unknown) =>
  String(code || '')
    .trim()
    .toUpperCase();

type CouponType = 'PERCENTAGE' | 'FIXED';

const isCouponType = (v: any): v is CouponType =>
  v === 'PERCENTAGE' || v === 'FIXED';

export class AdminCouponController {
  private couponService = new CouponService();

  /**
   * Get all coupons
   */
  public getCoupons = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const adminId = req.user!.id;

    try {
      const {
        page = '1',
        limit = '20',
        search,
        status,
        sortBy = 'createdAt',
        sortOrder = 'desc',
      } = req.query as Record<string, string>;

      const _page = clampInt(page, 1, 100000, 1);
      const _limit = clampInt(limit, 1, 200, 20);
      const skip = (_page - 1) * _limit;

      const _sortBy = ALLOWED_SORT_FIELDS.has(String(sortBy)) ? String(sortBy) : 'createdAt';
      const _sortOrder = String(sortOrder).toLowerCase() === 'asc' ? 'asc' : 'desc';

      const where: any = {};

      // Search filter (case-insensitive)
      if (search && search.trim()) {
        where.code = { contains: search.trim(), mode: 'insensitive' };
      }

      // Status filter
      const now = new Date();
      if (status === 'active') {
        where.isActive = true;
        where.AND = [
          { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
          { OR: [{ validUntil: null }, { validUntil: { gt: now } }] },
        ];
      } else if (status === 'expired') {
        where.validUntil = { lte: now };
      } else if (status === 'inactive') {
        where.isActive = false;
      }

      const orderBy: any = {};
      orderBy[_sortBy] = _sortOrder;

      const [coupons, total] = await Promise.all([
        prisma.coupon.findMany({
          where,
          skip,
          take: _limit,
          orderBy,
          include: {
            creator: { select: { fullName: true, email: true } },
            _count: { select: { usages: true } },
          },
        }),
        prisma.coupon.count({ where }),
      ]);

      logAdminAction(adminId, 'view_coupons', {
        filters: { search, status, sortBy: _sortBy, sortOrder: _sortOrder },
        ip: req.ip,
      });

      res.json({
        success: true,
        coupons: coupons.map((c) => ({
          ...c,
          value: Number(c.value),
          minAmount: Number(c.minAmount),
          maxDiscount: c.maxDiscount != null ? Number(c.maxDiscount) : null,
          totalUsages: c._count.usages,
        })),
        pagination: {
          page: _page,
          limit: _limit,
          total,
          pages: Math.ceil(total / _limit),
        },
      });
    } catch (error) {
      logger.error('Admin getCoupons failed', {
        adminId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new AppError('Failed to fetch coupons', 503);
    }
  };

  /**
   * Get coupon by ID
   */
  public getCouponById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const adminId = req.user!.id;
    const { id } = req.params;

    try {
      const coupon = await prisma.coupon.findUnique({
        where: { id },
        include: {
          creator: { select: { fullName: true, email: true } },
        },
      });

      if (!coupon) {
        throw new AppError('Coupon not found', 404);
      }

      const stats = await this.couponService.getCouponStats(id);

      logAdminAction(adminId, 'view_coupon_details', {
        targetCouponId: id,
        ip: req.ip,
      });

      res.json({
        success: true,
        coupon: {
          ...coupon,
          value: Number(coupon.value),
          minAmount: Number(coupon.minAmount),
          maxDiscount: coupon.maxDiscount != null ? Number(coupon.maxDiscount) : null,
        },
        stats,
      });
    } catch (error) {
      logger.error('Admin getCouponById failed', {
        adminId,
        id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error instanceof AppError ? error : new AppError('Failed to fetch coupon', 503);
    }
  };

  /**
   * Create new coupon
   */
  public createCoupon = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const adminId = req.user!.id;

    try {
      let {
        code,
        type,
        value,
        minAmount = 0,
        maxDiscount,
        usageLimit,
        validFrom,
        validUntil,
        isActive = true,
      } = req.body as {
        code: string;
        type: CouponType;
        value: number;
        minAmount?: number;
        maxDiscount?: number | null;
        usageLimit?: number | null;
        validFrom?: string | Date | null;
        validUntil?: string | Date | null;
        isActive?: boolean;
      };

      // Normalize & validate
      code = normalizeCode(code);
      if (!code || code.length < 3) {
        throw new ValidationError('Coupon code is required (min 3 chars)');
      }
      if (!isCouponType(type)) {
        throw new ValidationError('Invalid coupon type');
      }
      value = Number(value);
      if (!Number.isFinite(value)) throw new ValidationError('Invalid value');

      if (type === 'PERCENTAGE') {
        if (value <= 0 || value > 100) {
          throw new ValidationError('Percentage value must be between 1 and 100');
        }
      } else {
        if (value <= 0) {
          throw new ValidationError('Fixed value must be greater than 0');
        }
      }

      minAmount = Number(minAmount ?? 0);
      if (!Number.isFinite(minAmount) || minAmount < 0) {
        throw new ValidationError('minAmount must be a non-negative number');
      }

      if (maxDiscount != null) {
        maxDiscount = Number(maxDiscount);
        if (!Number.isFinite(maxDiscount) || maxDiscount < 0) {
          throw new ValidationError('maxDiscount must be a non-negative number');
        }
      } else {
        maxDiscount = null;
      }

      if (usageLimit != null) {
        usageLimit = Math.floor(Number(usageLimit));
        if (!Number.isFinite(usageLimit) || usageLimit <= 0) {
          throw new ValidationError('usageLimit must be a positive integer');
        }
      } else {
        usageLimit = null;
      }

      const _validFrom = parseDateOrNull(validFrom);
      const _validUntil = parseDateOrNull(validUntil);
      if (_validFrom && _validUntil && _validUntil <= _validFrom) {
        throw new ValidationError('validUntil must be after validFrom');
      }

      // Unique code
      const existingCoupon = await prisma.coupon.findUnique({
        where: { code },
        select: { id: true },
      });
      if (existingCoupon) {
        throw new ValidationError('Coupon code already exists');
      }

      const coupon = await prisma.coupon.create({
        data: {
          code,
          type,
          value,
          minAmount,
          maxDiscount,
          usageLimit,
          validFrom: _validFrom,
          validUntil: _validUntil,
          isActive: !!isActive,
          createdBy: adminId,
        },
      });

      logAdminAction(adminId, 'create_coupon', {
        targetCouponId: coupon.id,
        code: coupon.code,
        type,
        value,
        ip: req.ip,
      });

      logger.info('Coupon created by admin', {
        adminId,
        couponId: coupon.id,
        code: coupon.code,
        type,
        value,
      });

      res.status(201).json({
        success: true,
        message: 'Coupon created successfully',
        coupon: {
          ...coupon,
          value: Number(coupon.value),
          minAmount: Number(coupon.minAmount),
          maxDiscount: coupon.maxDiscount != null ? Number(coupon.maxDiscount) : null,
        },
      });
    } catch (error) {
      logger.error('Admin createCoupon failed', {
        adminId,
        body: req.body,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error instanceof AppError ? error : new ValidationError('Failed to create coupon');
    }
  };

  /**
   * Update coupon
   */
  public updateCoupon = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const adminId = req.user!.id;
    const { id } = req.params;

    try {
      const updateData = { ...req.body };

      const existingCoupon = await prisma.coupon.findUnique({
        where: { id },
      });
      if (!existingCoupon) {
        throw new AppError('Coupon not found', 404);
      }

      // If code is provided, normalize & check uniqueness
      if (typeof updateData.code === 'string') {
        updateData.code = normalizeCode(updateData.code);
        if (updateData.code !== existingCoupon.code) {
          const codeExists = await prisma.coupon.findFirst({
            where: { code: updateData.code, id: { not: id } },
            select: { id: true },
          });
          if (codeExists) {
            throw new ValidationError('Coupon code already exists');
          }
        }
      }

      // If type/value provided, validate
      if (typeof updateData.type !== 'undefined') {
        if (!isCouponType(updateData.type)) throw new ValidationError('Invalid coupon type');
      }

      if (typeof updateData.value !== 'undefined') {
        const v = Number(updateData.value);
        if (!Number.isFinite(v)) throw new ValidationError('Invalid value');
        if ((updateData.type || existingCoupon.type) === 'PERCENTAGE') {
          if (v <= 0 || v > 100) throw new ValidationError('Percentage value must be between 1 and 100');
        } else {
          if (v <= 0) throw new ValidationError('Fixed value must be greater than 0');
        }
        updateData.value = v;
      }

      if (typeof updateData.minAmount !== 'undefined') {
        const m = Number(updateData.minAmount);
        if (!Number.isFinite(m) || m < 0) throw new ValidationError('minAmount must be a non-negative number');
        updateData.minAmount = m;
      }

      if (typeof updateData.maxDiscount !== 'undefined') {
        if (updateData.maxDiscount == null) {
          updateData.maxDiscount = null;
        } else {
          const md = Number(updateData.maxDiscount);
          if (!Number.isFinite(md) || md < 0) throw new ValidationError('maxDiscount must be a non-negative number');
          updateData.maxDiscount = md;
        }
      }

      if (typeof updateData.usageLimit !== 'undefined') {
        if (updateData.usageLimit == null) {
          updateData.usageLimit = null;
        } else {
          const ul = Math.floor(Number(updateData.usageLimit));
          if (!Number.isFinite(ul) || ul <= 0)
            throw new ValidationError('usageLimit must be a positive integer');
          updateData.usageLimit = ul;
        }
      }

      // Date normalization
      if (typeof updateData.validFrom !== 'undefined') {
        updateData.validFrom = parseDateOrNull(updateData.validFrom);
      }
      if (typeof updateData.validUntil !== 'undefined') {
        updateData.validUntil = parseDateOrNull(updateData.validUntil);
      }
      if (updateData.validFrom && updateData.validUntil && updateData.validUntil <= updateData.validFrom) {
        throw new ValidationError('validUntil must be after validFrom');
      }

      // Restrict updates if used before
      if (existingCoupon.usedCount > 0) {
        const allowedFields = new Set(['isActive', 'validFrom', 'validUntil', 'usageLimit']);
        const updateFields = Object.keys(updateData);
        const restricted = updateFields.filter((f) => !allowedFields.has(f));
        if (restricted.length > 0) {
          throw new ValidationError('Cannot modify code, type, value, minAmount, or maxDiscount of a used coupon');
        }
      }

      const updatedCoupon = await prisma.coupon.update({
        where: { id },
        data: updateData,
      });

      logAdminAction(adminId, 'update_coupon', {
        targetCouponId: id,
        changes: Object.keys(updateData),
        ip: req.ip,
      });

      logger.info('Coupon updated by admin', {
        adminId,
        couponId: id,
        changes: Object.keys(updateData),
      });

      res.json({
        success: true,
        message: 'Coupon updated successfully',
        coupon: {
          ...updatedCoupon,
          value: Number(updatedCoupon.value),
          minAmount: Number(updatedCoupon.minAmount),
          maxDiscount: updatedCoupon.maxDiscount != null ? Number(updatedCoupon.maxDiscount) : null,
        },
      });
    } catch (error) {
      logger.error('Admin updateCoupon failed', {
        adminId,
        id,
        body: req.body,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error instanceof AppError ? error : new AppError('Failed to update coupon', 503);
    }
  };

  /**
   * Delete coupon
   */
  public deleteCoupon = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const adminId = req.user!.id;
    const { id } = req.params;

    try {
      const coupon = await prisma.coupon.findUnique({
        where: { id },
        select: { code: true, usedCount: true },
      });

      if (!coupon) throw new AppError('Coupon not found', 404);

      if (coupon.usedCount > 0) {
        await prisma.coupon.update({
          where: { id },
          data: { isActive: false },
        });

        logAdminAction(adminId, 'deactivate_coupon', {
          targetCouponId: id,
          code: coupon.code,
          reason: 'Cannot delete used coupon',
          ip: req.ip,
        });

        res.json({
          success: true,
          message: 'Coupon deactivated (cannot delete used coupons)',
        });
      } else {
        await prisma.coupon.delete({ where: { id } });

        logAdminAction(adminId, 'delete_coupon', {
          targetCouponId: id,
          code: coupon.code,
          ip: req.ip,
        });

        logger.info('Coupon deleted by admin', {
          adminId,
          couponId: id,
          code: coupon.code,
        });

        res.json({ success: true, message: 'Coupon deleted successfully' });
      }
    } catch (error) {
      logger.error('Admin deleteCoupon failed', {
        adminId,
        id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error instanceof AppError ? error : new AppError('Failed to delete coupon', 503);
    }
  };

  /**
   * Get coupon usage details
   */
  public getCouponUsage = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const adminId = req.user!.id;
    const { id } = req.params;
    const { page = '1', limit = '20' } = req.query as Record<string, string>;

    try {
      const _page = clampInt(page, 1, 100000, 1);
      const _limit = clampInt(limit, 1, 200, 20);
      const skip = (_page - 1) * _limit;

      const [usages, total, stats] = await Promise.all([
        prisma.couponUsage.findMany({
          where: { couponId: id },
          skip,
          take: _limit,
          orderBy: { usedAt: 'desc' },
          include: {
            user: { select: { fullName: true, email: true } },
            order: { select: { productId: true, totalPrice: true, status: true } },
          },
        }),
        prisma.couponUsage.count({ where: { couponId: id } }),
        this.couponService.getCouponStats(id),
      ]);

      logAdminAction(adminId, 'view_coupon_usage', {
        targetCouponId: id,
        ip: req.ip,
      });

      res.json({
        success: true,
        usages: usages.map((u) => ({
          ...u,
          discountAmount: Number(u.discountAmount),
          order: u.order
            ? {
                ...u.order,
                totalPrice: Number(u.order.totalPrice),
              }
            : null,
        })),
        stats,
        pagination: {
          page: _page,
          limit: _limit,
          total,
          pages: Math.ceil(total / _limit),
        },
      });
    } catch (error) {
      logger.error('Admin getCouponUsage failed', {
        adminId,
        id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new AppError('Failed to fetch coupon usage', 503);
    }
  };
}
