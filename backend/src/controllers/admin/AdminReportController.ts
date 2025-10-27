import { Response } from 'express';
import { prisma } from '@/config/database';
import { AuthenticatedRequest } from '@/middleware/auth';
import { logger, logAdminAction } from '@/utils/logger';
import { AppError } from '@/utils/AppError';

/* --------------------------------- helpers -------------------------------- */
const clampInt = (val: unknown, min: number, max: number, fallback: number) => {
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
};

const parseDateOnly = (v: unknown): string | null => {
  // ورودی‌های ما yyyy-mm-dd هستند (از query). اگر ISO کامل بود، فقط بخش date را برمی‌داریم.
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  const datePart = s.includes('T') ? s.split('T')[0] : s;
  // چک ساده yyyy-mm-dd
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null;
  const d = new Date(datePart + 'T00:00:00Z');
  if (!Number.isFinite(d.getTime())) return null;
  return datePart;
};

const ensureDateRange = (start: string, end: string, maxDays = 370) => {
  const s = new Date(start + 'T00:00:00Z').getTime();
  const e = new Date(end + 'T23:59:59Z').getTime();
  if (e < s) throw new AppError('endDate must be on/after startDate', 400);
  const diffDays = Math.ceil((e - s) / (24 * 3600 * 1000));
  if (diffDays > maxDays) throw new AppError(`Date range too large (>${maxDays} days)`, 400);
  return { s, e, diffDays };
};

const validGroupBy = (v: any) => (v === 'day' || v === 'week' || v === 'month') ? v : 'day';

export class AdminReportController {
  /**
   * Get sales report
   */
  public getSalesReport = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const adminId = req.user!.id;

    // پیش‌فرض: 30 روز اخیر (yyyy-mm-dd)
    const defStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const defEnd = new Date().toISOString().split('T')[0];

    const startDate = parseDateOnly(req.query.startDate ?? defStart) ?? defStart;
    const endDate = parseDateOnly(req.query.endDate ?? defEnd) ?? defEnd;
    const groupBy = validGroupBy(req.query.groupBy);

