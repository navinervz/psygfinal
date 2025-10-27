import { Response } from 'express';
import { prisma } from '@/config/database';
import { AuthenticatedRequest } from '@/middleware/auth';
import { logger, logAdminAction } from '@/utils/logger';
import { PriceUpdateService } from '@/services/PriceUpdateService';
import { AppError } from '@/utils/AppError';

type DashboardData = {
  stats: {
    totalUsers: number;
    totalOrders: number;
    totalRevenue: number;
    pendingOrders: number;
    todayOrders: number;
    todayRevenue: number;
    weekOrders: number;
    weekRevenue: number;
    monthOrders: number;
    monthRevenue: number;
    activeCoupons: number;
  };
  recentOrders: Array<{
    id: string;
    productId: string;
    optionName: string | null;
    totalPrice: number;
    status: string;
    createdAt: Date;
    user: { id: string; fullName: string | null; email: string | null };
  }>;
  productSales: Array<{
    productId: string;
    totalOrders: number;
    totalRevenue: number;
  }>;
  dailyRevenueChart: Array<{ date: string; revenue: number }>;
  priceService: ReturnType<PriceUpdateService['getStatus']>;
  currentPrices: Awaited<ReturnType<PriceUpdateService['getCurrentPrices']>>;
  timestamp: string;
};

export class AdminDashboardController {
  private priceUpdateService = new PriceUpdateService();

  /**
   * GET /api/admin/dashboard
   * داشبورد تجمیعی ادمین
   */
  public getDashboard = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const adminId = req.user!.id;

    try {
      logAdminAction(adminId, 'view_dashboard', {
        ip: req.ip,
        ua: req.get('User-Agent'),
      });

      const data = await this.buildDashboardData();

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      logger.error('Error building admin dashboard:', {
        adminId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new AppError('Failed to load dashboard', 503);
    }
  };

  /**
   * GET /api/admin/dashboard/stats
   * آمار جزئی داشبورد (همان ساختار، برای مصرف سبک‌تر فرانت)
   */
  public getStats = async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const data = await this.buildDashboardData();
      res.json({
        success: true,
        data,
      });
    } catch (error) {
      logger.error('Error getting admin dashboard stats:', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new AppError('Failed to get dashboard stats', 503);
    }
  };

  /**
   * GET /api/admin/system/health
   */
  public getSystemHealth = async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      // DB ping
      await prisma.$queryRaw`SELECT 1`;

      const systemInfo = {
        database: 'connected',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        nodeVersion: process.version,
        environment: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
      };

      const priceServiceStatus = this.priceUpdateService.getStatus();

