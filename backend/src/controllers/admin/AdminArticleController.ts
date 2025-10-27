import { Response } from 'express';
import { prisma } from '@/config/database';
import { AuthenticatedRequest } from '@/middleware/auth';
import { logger, logAdminAction } from '@/utils/logger';
import { AppError, ValidationError } from '@/utils/AppError';

/* -------- helpers & guards -------- */
const ALLOWED_SORT_FIELDS = new Set([
  'createdAt',
  'publishedAt',
  'title',
  'category',
  'readTime',
  'isPublished',
]);

const clampInt = (val: unknown, min: number, max: number, fallback: number) => {
  const n = Number(val);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
};

const toBoolOrUndefined = (val: unknown) => {
  if (typeof val !== 'string') return undefined;
  if (val.toLowerCase() === 'true') return true;
  if (val.toLowerCase() === 'false') return false;
  return undefined;
};

export class AdminArticleController {
  /**
   * Get all articles (admin view)
   */
  public getArticles = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const adminId = req.user!.id;

    try {
      const {
        page = '1',
        limit = '20',
        search,
        category,
        isPublished,
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
      if (search && search.trim()) {
        const term = search.trim();
        where.OR = [
          { title:   { contains: term, mode: 'insensitive' } },
          { excerpt: { contains: term, mode: 'insensitive' } },
          { content: { contains: term, mode: 'insensitive' } },
        ];
      }

      // Category filter
      if (category && category.trim()) {
        where.category = category.trim();
      }

      // Published filter
      const publishedFlag = toBoolOrUndefined(isPublished);
      if (typeof publishedFlag === 'boolean') {
        where.isPublished = publishedFlag;
      }

      // Sort options
      const orderBy: any = {};
      orderBy[_sortBy] = _sortOrder;

      const [articles, total] = await Promise.all([
        prisma.article.findMany({
          where,
          skip,
          take: _limit,
          orderBy,
          include: {
            author: { select: { fullName: true, email: true } },
          },
        }),
        prisma.article.count({ where }),
      ]);

      logAdminAction(adminId, 'view_articles', {
        filters: { search, category, isPublished: publishedFlag, sortBy: _sortBy, sortOrder: _sortOrder },
        ip: req.ip,
      });

      res.json({
        success: true,
        articles,
        pagination: {
          page: _page,
          limit: _limit,
          total,
          pages: Math.ceil(total / _limit),
        },
      });
    } catch (error) {
      logger.error('Admin getArticles failed', {
        adminId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new AppError('Failed to fetch articles', 503);
    }
  };

  /**
   * Get article by ID
   */
  public getArticleById = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const adminId = req.user!.id;
    const { id } = req.params;

    try {
      const article = await prisma.article.findUnique({
        where: { id },
        include: { author: { select: { fullName: true, email: true } } },
      });

      if (!article) {
        throw new AppError('Article not found', 404);
      }

      logAdminAction(adminId, 'view_article_details', { targetArticleId: id, ip: req.ip });

      res.json({ success: true, article });
    } catch (error) {
      logger.error('Admin getArticleById failed', {
        adminId,
        id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error instanceof AppError ? error : new AppError('Failed to fetch article', 503);
    }
  };

  /**
   * Create new article
   */
  public createArticle = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const adminId = req.user!.id;

    try {
      const {
        title,
        slug,
        excerpt,
        content,
        imageUrl,
        category,
        readTime,
        keywords,
        metaDescription,
        isPublished = false,
      } = req.body as {
        title: string;
        slug?: string;
        excerpt?: string;
        content: string;
        imageUrl?: string;
        category?: string;
        readTime?: number;
        keywords?: string | string[];
        metaDescription?: string;
        isPublished?: boolean;
      };

      if (!title || title.trim().length < 3) {
        throw new ValidationError('Title is required (min 3 chars)');
      }
      if (!content || String(content).trim().length < 20) {
        throw new ValidationError('Content is too short');
      }

      // Generate slug if not provided
      const finalSlug = (slug && slug.trim()) || this.generateSlug(title);
      if (!finalSlug) {
        throw new ValidationError('Invalid slug generated from title');
      }

      // Unique slug
      const existing = await prisma.article.findUnique({ where: { slug: finalSlug } });
      if (existing) {
        throw new ValidationError('Article with this slug already exists');
      }

      // Normalize readTime
      const rt = typeof readTime === 'number' && readTime > 0 ? Math.floor(readTime) : null;

      const article = await prisma.article.create({
        data: {
          title: title.trim(),
          slug: finalSlug,
          excerpt: excerpt || null,
          content: String(content),
          imageUrl: imageUrl || null,
          category: category || null,
          readTime: rt,
          keywords: keywords as any, // depends on schema (array/string). Keep as-is.
          metaDescription: metaDescription || null,
          isPublished: !!isPublished,
          publishedAt: isPublished ? new Date() : null,
          authorId: adminId,
        },
      });

      logAdminAction(adminId, 'create_article', {
        targetArticleId: article.id,
        title,
        slug: finalSlug,
        category,
        isPublished: !!isPublished,
        ip: req.ip,
      });

      logger.info('Article created by admin', {
        adminId,
        articleId: article.id,
        title,
        slug: finalSlug,
      });

      res.status(201).json({
        success: true,
        message: 'Article created successfully',
        article,
      });
    } catch (error) {
      logger.error('Admin createArticle failed', {
        adminId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error instanceof AppError ? error : new AppError('Failed to create article', 503);
    }
  };

  /**
   * Update article
   */
  public updateArticle = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const adminId = req.user!.id;
    const { id } = req.params;

    try {
      const updateData = { ...req.body };

      // Check existence
      const current = await prisma.article.findUnique({
        where: { id },
        select: { id: true, slug: true, isPublished: true, publishedAt: true },
      });
      if (!current) {
        throw new AppError('Article not found', 404);
      }

      // Slug uniqueness if changed
      if (updateData.slug && updateData.slug !== current.slug) {
        const exists = await prisma.article.findFirst({
          where: { slug: updateData.slug, id: { not: id } },
          select: { id: true },
        });
        if (exists) {
          throw new ValidationError('Article with this slug already exists');
        }
      }

      // Normalize readTime if present
      if (typeof updateData.readTime !== 'undefined') {
        const rt = Number(updateData.readTime);
        if (!Number.isFinite(rt) || rt <= 0) {
          updateData.readTime = null;
        } else {
          updateData.readTime = Math.floor(rt);
        }
      }

      // Manage publishedAt based on isPublished
      if (typeof updateData.isPublished === 'boolean') {
        if (updateData.isPublished && !current.isPublished) {
          updateData.publishedAt = new Date();
        } else if (!updateData.isPublished && current.isPublished) {
          updateData.publishedAt = null;
        }
      }

      const updatedArticle = await prisma.article.update({
        where: { id },
        data: updateData,
      });

      logAdminAction(adminId, 'update_article', {
        targetArticleId: id,
        changes: Object.keys(updateData),
        ip: req.ip,
      });

      logger.info('Article updated by admin', {
        adminId,
        articleId: id,
        changes: Object.keys(updateData),
      });

      res.json({
        success: true,
        message: 'Article updated successfully',
        article: updatedArticle,
      });
    } catch (error) {
      logger.error('Admin updateArticle failed', {
        adminId,
        id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error instanceof AppError ? error : new AppError('Failed to update article', 503);
    }
  };

  /**
   * Delete article
   */
  public deleteArticle = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const adminId = req.user!.id;
    const { id } = req.params;

    try {
      const article = await prisma.article.findUnique({
        where: { id },
        select: { title: true, slug: true },
      });

      if (!article) {
        throw new AppError('Article not found', 404);
      }

      await prisma.article.delete({ where: { id } });

      logAdminAction(adminId, 'delete_article', {
        targetArticleId: id,
        articleInfo: { title: article.title, slug: article.slug },
        ip: req.ip,
      });

      logger.info('Article deleted by admin', {
        adminId,
        articleId: id,
        title: article.title,
      });

      res.json({ success: true, message: 'Article deleted successfully' });
    } catch (error) {
      logger.error('Admin deleteArticle failed', {
        adminId,
        id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error instanceof AppError ? error : new AppError('Failed to delete article', 503);
    }
  };

  /**
   * Publish article
   */
  public publishArticle = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const adminId = req.user!.id;
    const { id } = req.params;

    try {
      const article = await prisma.article.findUnique({ where: { id } });
      if (!article) throw new AppError('Article not found', 404);
      if (article.isPublished) throw new ValidationError('Article is already published');

      await prisma.article.update({
        where: { id },
        data: { isPublished: true, publishedAt: new Date() },
      });

      logAdminAction(adminId, 'publish_article', { targetArticleId: id, ip: req.ip });
      logger.info('Article published by admin', { adminId, articleId: id, title: article.title });

      res.json({ success: true, message: 'Article published successfully' });
    } catch (error) {
      logger.error('Admin publishArticle failed', {
        adminId,
        id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error instanceof AppError ? error : new AppError('Failed to publish article', 503);
    }
  };

  /**
   * Unpublish article
   */
  public unpublishArticle = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const adminId = req.user!.id;
    const { id } = req.params;

    try {
      const article = await prisma.article.findUnique({ where: { id } });
      if (!article) throw new AppError('Article not found', 404);
      if (!article.isPublished) throw new ValidationError('Article is already unpublished');

      await prisma.article.update({
        where: { id },
        data: { isPublished: false, publishedAt: null },
      });

      logAdminAction(adminId, 'unpublish_article', { targetArticleId: id, ip: req.ip });
      logger.info('Article unpublished by admin', { adminId, articleId: id, title: article.title });

      res.json({ success: true, message: 'Article unpublished successfully' });
    } catch (error) {
      logger.error('Admin unpublishArticle failed', {
        adminId,
        id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error instanceof AppError ? error : new AppError('Failed to unpublish article', 503);
    }
  };

  /**
   * Generate slug from title
   */
  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove special chars
      .replace(/\s+/g, '-')     // Spaces -> hyphen
      .replace(/-+/g, '-')      // Collapse multiple hyphens
      .trim()
      .substring(0, 100);       // Limit length
  }
}
