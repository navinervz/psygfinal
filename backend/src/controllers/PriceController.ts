// backend/src/controllers/PriceController.ts
import { Request, Response } from 'express';
import { logger } from '@/utils/logger';
import { AppError } from '@/utils/AppError';
import { PriceUpdateService } from '@/services/PriceUpdateService';
import { PRODUCT_CATALOG } from '@/config/products';

type CurrencyCode = 'USDT' | 'BTC' | 'ETH' | 'TON';

export class PriceController {
  private priceUpdateService = new PriceUpdateService();

  // پیش‌فرض‌ها (قابل تنظیم از طریق .env)
  private static readonly FALLBACK_USDT_TOMAN =
    Number(process.env.FALLBACK_USDT_TOMAN || 115_000); // تومان (نزدیک بازار فعلی)
  private static readonly ALERT_THRESHOLD_TOMAN =
    Number(process.env.ALERT_THRESHOLD_TOMAN || 110_000); // تومان (کفِ مجاز)

  /** قیمت‌های لحظه‌ای ارزها (همه برحسب تومان) */
  public getCurrentPrices = async (_req: Request, res: Response): Promise<void> => {
    try {
      const prices = await this.priceUpdateService.getCurrentPrices();
      const normalized = this.normalizePricesToToman(prices);

      res.json({
        success: true,
        unit: 'toman',
        prices: normalized,
        timestamp: new Date().toISOString(),
        source: 'nobitex',
      });
    } catch (error) {
      logger.error('Error getting current prices', error);
      throw new AppError('Failed to get current prices', 503);
    }
  };

  /** تاریخچهٔ قیمت (خروجی: تومان) */
  public getPriceHistory = async (req: Request, res: Response): Promise<void> => {
    const { currency } = req.params;
    const { days = 7, interval = 'hour' } = req.query;

    const cur = (currency || '').toUpperCase() as CurrencyCode;
    if (!['USDT', 'BTC', 'ETH', 'TON'].includes(cur)) {
      throw new AppError('Invalid currency', 400);
    }

    try {
      const history = await this.priceUpdateService.getPriceHistory(cur, Number(days));

      res.json({
        success: true,
        unit: 'toman',
        currency: cur,
        history,
        period: { days: Number(days), interval },
      });
    } catch (error) {
      logger.error(`Error getting price history for ${currency}`, error);
      throw new AppError('Failed to get price history', 503);
    }
  };

  /** دادهٔ نمودار (خروجی: تومان) */
  public getPriceChart = async (req: Request, res: Response): Promise<void> => {
    const { currency } = req.params;
    const { period = '24h' } = req.query;

    const cur = (currency || '').toUpperCase() as CurrencyCode;
    if (!['USDT', 'BTC', 'ETH', 'TON'].includes(cur)) {
      throw new AppError('Invalid currency', 400);
    }

    const periodToDays: Record<string, number> = {
      '1h': 1 / 24,
      '24h': 1,
      '7d': 7,
      '30d': 30,
      '90d': 90,
    };
    const days = periodToDays[String(period)] ?? 1;

    try {
      const history = await this.priceUpdateService.getPriceHistory(cur, days);

      const data = history.map((h) => ({
        timestamp: h.timestamp,
        price: h.price,      // تومان
        priceUsd: h.priceUsd ?? null,
      }));

      const hasData = data.length > 0;
      const current = hasData ? data[data.length - 1].price : 0;
      const high = hasData ? Math.max(...data.map((d) => d.price)) : 0;
      const low = hasData ? Math.min(...data.map((d) => d.price)) : 0;
      const change =
        hasData && data.length > 1
          ? ((data[data.length - 1].price - data[0].price) / data[0].price) * 100
          : 0;

      res.json({
        success: true,
        unit: 'toman',
        currency: cur,
        period,
        data,
        stats: { current, high, low, change },
      });
    } catch (error) {
      logger.error(`Error getting price chart for ${currency}`, error);
      throw new AppError('Failed to get price chart', 503);
    }
  };

