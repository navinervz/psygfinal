// backend/src/controllers/ArticleController.ts
import { Request, Response } from 'express';
import { prisma } from '@/config/database';
import { logger } from '@/utils/logger';
import { AppError } from '@/utils/AppError';

type SortBy = 'publishedAt' | 'title' | 'readTime';
type SortOrder = 'asc' | 'desc';

export class ArticleController {
  /**
   * لیست مقالات (عمومی)
   */
  public getArticles = async (req: Request, res: Response): Promise<void> => {
    try {
      const {
        page = 1,
        limit = 20,
        search,
        category,
        sortBy = 'publishedAt',
        sortOrder = 'desc',
      } = req.query;

      const pageNum = Math.max(1, Number(page));
      const take = Math.min(100, Math.max(1, Number(limit)));
      const skip = (pageNum - 1) * take;

      // سورت امن (فقط فیلدهای مجاز)
      const allowedSortBy: Record<string, SortBy> = {
        publishedAt: 'publishedAt',
        title: 'title',
        readTime: 'readTime',
      };
      const by: SortBy = allowedSortBy[String(sortBy)] ?? 'publishedAt';
      const order: SortOrder = (String(sortOrder) === 'asc' ? 'asc' : 'desc') as SortOrder;

      const where: any = { isPublished: true };

      // سرچ (case-insensitive)
      const q = String(search ?? '').trim();
      if (q) {
        where.OR = [
          { title:   { contains: q, mode: 'insensitive' } },
          { excerpt: { contains: q, mode: 'insensitive' } },
          { content: { contains: q, mode: 'insensitive' } },
        ];
      }

      // فیلتر دسته‌بندی (case-insensitive)
      if (category) {
        where.category = { equals: String(category), mode: 'insensitive' };
      }

      const [articles, total] = await Promise.all([
        prisma.article.findMany({
          where,
          skip,
          take,
          orderBy: { [by]: order },
          select: {
            id: true,
            title: true,
            slug: true,
            excerpt: true,
            imageUrl: true,
            category: true,
            readTime: true,
            publishedAt: true,
            author: { select: { fullName: true } },
          },
        }),
        prisma.article.count({ where }),
      ]);

      res.json({
        success: true,
        articles,
        pagination: {
          page: pageNum,
          limit: take,
          total,
          pages: Math.ceil(total / take),
          hasNext: skip + take < total,
          hasPrev: pageNum > 1,
        },
      });
    } catch (error: any) {
      logger.error('Failed to list articles', { error: error?.message || error });
      throw new AppError('Failed to fetch articles', 503);
    }
  };

  /**
   * دریافت مقاله با اسلاگ (عمومی)
   */
  public getArticleBySlug = async (req: Request, res: Response): Promise<void> => {
    try {
      const { slug } = req.params;

      // نکته: findFirst چون شرط isPublished هم داریم (slug به‌تنهایی unique است اما این ایمن‌تر است)
      const article = await prisma.article.findFirst({
        where: { slug, isPublished: true },
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          content: true,
          imageUrl: true,
          category: true,
          readTime: true,
          publishedAt: true,
          author: { select: { fullName: true } },
        },
      });

      if (!article) {
        throw new AppError('Article not found', 404);
      }

      // (اختیاری) لاگ بازدید
      logger.info('Article viewed', { articleId: article.id, slug, ip: req.ip });

      res.json({ success: true, article });
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      logger.error('Failed to fetch article by slug', { slug: req.params.slug, error: error?.message || error });
      throw new AppError('Failed to fetch article', 503);
    }
  };

  /**
   * لیست مقالات با دسته‌بندی (عمومی)
   */
  public getArticlesByCategory = async (req: Request, res: Response): Promise<void> => {
    try {
      const { category } = req.params;
      const { page = 1, limit = 20 } = req.query;

      const pageNum = Math.max(1, Number(page));
      const take = Math.min(100, Math.max(1, Number(limit)));
      const skip = (pageNum - 1) * take;

      const where = {
        category: { equals: String(category), mode: 'insensitive' },
        isPublished: true,
      };

      const [articles, total] = await Promise.all([
        prisma.article.findMany({
          where,
          skip,
          take,
          orderBy: { publishedAt: 'desc' },
          select: {
            id: true,
            title: true,
            slug: true,
            excerpt: true,
            imageUrl: true,
            category: true,
            readTime: true,
            publishedAt: true,
          },
        }),
        prisma.article.count({ where }),
      ]);

      res.json({
        success: true,
        category,
        articles,
        pagination: {
          page: pageNum,
          limit: take,
          total,
          pages: Math.ceil(total / take),
          hasNext: skip + take < total,
          hasPrev: pageNum > 1,
        },
      });
    } catch (error: any) {
      logger.error('Failed to fetch articles by category', {
        category: req.params.category,
        error: error?.message || error,
      });
      throw new AppError('Failed to fetch articles', 503);
    }
  };
}