      res.json({
        success: true,
        health: 'healthy',
        system: systemInfo,
        priceService: priceServiceStatus,
      });
    } catch (error) {
      logger.error('System health check failed:', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(503).json({
        success: false,
        health: 'unhealthy',
        error: 'Database connection failed',
        timestamp: new Date().toISOString(),
      });
    }
  };

  /**
   * GET /api/admin/system/logs?type=combined&lines=100
   */
  public getSystemLogs = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const type = String(req.query.type || 'combined');
    const lines = clampInt(req.query.lines, 1, 1000, 100);

    try {
      const adminLogs = await prisma.adminLog.findMany({
        take: lines,
        orderBy: { createdAt: 'desc' },
        include: {
          admin: { select: { fullName: true, email: true } },
        },
      });

      res.json({
        success: true,
        logs: adminLogs,
        type,
        lines,
      });
    } catch (error) {
      logger.error('Failed to get system logs:', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new AppError('Failed to get system logs', 503);
    }
  };

  /**
   * POST /api/admin/system/cleanup
   */
  public cleanupSystem = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const adminId = req.user!.id;

    try {
      const [deletedLogs, deletedPriceHistory] = await Promise.all([
        prisma.adminLog.deleteMany({
          where: { createdAt: { lt: daysAgo(90) } },
        }),
        prisma.priceHistory.deleteMany({
          where: { createdAt: { lt: daysAgo(30) } },
        }),
      ]);

      logAdminAction(adminId, 'system_cleanup', {
        deletedLogs: deletedLogs.count,
        deletedPriceHistory: deletedPriceHistory.count,
        ip: req.ip,
        ua: req.get('User-Agent'),
      });

      res.json({
        success: true,
        message: 'System cleanup completed',
        cleaned: {
          adminLogs: deletedLogs.count,
          priceHistory: deletedPriceHistory.count,
        },
      });
    } catch (error) {
      logger.error('System cleanup failed:', {
        adminId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new AppError('Failed to cleanup system', 503);
    }
  };

  /* -------------------------------- Helpers ------------------------------- */

  private async buildDashboardData(): Promise<DashboardData> {
    // محدوده‌های زمانی
    const todayStart = startOfToday();
    const weekAgo = daysAgo(7);
    const monthStart = startOfMonth();
    const last30Days = daysAgo(30);

    const [
      totalUsers,
      totalOrders,
      totalRevenueAgg,
      pendingOrders,
      todayOrders,
      todayRevenueAgg,
      weekOrders,
      weekRevenueAgg,
      monthOrders,
      monthRevenueAgg,
      activeCoupons,
      recentOrdersRaw,
      productSalesRaw,
      last30CompletedOrders,
      priceServiceStatus,
      currentPrices,
    ] = await Promise.all([
      prisma.user.count({ where: { isAdmin: false } }),
      prisma.order.count(),
      prisma.order.aggregate({ where: { status: 'COMPLETED' }, _sum: { totalPrice: true } }),
      prisma.order.count({ where: { status: 'PENDING' } }),
      prisma.order.count({ where: { createdAt: { gte: todayStart } } }),
      prisma.order.aggregate({
        where: { status: 'COMPLETED', createdAt: { gte: todayStart } },
        _sum: { totalPrice: true },
      }),
      prisma.order.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.order.aggregate({
        where: { status: 'COMPLETED', createdAt: { gte: weekAgo } },
        _sum: { totalPrice: true },
      }),
      prisma.order.count({
        where: { createdAt: { gte: monthStart } },
      }),
      prisma.order.aggregate({
        where: { status: 'COMPLETED', createdAt: { gte: monthStart } },
        _sum: { totalPrice: true },
      }),
      prisma.coupon.count({
        where: { isActive: true, OR: [{ validUntil: null }, { validUntil: { gt: new Date() } }] },
      }),
      prisma.order.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, fullName: true, email: true } } },
      }),
      prisma.order.groupBy({
        by: ['productId'],
        where: { status: 'COMPLETED' },
        _count: { id: true },
        _sum: { totalPrice: true },
        orderBy: { _count: { id: 'desc' } },
      }),
      prisma.order.findMany({
        where: { status: 'COMPLETED', createdAt: { gte: last30Days } },
        select: { totalPrice: true, createdAt: true },
      }),
      this.priceUpdateService.getStatus(),
      this.priceUpdateService.getCurrentPrices(),
    ]);

    // چارت درآمد روزانه (۳۰ روز اخیر) — تجمیع سمت اپ
    const dailyMap = new Map<string, number>();
    for (const o of last30CompletedOrders) {
      const key = toDateKey(o.createdAt);
      const prev = dailyMap.get(key) || 0;
      dailyMap.set(key, prev + Number(o.totalPrice));
    }
    const dailyRevenueChart = Array.from(dailyMap.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, revenue]) => ({ date, revenue }));

    const data: DashboardData = {
      stats: {
        totalUsers,
        totalOrders,
        totalRevenue: Number(totalRevenueAgg._sum.totalPrice || 0),
        pendingOrders,
        todayOrders,
        todayRevenue: Number(todayRevenueAgg._sum.totalPrice || 0),
        weekOrders,
        weekRevenue: Number(weekRevenueAgg._sum.totalPrice || 0),
        monthOrders,
        monthRevenue: Number(monthRevenueAgg._sum.totalPrice || 0),
        activeCoupons,
      },
      recentOrders: recentOrdersRaw.map((order) => ({
        id: order.id,
        productId: order.productId,
        optionName: order.optionName,
        totalPrice: Number(order.totalPrice),
        status: order.status,
        createdAt: order.createdAt,
        user: {
          id: order.user.id,
          fullName: order.user.fullName,
          email: order.user.email,
        },
      })),
      productSales: productSalesRaw.map((p) => ({
        productId: p.productId,
        totalOrders: p._count.id,
        totalRevenue: Number(p._sum.totalPrice || 0),
      })),
      dailyRevenueChart,
      priceService: priceServiceStatus,
      currentPrices,
      timestamp: new Date().toISOString(),
    };

    return data;
  }
}

/* ------------------------------ utils -------------------------------- */

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function startOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
}
function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}
function toDateKey(d: Date): string {
  // YYYY-MM-DD
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const dd = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
function clampInt(val: unknown, min: number, max: number, fallback: number): number {
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}