    try {
      ensureDateRange(startDate, endDate, 370);

      // Sales by time period
      const salesByPeriod = await this.getSalesByPeriod(startDate, endDate, groupBy);

      // Sales by product
      const salesByProduct = await prisma.order.groupBy({
        by: ['productId', 'optionName'],
        where: {
          createdAt: {
            gte: new Date(startDate + 'T00:00:00Z'),
            lte: new Date(endDate + 'T23:59:59Z'),
          },
          status: { in: ['COMPLETED', 'PROCESSING'] },
        },
        _count: { id: true },
        _sum: {
          quantity: true,
          totalPrice: true,
        },
        orderBy: {
          _sum: {
            totalPrice: 'desc',
          },
        },
      });

      // Sales by status
      const salesByStatus = await prisma.order.groupBy({
        by: ['status'],
        where: {
          createdAt: {
            gte: new Date(startDate + 'T00:00:00Z'),
            lte: new Date(endDate + 'T23:59:59Z'),
          },
        },
        _count: { id: true },
        _sum: { totalPrice: true },
      });

      // Top customers (10 userId)
      const topCustomers = await prisma.order.groupBy({
        by: ['userId'],
        where: {
          createdAt: {
            gte: new Date(startDate + 'T00:00:00Z'),
            lte: new Date(endDate + 'T23:59:59Z'),
          },
          status: { in: ['COMPLETED', 'PROCESSING'] },
        },
        _count: { id: true },
        _sum: { totalPrice: true },
        orderBy: { _sum: { totalPrice: 'desc' } },
        take: 10,
      });

      // جلوگیری از N+1: یکجا جزییات کاربران را بگیر
      const topUserIds = topCustomers.map((c) => c.userId);
      const usersMap = new Map(
        (topUserIds.length
          ? await prisma.user.findMany({
              where: { id: { in: topUserIds } },
              select: { id: true, fullName: true, email: true },
            })
          : []
        ).map((u) => [u.id, u]),
      );

      const topCustomersWithDetails = topCustomers.map((c) => ({
        userId: c.userId,
        user: usersMap.get(c.userId) || null,
        totalOrders: c._count.id,
        totalSpent: Number(c._sum.totalPrice || 0),
      }));

      // Summary statistics
      const [summary, completedOrders, uniqueCustomers] = await Promise.all([
        prisma.order.aggregate({
          where: {
            createdAt: {
              gte: new Date(startDate + 'T00:00:00Z'),
              lte: new Date(endDate + 'T23:59:59Z'),
            },
          },
          _count: { id: true },
          _sum: { totalPrice: true },
          _avg: { totalPrice: true },
        }),
        prisma.order.count({
          where: {
            createdAt: {
              gte: new Date(startDate + 'T00:00:00Z'),
              lte: new Date(endDate + 'T23:59:59Z'),
            },
            status: 'COMPLETED',
          },
        }),
        prisma.order.findMany({
          where: {
            createdAt: {
              gte: new Date(startDate + 'T00:00:00Z'),
              lte: new Date(endDate + 'T23:59:59Z'),
            },
          },
          select: { userId: true },
          distinct: ['userId'],
        }),
      ]);

      logAdminAction(adminId, 'view_sales_report', {
        startDate,
        endDate,
        groupBy,
        ip: req.ip,
      });

      res.json({
        success: true,
        report: {
          type: 'sales',
          period: { startDate, endDate, groupBy },
          summary: {
            totalOrders: summary._count.id,
            totalRevenue: Number(summary._sum.totalPrice || 0),
            avgOrderValue: Number(summary._avg.totalPrice || 0),
            completedOrders,
            uniqueCustomers: uniqueCustomers.length,
          },
          salesByPeriod: salesByPeriod.map((item) => ({
            ...item,
            totalRevenue: Number(item.totalRevenue),
            avgOrderValue: Number(item.avgOrderValue),
          })),
          salesByProduct: salesByProduct.map((item) => ({
            productId: item.productId,
            optionName: item.optionName,
            totalOrders: item._count.id,
            totalQuantity: item._sum.quantity || 0,
            totalRevenue: Number(item._sum.totalPrice || 0),
          })),
          salesByStatus: salesByStatus.map((item) => ({
            status: item.status,
            count: item._count.id,
            revenue: Number(item._sum.totalPrice || 0),
          })),
          topCustomers: topCustomersWithDetails,
        },
      });
    } catch (error) {
      logger.error('Sales report generation failed', {
        adminId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error instanceof AppError ? error : new AppError('Failed to generate sales report', 503);
    }
  };

  /**
   * Get revenue report
   */
  public getRevenueReport = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const adminId = req.user!.id;

    const defStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const defEnd = new Date().toISOString().split('T')[0];

    const startDate = parseDateOnly(req.query.startDate ?? defStart) ?? defStart;
    const endDate = parseDateOnly(req.query.endDate ?? defEnd) ?? defEnd;

    try {
      ensureDateRange(startDate, endDate, 370);

      // Revenue by payment method
      const [rialRevenue, cryptoRevenue, dailyRevenueRaw] = await Promise.all([
        prisma.paymentRequest.aggregate({
          where: {
            createdAt: {
              gte: new Date(startDate + 'T00:00:00Z'),
              lte: new Date(endDate + 'T23:59:59Z'),
            },
            status: 'COMPLETED',
          },
          _sum: { amount: true },
          _count: { id: true },
        }),
        prisma.cryptoPaymentRequest.aggregate({
          where: {
            createdAt: {
              gte: new Date(startDate + 'T00:00:00Z'),
              lte: new Date(endDate + 'T23:59:59Z'),
            },
            status: 'COMPLETED',
          },
          _sum: { amount: true },
          _count: { id: true },
        }),
        this.getDailyRevenue(startDate, endDate),
      ]);

      logAdminAction(adminId, 'view_revenue_report', {
        startDate,
        endDate,
        ip: req.ip,
      });

      res.json({
        success: true,
        report: {
          type: 'revenue',
          period: { startDate, endDate },
          summary: {
            totalRialRevenue: Number(rialRevenue._sum.amount || 0),
            totalCryptoRevenue: Number(cryptoRevenue._sum.amount || 0),
            totalRevenue:
              Number(rialRevenue._sum.amount || 0) + Number(cryptoRevenue._sum.amount || 0),
            totalRialTransactions: rialRevenue._count.id,
            totalCryptoTransactions: cryptoRevenue._count.id,
          },
          dailyRevenue: dailyRevenueRaw.map((r) => ({
            date: r.date,
            rialRevenue: Number(r.rialRevenue || 0),
            cryptoRevenue: Number(r.cryptoRevenue || 0),
            total: Number(r.rialRevenue || 0) + Number(r.cryptoRevenue || 0),
          })),
        },
      });
    } catch (error) {
      logger.error('Revenue report generation failed', {
        adminId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error instanceof AppError ? error : new AppError('Failed to generate revenue report', 503);
    }
  };

  /**
   * Get users report
   */
  public getUsersReport = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const adminId = req.user!.id;

    const defStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const defEnd = new Date().toISOString().split('T')[0];

    const startDate = parseDateOnly(req.query.startDate ?? defStart) ?? defStart;
    const endDate = parseDateOnly(req.query.endDate ?? defEnd) ?? defEnd;

    try {
      ensureDateRange(startDate, endDate, 370);

      // User registration trends (MySQL)
      const userRegistrations = await prisma.$queryRaw<any[]>`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as newUsers,
          COUNT(CASE WHEN auth_type = 'EMAIL' THEN 1 END) as emailUsers,
          COUNT(CASE WHEN auth_type = 'WEB3' THEN 1 END) as web3Users
        FROM users 
        WHERE DATE(created_at) BETWEEN ${startDate} AND ${endDate}
          AND is_admin = false
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `;

      // User activity (top 50 recent)
      const userActivity = await prisma.user.findMany({
        where: {
          createdAt: {
            gte: new Date(startDate + 'T00:00:00Z'),
            lte: new Date(endDate + 'T23:59:59Z'),
          },
          isAdmin: false,
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          authType: true,
          createdAt: true,
          _count: { select: { orders: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      // User summary + auth type counts
      const [userSummary, authTypeCounts] = await Promise.all([
        prisma.user.aggregate({
          where: {
            createdAt: {
              gte: new Date(startDate + 'T00:00:00Z'),
              lte: new Date(endDate + 'T23:59:59Z'),
            },
            isAdmin: false,
          },
          _count: { id: true },
          _avg: { walletBalanceRial: true },
        }),
        prisma.user.groupBy({
          by: ['authType'],
          where: {
            createdAt: {
              gte: new Date(startDate + 'T00:00:00Z'),
              lte: new Date(endDate + 'T23:59:59Z'),
            },
            isAdmin: false,
          },
          _count: { id: true },
        }),
      ]);

      logAdminAction(adminId, 'view_users_report', {
        startDate,
        endDate,
        ip: req.ip,
      });

      res.json({
        success: true,
        report: {
          type: 'users',
          period: { startDate, endDate },
          summary: {
            totalUsers: userSummary._count.id,
            avgWalletBalance: Number(userSummary._avg.walletBalanceRial || 0),
            authTypeCounts: authTypeCounts.map((item) => ({
              authType: item.authType,
              count: item._count.id,
            })),
          },
          userRegistrations: userRegistrations.map((item) => ({
            date: item.date,
            newUsers: Number(item.newUsers),
            emailUsers: Number(item.emailUsers),
            web3Users: Number(item.web3Users),
          })),
          userActivity,
        },
      });
    } catch (error) {
      logger.error('Users report generation failed', {
        adminId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error instanceof AppError ? error : new AppError('Failed to generate users report', 503);
    }
  };

  /**
   * Get products report
   */
  public getProductsReport = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const adminId = req.user!.id;

    const defStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const defEnd = new Date().toISOString().split('T')[0];

    const startDate = parseDateOnly(req.query.startDate ?? defStart) ?? defStart;
    const endDate = parseDateOnly(req.query.endDate ?? defEnd) ?? defEnd;

    try {
      ensureDateRange(startDate, endDate, 370);

      // Product performance
      const productPerformance = await prisma.order.groupBy({
        by: ['productId', 'optionName'],
        where: {
          createdAt: {
            gte: new Date(startDate + 'T00:00:00Z'),
            lte: new Date(endDate + 'T23:59:59Z'),
          },
          status: { in: ['COMPLETED', 'PROCESSING'] },
        },
        _count: { id: true },
        _sum: {
          quantity: true,
          totalPrice: true,
        },
        _avg: { totalPrice: true },
        orderBy: { _sum: { totalPrice: 'desc' } },
      });

      // Product trends (daily sales)
      const productTrends = await prisma.$queryRaw<any[]>`
        SELECT 
          DATE(created_at) as date,
          product_id as productId,
          COUNT(*) as ordersCount,
          SUM(total_price) as revenue
        FROM orders 
        WHERE DATE(created_at) BETWEEN ${startDate} AND ${endDate}
          AND status IN ('COMPLETED', 'PROCESSING')
        GROUP BY DATE(created_at), product_id
        ORDER BY date ASC, product_id
      `;

      // Unique customers per product (batched)
      const productCustomers = await Promise.all(
        productPerformance.map(async (p) => {
          const uniq = await prisma.order.findMany({
            where: {
              productId: p.productId,
              optionName: p.optionName,
              createdAt: {
                gte: new Date(startDate + 'T00:00:00Z'),
                lte: new Date(endDate + 'T23:59:59Z'),
              },
              status: { in: ['COMPLETED', 'PROCESSING'] },
            },
            select: { userId: true },
            distinct: ['userId'],
          });
          return { productId: p.productId, optionName: p.optionName, uniqueCustomers: uniq.length };
        }),
      );

      logAdminAction(adminId, 'view_products_report', {
        startDate,
        endDate,
        ip: req.ip,
      });

      res.json({
        success: true,
        report: {
          type: 'products',
          period: { startDate, endDate },
          productPerformance: productPerformance.map((item) => {
            const c = productCustomers.find(
              (x) => x.productId === item.productId && x.optionName === item.optionName,
            );
            return {
              productId: item.productId,
              optionName: item.optionName,
              totalOrders: item._count.id,
              totalQuantity: item._sum.quantity || 0,
              totalRevenue: Number(item._sum.totalPrice || 0),
              avgOrderValue: Number(item._avg.totalPrice || 0),
              uniqueCustomers: c?.uniqueCustomers || 0,
            };
          }),
          productTrends: productTrends.map((item) => ({
            date: item.date,
            productId: item.productId,
            ordersCount: Number(item.ordersCount),
            revenue: Number(item.revenue || 0),
          })),
        },
      });
    } catch (error) {
      logger.error('Products report generation failed', {
        adminId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error instanceof AppError ? error : new AppError('Failed to generate products report', 503);
    }
  };

  /**
   * Get payments report
   */
  public getPaymentsReport = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const adminId = req.user!.id;

    const defStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const defEnd = new Date().toISOString().split('T')[0];

    const startDate = parseDateOnly(req.query.startDate ?? defStart) ?? defStart;
    const endDate = parseDateOnly(req.query.endDate ?? defEnd) ?? defEnd;

    try {
      ensureDateRange(startDate, endDate, 370);

      // Payment method breakdown
      const [rialPayments, cryptoPayments, failedPayments] = await Promise.all([
        prisma.paymentRequest.groupBy({
          by: ['status'],
          where: {
            createdAt: {
              gte: new Date(startDate + 'T00:00:00Z'),
              lte: new Date(endDate + 'T23:59:59Z'),
            },
          },
          _count: { id: true },
          _sum: { amount: true },
        }),
        prisma.cryptoPaymentRequest.groupBy({
          by: ['currency', 'status'],
          where: {
            createdAt: {
              gte: new Date(startDate + 'T00:00:00Z'),
              lte: new Date(endDate + 'T23:59:59Z'),
            },
          },
          _count: { id: true },
          _sum: { amount: true },
        }),
        prisma.$queryRaw<any[]>`
          SELECT date, SUM(failedCount) as failedCount, paymentType FROM (
            SELECT 
              DATE(created_at) as date,
              COUNT(*) as failedCount,
              'rial' as paymentType
            FROM payment_requests
            WHERE DATE(created_at) BETWEEN ${startDate} AND ${endDate}
              AND status = 'FAILED'
            GROUP BY DATE(created_at)
            UNION ALL
            SELECT 
              DATE(created_at) as date,
              COUNT(*) as failedCount,
              'crypto' as paymentType
            FROM crypto_payment_requests
            WHERE DATE(created_at) BETWEEN ${startDate} AND ${endDate}
              AND status = 'FAILED'
            GROUP BY DATE(created_at)
          ) t
          GROUP BY date, paymentType
          ORDER BY date ASC
        `,
      ]);

      logAdminAction(adminId, 'view_payments_report', {
        startDate,
        endDate,
        ip: req.ip,
      });

      res.json({
        success: true,
        report: {
          type: 'payments',
          period: { startDate, endDate },
          paymentBreakdown: {
            rial: rialPayments.map((item) => ({
              status: item.status,
              count: item._count.id,
              totalAmount: Number(item._sum.amount || 0),
            })),
            crypto: cryptoPayments.map((item) => ({
              currency: item.currency,
              status: item.status,
              count: item._count.id,
              totalAmount: Number(item._sum.amount || 0),
            })),
          },
          failedPayments: failedPayments.map((item) => ({
            date: item.date,
            failedCount: Number(item.failedCount),
            paymentType: item.paymentType,
          })),
        },
      });
    } catch (error) {
      logger.error('Payments report generation failed', {
        adminId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error instanceof AppError ? error : new AppError('Failed to generate payments report', 503);
    }
  };

  /**
   * Export report
   * فعلاً خروجی JSON می‌دهیم (Attachment). در صورت نیاز CSV اضافه می‌شود.
   */
  public exportReport = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const adminId = req.user!.id;
    const { type } = req.params;
    const format = String(req.query.format || 'json').toLowerCase();

    // فقط JSON پشتیبانی می‌کنیم؛ درخواست CSV → خطای معتبر
    if (format !== 'json') {
      throw new AppError('Only JSON export is supported at the moment', 400);
    }

    // برای این‌که پاسخ یک‌بار ارسال شود، زیر فانکشن‌ها را صدا نمی‌زنیم (چون خودشان res می‌فرستند)
    try {
      const defStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const defEnd = new Date().toISOString().split('T')[0];

      const startDate = parseDateOnly(req.query.startDate ?? defStart) ?? defStart;
      const endDate = parseDateOnly(req.query.endDate ?? defEnd) ?? defEnd;
      ensureDateRange(startDate, endDate, 370);

      let payload: any;

      if (type === 'sales') {
        const groupBy = validGroupBy(req.query.groupBy);
        const [salesByPeriod, salesByProduct, salesByStatus, summaryAgg, completedOrders, uniqueCustomers] =
          await Promise.all([
            this.getSalesByPeriod(startDate, endDate, groupBy),
            prisma.order.groupBy({
              by: ['productId', 'optionName'],
              where: {
                createdAt: { gte: new Date(startDate + 'T00:00:00Z'), lte: new Date(endDate + 'T23:59:59Z') },
                status: { in: ['COMPLETED', 'PROCESSING'] },
              },
              _count: { id: true },
              _sum: { quantity: true, totalPrice: true },
              orderBy: { _sum: { totalPrice: 'desc' } },
            }),
            prisma.order.groupBy({
              by: ['status'],
              where: { createdAt: { gte: new Date(startDate + 'T00:00:00Z'), lte: new Date(endDate + 'T23:59:59Z') } },
              _count: { id: true },
              _sum: { totalPrice: true },
            }),
            prisma.order.aggregate({
              where: { createdAt: { gte: new Date(startDate + 'T00:00:00Z'), lte: new Date(endDate + 'T23:59:59Z') } },
              _count: { id: true },
              _sum: { totalPrice: true },
              _avg: { totalPrice: true },
            }),
            prisma.order.count({
              where: {
                createdAt: { gte: new Date(startDate + 'T00:00:00Z'), lte: new Date(endDate + 'T23:59:59Z') },
                status: 'COMPLETED',
              },
            }),
            prisma.order.findMany({
              where: { createdAt: { gte: new Date(startDate + 'T00:00:00Z'), lte: new Date(endDate + 'T23:59:59Z') } },
              select: { userId: true },
              distinct: ['userId'],
            }),
          ]);

        payload = {
          type: 'sales',
          period: { startDate, endDate, groupBy },
          summary: {
            totalOrders: summaryAgg._count.id,
            totalRevenue: Number(summaryAgg._sum.totalPrice || 0),
            avgOrderValue: Number(summaryAgg._avg.totalPrice || 0),
            completedOrders,
            uniqueCustomers: uniqueCustomers.length,
          },
          salesByPeriod: salesByPeriod.map((x) => ({
            ...x,
            totalRevenue: Number(x.totalRevenue || 0),
            avgOrderValue: Number(x.avgOrderValue || 0),
          })),
          salesByProduct: salesByProduct.map((x) => ({
            productId: x.productId,
            optionName: x.optionName,
            totalOrders: x._count.id,
            totalQuantity: x._sum.quantity || 0,
            totalRevenue: Number(x._sum.totalPrice || 0),
          })),
          salesByStatus: salesByStatus.map((x) => ({
            status: x.status,
            count: x._count.id,
            revenue: Number(x._sum.totalPrice || 0),
          })),
        };
      } else if (type === 'revenue') {
        const [rial, crypto, daily] = await Promise.all([
          prisma.paymentRequest.aggregate({
            where: {
              createdAt: { gte: new Date(startDate + 'T00:00:00Z'), lte: new Date(endDate + 'T23:59:59Z') },
              status: 'COMPLETED',
            },
            _sum: { amount: true },
            _count: { id: true },
          }),
          prisma.cryptoPaymentRequest.aggregate({
            where: {
              createdAt: { gte: new Date(startDate + 'T00:00:00Z'), lte: new Date(endDate + 'T23:59:59Z') },
              status: 'COMPLETED',
            },
            _sum: { amount: true },
            _count: { id: true },
          }),
          this.getDailyRevenue(startDate, endDate),
        ]);

        payload = {
          type: 'revenue',
          period: { startDate, endDate },
          summary: {
            totalRialRevenue: Number(rial._sum.amount || 0),
            totalCryptoRevenue: Number(crypto._sum.amount || 0),
            totalRevenue: Number(rial._sum.amount || 0) + Number(crypto._sum.amount || 0),
            totalRialTransactions: rial._count.id,
            totalCryptoTransactions: crypto._count.id,
          },
          dailyRevenue: daily.map((r) => ({
            date: r.date,
            rialRevenue: Number(r.rialRevenue || 0),
            cryptoRevenue: Number(r.cryptoRevenue || 0),
            total: Number(r.rialRevenue || 0) + Number(r.cryptoRevenue || 0),
          })),
        };
      } else if (type === 'users') {
        const [regs, summary, auths] = await Promise.all([
          prisma.$queryRaw<any[]>`
            SELECT 
              DATE(created_at) as date,
              COUNT(*) as newUsers,
              COUNT(CASE WHEN auth_type = 'EMAIL' THEN 1 END) as emailUsers,
              COUNT(CASE WHEN auth_type = 'WEB3' THEN 1 END) as web3Users
            FROM users 
            WHERE DATE(created_at) BETWEEN ${startDate} AND ${endDate}
              AND is_admin = false
            GROUP BY DATE(created_at)
            ORDER BY date ASC
          `,
          prisma.user.aggregate({
            where: {
              createdAt: { gte: new Date(startDate + 'T00:00:00Z'), lte: new Date(endDate + 'T23:59:59Z') },
              isAdmin: false,
            },
            _count: { id: true },
            _avg: { walletBalanceRial: true },
          }),
          prisma.user.groupBy({
            by: ['authType'],
            where: {
              createdAt: { gte: new Date(startDate + 'T00:00:00Z'), lte: new Date(endDate + 'T23:59:59Z') },
              isAdmin: false,
            },
            _count: { id: true },
          }),
        ]);

        payload = {
          type: 'users',
          period: { startDate, endDate },
          summary: {
            totalUsers: summary._count.id,
            avgWalletBalance: Number(summary._avg.walletBalanceRial || 0),
            authTypeCounts: auths.map((a) => ({ authType: a.authType, count: a._count.id })),
          },
          userRegistrations: regs.map((r) => ({
            date: r.date,
            newUsers: Number(r.newUsers),
            emailUsers: Number(r.emailUsers),
            web3Users: Number(r.web3Users),
          })),
        };
      } else if (type === 'products') {
        const [perf, trends] = await Promise.all([
          prisma.order.groupBy({
            by: ['productId', 'optionName'],
            where: {
              createdAt: { gte: new Date(startDate + 'T00:00:00Z'), lte: new Date(endDate + 'T23:59:59Z') },
              status: { in: ['COMPLETED', 'PROCESSING'] },
            },
            _count: { id: true },
            _sum: { quantity: true, totalPrice: true },
            _avg: { totalPrice: true },
            orderBy: { _sum: { totalPrice: 'desc' } },
          }),
          prisma.$queryRaw<any[]>`
            SELECT 
              DATE(created_at) as date,
              product_id as productId,
              COUNT(*) as ordersCount,
              SUM(total_price) as revenue
            FROM orders 
            WHERE DATE(created_at) BETWEEN ${startDate} AND ${endDate}
              AND status IN ('COMPLETED', 'PROCESSING')
            GROUP BY DATE(created_at), product_id
            ORDER BY date ASC, product_id
          `,
        ]);

        payload = {
          type: 'products',
          period: { startDate, endDate },
          productPerformance: perf.map((x) => ({
            productId: x.productId,
            optionName: x.optionName,
            totalOrders: x._count.id,
            totalQuantity: x._sum.quantity || 0,
            totalRevenue: Number(x._sum.totalPrice || 0),
            avgOrderValue: Number(x._avg.totalPrice || 0),
          })),
          productTrends: trends.map((t) => ({
            date: t.date,
            productId: t.productId,
            ordersCount: Number(t.ordersCount || 0),
            revenue: Number(t.revenue || 0),
          })),
        };
      } else if (type === 'payments') {
        const [rial, crypto, failed] = await Promise.all([
          prisma.paymentRequest.groupBy({
            by: ['status'],
            where: {
              createdAt: { gte: new Date(startDate + 'T00:00:00Z'), lte: new Date(endDate + 'T23:59:59Z') },
            },
            _count: { id: true },
            _sum: { amount: true },
          }),
          prisma.cryptoPaymentRequest.groupBy({
            by: ['currency', 'status'],
            where: {
              createdAt: { gte: new Date(startDate + 'T00:00:00Z'), lte: new Date(endDate + 'T23:59:59Z') },
            },
            _count: { id: true },
            _sum: { amount: true },
          }),
          prisma.$queryRaw<any[]>`
            SELECT date, SUM(failedCount) as failedCount, paymentType FROM (
              SELECT 
                DATE(created_at) as date,
                COUNT(*) as failedCount,
                'rial' as paymentType
              FROM payment_requests
              WHERE DATE(created_at) BETWEEN ${startDate} AND ${endDate}
                AND status = 'FAILED'
              GROUP BY DATE(created_at)
              UNION ALL
              SELECT 
                DATE(created_at) as date,
                COUNT(*) as failedCount,
                'crypto' as paymentType
              FROM crypto_payment_requests
              WHERE DATE(created_at) BETWEEN ${startDate} AND ${endDate}
                AND status = 'FAILED'
              GROUP BY DATE(created_at)
            ) t
            GROUP BY date, paymentType
            ORDER BY date ASC
          `,
        ]);

        payload = {
          type: 'payments',
          period: { startDate, endDate },
          paymentBreakdown: {
            rial: rial.map((x) => ({
              status: x.status,
              count: x._count.id,
              totalAmount: Number(x._sum.amount || 0),
            })),
            crypto: crypto.map((x) => ({
              currency: x.currency,
              status: x.status,
              count: x._count.id,
              totalAmount: Number(x._sum.amount || 0),
            })),
          },
          failedPayments: failed.map((x) => ({
            date: x.date,
            failedCount: Number(x.failedCount),
            paymentType: x.paymentType,
          })),
        };
      } else {
        throw new AppError('Invalid report type', 400);
      }

      // ارسال به صورت attachment JSON
      res.setHeader('Content-Disposition', `attachment; filename="${type}-report-${startDate}_to_${endDate}.json"`);
      res.json({ success: true, report: payload });
    } catch (error) {
      logger.error('Export report failed', {
        adminId,
        type,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error instanceof AppError ? error : new AppError('Failed to export report', 503);
    }
  };

  /**
   * Helper: Get sales by time period (MySQL)
   */
  private async getSalesByPeriod(startDate: string, endDate: string, groupBy: 'day' | 'week' | 'month') {
    const dateFormat =
      groupBy === 'week' ? '%Y-%u' :
      groupBy === 'month' ? '%Y-%m' :
      '%Y-%m-%d';

    return await prisma.$queryRaw<any[]>`
      SELECT 
        DATE_FORMAT(created_at, ${dateFormat}) as period,
        COUNT(*) as totalOrders,
        SUM(total_price) as totalRevenue,
        AVG(total_price) as avgOrderValue,
        COUNT(DISTINCT user_id) as uniqueCustomers
      FROM orders 
      WHERE DATE(created_at) BETWEEN ${startDate} AND ${endDate}
        AND status IN ('COMPLETED', 'PROCESSING')
      GROUP BY period
      ORDER BY period ASC
    `;
  }

  /**
   * Helper: Get daily revenue (هر روز یک ردیف، با هر دو فیلد)
   */
  private async getDailyRevenue(startDate: string, endDate: string) {
    return await prisma.$queryRaw<any[]>`
      SELECT date, 
             SUM(rialRevenue) AS rialRevenue, 
             SUM(cryptoRevenue) AS cryptoRevenue
      FROM (
        SELECT 
          DATE(created_at) as date,
          SUM(amount) as rialRevenue,
          0 as cryptoRevenue
        FROM payment_requests
        WHERE DATE(created_at) BETWEEN ${startDate} AND ${endDate}
          AND status = 'COMPLETED'
        GROUP BY DATE(created_at)

        UNION ALL

        SELECT 
          DATE(created_at) as date,
          0 as rialRevenue,
          SUM(amount * exchange_rate) as cryptoRevenue
        FROM crypto_payment_requests
        WHERE DATE(created_at) BETWEEN ${startDate} AND ${endDate}
          AND status = 'COMPLETED'
        GROUP BY DATE(created_at)
      ) t
      GROUP BY date
      ORDER BY date ASC
    `;
  }
}
