// backend/src/routes/articles.ts
import { Router, Request, Response, NextFunction } from 'express';
import { ArticleController } from '@/controllers/ArticleController';
import { optionalAuth } from '@/middleware/auth';
import { validate, schemas, sanitizeInputs } from '@/middleware/validation';
import { generalLimiter } from '@/middleware/rateLimiting';
import { asyncHandler } from '@/middleware/errorHandler';

const router = Router();
const ctrl = new ArticleController();

/** ensure controller this-binding + error piping */
const wrap = (fn: (...args: any[]) => any) => asyncHandler(fn.bind(ctrl));

/** tiny cache for public GETs (works fine behind CDN) */
const cache =
  (seconds: number) =>
  (_req: Request, res: Response, next: NextFunction) => {
    res.set('Cache-Control', `public, max-age=${seconds}`);
    next();
  };

// global middlewares for this router
router.use(generalLimiter);
router.use(optionalAuth);
router.use(sanitizeInputs);

/* ----------------------- Public article routes ----------------------- */
// لیست مقالات: کش سبک
router.get('/', validate(schemas.getArticles), cache(30), wrap(ctrl.getArticles));

// مهم: مسیر خاص‌تر باید قبل از catch-all بیاید
router.get('/category/:category', validate(schemas.categoryParam), cache(60), wrap(ctrl.getArticlesByCategory));

// صفحهٔ مقاله: کش طولانی‌تر
router.get('/:slug', validate(schemas.slugParam), cache(300), wrap(ctrl.getArticleBySlug));

export default router;