  /**
   * قیمت تومانی محصولات دلاری براساس نرخ USDT (بدون رُندینگ اجباری)
   * اگر نوبیتکس قطع/نامعتبر باشد → fallback
   * اگر نرخ کمتر از آستانه باشد → با min floor اعمال می‌شود
   */
  public getProductPrices = async (_req: Request, res: Response): Promise<void> => {
    let source: 'nobitex' | 'fallback' | 'nobitex+floor' = 'fallback';

    // 1) پیش‌فرض: فالبک از .env یا 115k
    let usdtToman = PriceController.FALLBACK_USDT_TOMAN;

    try {
      // 2) تلاش برای خواندن نرخ از نوبیتکس
      const prices = await this.priceUpdateService.getCurrentPrices();
      const normalized = this.normalizePricesToToman(prices);
      const raw = normalized.USDT;

      if (raw && !Number.isNaN(raw)) {
        usdtToman = raw;
        source = 'nobitex';
      }
    } catch {
      logger.warn(`Nobitex unavailable, using fallback USDT rate = ${usdtToman}`);
    }

    // 3) اعمال کف نرخ (threshold/floor)
    const minToman = Math.max(
      0,
      Number(process.env.ALERT_THRESHOLD_TOMAN || PriceController.ALERT_THRESHOLD_TOMAN)
    );
    const appliedRate = Math.max(usdtToman, minToman);
    if (appliedRate !== usdtToman) {
      source = 'nobitex+floor';
      this.warnLowRate(usdtToman, minToman);
      await this.trySendAlert(usdtToman, minToman).catch(() => {});
    }

    // 4) محاسبهٔ قیمت محصولات با appliedRate
    const products = Object.entries(PRODUCT_CATALOG).map(([service, plans]) => ({
      service,
      plans: plans.map((p) => {
        const toman = p.usd * appliedRate;
        return {
          key: p.key,
          nameFa: p.nameFa,
          usd: p.usd,
          toman,
          tomanFormatted: Math.round(toman).toLocaleString('fa-IR'),
        };
      }),
    }));

    res.json({
      success: true,
      unit: 'toman',
      rate: {
        base: 'USDT',
        tomanPerUsdt: appliedRate,
        source,
        raw: { usdtToman, minToman },
      },
      products,
      timestamp: new Date().toISOString(),
    });
  };

  /* ============================= Helpers ============================= */

  /** ورودی سرویس را به تومان نرمال می‌کند (اگر مقداری شبیه ریال باشد /10 می‌کند) */
  private normalizePricesToToman(prices: Record<string, number>) {
    const out: Record<string, number> = {};
    // USDT
    const u = Number(
      (prices as any)?.USDT ??
        (prices as any)?.usdt ??
        (prices as any)?.['USDT-IRT'] ??
        (prices as any)?.['usdt-irt']
    );
    // اگر مقدار خیلی بزرگ بود (شبیه ریال) → به تومان تبدیل می‌کنیم
    out.USDT = Number.isFinite(u) ? (u >= 200_000 ? u / 10 : u) : PriceController.FALLBACK_USDT_TOMAN;

    // سایر ارزها را همان‌طور عبور می‌دهیم (در سرویس شما از قبل تومان هستند)
    (['BTC', 'ETH', 'TON'] as CurrencyCode[]).forEach((c) => {
      const v = (prices as any)?.[c];
      if (typeof v === 'number' && Number.isFinite(v)) {
        out[c] = v;
      }
    });

    return out as Record<CurrencyCode, number>;
  }

  private warnLowRate(current: number, threshold: number) {
    logger.warn(
      `⚠️ USDT below threshold: current=${current} < threshold=${threshold} (toman) — consider updating fallback/threshold`
    );
  }

  /** تلاش برای ارسال هشدار از طریق AlertService (اگر پیکربندی شده باشد) */
  private async trySendAlert(current: number, threshold: number) {
    try {
      const mod = await import('@/services/AlertService'); // import دینامیک
      const svc: any = new (mod as any).AlertService();
      const text =
        `⚠️ هشدار قیمت تتر: ${current.toLocaleString('fa-IR')} تومان ` +
        `(کمتر از آستانه ${threshold.toLocaleString('fa-IR')})`;
      if (typeof svc.sendAlert === 'function') {
        await svc.sendAlert('usdt-low', text);
      } else if (typeof svc.notify === 'function') {
        await svc.notify(text);
      }
    } catch {
      // اگر سرویس هشدار نباشد/پیکربندی نشده باشد، بی‌سر و صدا عبور کن
    }
  }
}
