// backend/src/services/PriceUpdateService.ts
import axios from 'axios';
import { prisma } from '@/config/database';
import { config } from '@/config/environment';
import { logger } from '@/utils/logger';
import { AlertService } from '@/services/AlertService';

type Currency = 'USDT' | 'BTC' | 'ETH' | 'TON';

interface NobitexPairStat {
  latest?: string;
  dayOpen?: string;
  dayHigh?: string;
  dayLow?: string;
  dayClose?: string;
  dayChange?: string;
  volumeSrc?: string;
  volumeDst?: string;
}

interface NobitexResponse {
  status: 'ok' | string;
  stats: Record<string, NobitexPairStat>;
}

export interface CryptoPrices {
  USDT: number;
  BTC: number;
  ETH: number;
  TON?: number;
}

interface HistoryPoint {
  price: number;          // IRT (ریال)
  priceUsd: number | null;
  timestamp: Date;
}

/** کفِ تتر به تومان و فالبک به تومان (قابل override با .env) */
const FLOOR_TOMAN = Number(process.env.ALERT_THRESHOLD_TOMAN || '110000'); // 110k
const FALLBACK_TOMAN = Number(process.env.FALLBACK_USDT_TOMAN || '115000'); // 115k

/** مقادیر فالبک به IRT (ریال) */
const FALLBACK: Required<CryptoPrices> = {
  USDT: FALLBACK_TOMAN * 10,   // 115k تومان → 1,150,000 ریال
  BTC: 2_600_000_000,
  ETH: 160_000_000,
  TON: 3_000_000,
};

export class PriceUpdateService {
  private isRunning = false;
  private lastUpdate: Date | null = null;
  private failureCount = 0;
  private readonly maxFailures = 5;

  // جلوگیری از اجرای هم‌زمان
  private updating = false;
  private inFlight?: Promise<Required<CryptoPrices>>;

  // کش در حافظه
  private cache:
    | {
        prices: Required<CryptoPrices>;
        expiresAt: number; // epoch ms
      }
    | null = null;

  private alerts = new AlertService();

  constructor() {
    this.bindMethods();
  }

  private bindMethods() {
    this.updatePrices = this.updatePrices.bind(this);
    this.fetchFromNobitex = this.fetchFromNobitex.bind(this);
    this.savePricesToDatabase = this.savePricesToDatabase.bind(this);
    this.getCurrentPrices = this.getCurrentPrices.bind(this);
  }

  /* ----------------------------- Lifecycle ----------------------------- */

  /** Start once (کرون جداگانه در PriceCronService زمان‌بندی می‌شود) */
  public start(): void {
    if (this.isRunning) {
      logger.warn('Price update service is already running');
      return;
    }
    this.isRunning = true;
    logger.info('🚀 Starting price update service');
    void this.updatePrices();
  }

  public stop(): void {
    this.isRunning = false;
    logger.info('🛑 Price update service stopped');
  }

  /* ------------------------------ Queries ------------------------------ */

  /** آپدیت دستی (برای پنل ادمین) */
  public async manualUpdate(): Promise<{ success: boolean; prices?: Required<CryptoPrices>; error?: string }> {
    try {
      logger.info('📊 Manual price update requested');

      // اگر درحال آپدیت هستیم، همون نتیجه درحال انجام رو برگردونیم (Dedupe)
      if (this.updating && this.inFlight) {
        logger.warn('Manual update requested while an update is in progress — returning in-flight result');
        const prices = await this.inFlight.catch(() => this.getCurrentPrices());
        return { success: true, prices };
      }

      this.inFlight = (async () => {
        this.updating = true;
        try {
          const prices = await this.fetchFromNobitex();
          await this.savePricesToDatabase(prices);
          this.setCache(prices);
          this.lastUpdate = new Date();
          this.failureCount = 0;
          logger.info('✅ Manual price update completed', { prices });
          return prices;
        } finally {
          this.updating = false;
          this.inFlight = undefined;
        }
      })();

      const prices = await this.inFlight;
      return { success: true, prices };
    } catch (error: any) {
      logger.error('❌ Manual price update failed:', { error: error?.message || error });
      return { success: false, error: error?.message || 'Unknown error' };
    }
  }

  /** قیمت‌های فعلی با احترام به کش (TTL) و سپس دیتابیس؛ در نهایت fallback */
  public async getCurrentPrices(): Promise<Required<CryptoPrices>> {
    // 1) کش
    if (this.cache && Date.now() < this.cache.expiresAt) {
      return this.cache.prices;
    }

    // 2) دیتابیس
    try {
      const rows = await prisma.cryptoPrice.findMany({
        where: { currency: { in: ['USDT', 'BTC', 'ETH', 'TON'] } },
        select: { currency: true, priceIrt: true, updatedAt: true },
      });

      const fromDb: Partial<Record<Currency, number>> = {};
      for (const r of rows) {
        // اگر مدل unique نیست و چند ردیف باشد، جدیدترین باید انتخاب شود؛ اما فرض فعلی: unique
        fromDb[r.currency as Currency] = Number(r.priceIrt);
      }

      const prices: Required<CryptoPrices> = {
        USDT: fromDb.USDT ?? FALLBACK.USDT,
        BTC: fromDb.BTC ?? FALLBACK.BTC,
        ETH: fromDb.ETH ?? FALLBACK.ETH,
        TON: fromDb.TON ?? FALLBACK.TON,
      };

      this.setCache(prices);
      return prices;
    } catch (error: any) {
      logger.error('Error getting current prices from database:', { error: error?.message || error });
      this.setCache(FALLBACK);
      return FALLBACK;
    }
  }

  /** تاریخچهٔ قیمت‌ها برای نمودار/آنالیتیکس */
  public async getPriceHistory(currency: string, days: number = 7): Promise<HistoryPoint[]> {
    try {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const history = await prisma.priceHistory.findMany({
        where: { currency: currency.toUpperCase(), createdAt: { gte: since } },
        orderBy: { createdAt: 'asc' },
        select: { priceIrt: true, priceUsd: true, createdAt: true },
      });

      return history.map((h) => ({
        price: Number(h.priceIrt),          // IRT
        priceUsd: h.priceUsd ? Number(h.priceUsd) : null,
        timestamp: h.createdAt,
      }));
    } catch (error: any) {
      logger.error(`Error getting price history for ${currency}:`, { error: error?.message || error });
      return [];
    }
  }

  /* ------------------------------ Updates ------------------------------ */

  /** فانکشن اصلی آپدیت */
  private async updatePrices(): Promise<void> {
    if (!this.isRunning) return;

    // جلوگیری از آپدیت‌های هم‌زمان دوره‌ای
    if (this.updating && this.inFlight) {
      logger.warn('Periodic update skipped: another update is in flight');
      return;
    }

    try {
      const apiCall = async () => {
        this.updating = true;
        const prices = await this.fetchFromNobitex();
        await this.savePricesToDatabase(prices);
        this.setCache(prices);

        this.lastUpdate = new Date();
        this.failureCount = 0;

        logger.info('✅ Price update completed successfully', {
          prices,
          timestamp: this.lastUpdate,
        });
      };

      this.inFlight = apiCall()
        .catch((e) => { throw e; })
        .finally(() => {
          this.updating = false;
          this.inFlight = undefined;
        });

      await this.inFlight;
    } catch (error: any) {
      this.failureCount++;
      logger.error(`❌ Price update failed (attempt ${this.failureCount}/${this.maxFailures}):`, {
        error: error?.message || error,
      });

      // آلارم‌ها بسته به شمار خطاهای متوالی
      if (this.failureCount === 3) {
        void this.alerts.sendAlert(
          'WARNING',
          'خطای متوالی در به‌روزرسانی قیمت',
          `در ۳ تلاش متوالی، به‌روزرسانی قیمت با خطا مواجه شد.`,
          { failureCount: this.failureCount }
        );
      } else if (this.failureCount >= this.maxFailures) {
        void this.alerts.sendAlert(
          'CRITICAL',
          'توقف سرویس قیمت به‌علت خطاهای مکرر',
          `سرویس به‌روزرسانی قیمت پس از ${this.failureCount} خطای متوالی متوقف شد.`,
          { failureCount: this.failureCount }
        );
        logger.error('🚨 Max price update failures reached, stopping service');
        this.stop();
      }
    }
  }

  /** فراخوانی Nobitex و تبدیل به IRT + اعمال کفِ تتر (۱۱۰k تومان) و محاسبه priceUsd */
  public async fetchFromNobitex(): Promise<Required<CryptoPrices>> {
    const timeout = Number(config.monitoring.apiTimeoutThreshold || 10_000);
    try {
      const res = await axios.get<NobitexResponse>(config.nobitex.apiUrl, {
        timeout,
        headers: { 'User-Agent': 'PSYGStore/1.0', Accept: 'application/json' },
      });

      if (res.data.status !== 'ok') {
        throw new Error('Nobitex API returned error status');
      }

      const s = res.data.stats;
      const get = (pair: string) => this.parsePrice(s[pair]?.latest, NaN);

      // IRT پایه
      const rawUsdtIrt = this.parsePrice(s['usdt-irt']?.latest, FALLBACK.USDT);
      const floorIrt = FLOOR_TOMAN * 10; // تومان → ریال
      const usdtIrt = rawUsdtIrt < floorIrt ? floorIrt : rawUsdtIrt;
      if (usdtIrt !== rawUsdtIrt) {
        logger.warn('⚠️ USDT floored below threshold', { rawUsdtIrt, floorIrt, applied: usdtIrt });
      }

      // جفت مستقیم IRT
      const btcIrt = this.pickFirstFinite([get('btc-irt')], FALLBACK.BTC);
      const ethIrt = this.pickFirstFinite([get('eth-irt')], FALLBACK.ETH);

      // TON: ترجیح ton-irt، در غیر این صورت ton-usdt * usdt-irt
      const tonIrtDirect = get('ton-irt');
      const tonUsdt = get('ton-usdt');
      const tonIrt = Number.isFinite(tonIrtDirect)
        ? tonIrtDirect
        : (Number.isFinite(tonUsdt) ? Math.floor(tonUsdt * usdtIrt) : FALLBACK.TON);

      const prices: Required<CryptoPrices> = {
        USDT: usdtIrt,
        BTC: this.saneNumber(btcIrt, FALLBACK.BTC),
        ETH: this.saneNumber(ethIrt, FALLBACK.ETH),
        TON: this.saneNumber(tonIrt, FALLBACK.TON),
      };

      this.validatePrices(prices);
      return prices;
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') throw new Error('Nobitex API timeout');
        if (error.response?.status === 429) throw new Error('Nobitex API rate limit exceeded');
        if ((error.response?.status || 0) >= 500) throw new Error('Nobitex API server error');
      }
      throw new Error(`Failed to fetch prices from Nobitex: ${error?.message || 'Unknown error'}`);
    }
  }

  /** ذخیرهٔ قیمت‌ها در DB (جدول فعلی + تاریخچه) با priceUsd محاسبه‌شده */
  public async savePricesToDatabase(prices: Required<CryptoPrices>): Promise<void> {
    try {
      // priceUsd را بر اساس نسبت به USDT محاسبه می‌کنیم (USDT ~= USD)
      const toUsd = (irt: number) => (irt && prices.USDT ? irt / prices.USDT : 0);
      const priceUsd = {
        USDT: 1,
        BTC: toUsd(prices.BTC),
        ETH: toUsd(prices.ETH),
        TON: toUsd(prices.TON),
      };

      await prisma.$transaction(async (tx) => {
        for (const [currency, price] of Object.entries(prices) as [Currency, number][]) {
          await tx.cryptoPrice.upsert({
            where: { currency },
            update: { priceIrt: price, updatedAt: new Date() },
            create: { currency, priceIrt: price },
          });

          await tx.priceHistory.create({
            data: {
              currency,
              priceIrt: price,
              priceUsd: Number.isFinite(priceUsd[currency]) ? priceUsd[currency] : null,
              source: 'nobitex',
            },
          });
        }
      });

      logger.info('💾 Prices saved to database successfully');
    } catch (error: any) {
      logger.error('❌ Failed to save prices to database:', { error: error?.message || error });
      throw error;
    }
  }

  /* ------------------------------ Helpers ------------------------------ */

  private parsePrice(v: string | undefined, fallback: number): number {
    if (!v) return fallback;
    const n = parseFloat(v);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  }

  private pickFirstFinite(values: number[], fallback: number): number {
    for (const v of values) if (Number.isFinite(v) && v > 0) return v;
    return fallback;
  }

  private saneNumber(n: number, fallback: number): number {
    return Number.isFinite(n) && n > 0 ? n : fallback;
  }

  /** sanity check ساده (IRT) */
  private validatePrices(p: Required<CryptoPrices>): void {
    // USDT (IRT): 800k–2M (یعنی 80k–200k تومان)
    if (p.USDT < 800_000 || p.USDT > 2_000_000) {
      logger.warn('USDT price seems unusual (IRT)', { value: p.USDT });
    }
    // BTC (IRT): حدوداً 1B–5B
    if (p.BTC < 1_000_000_000 || p.BTC > 5_000_000_000) {
      logger.warn('BTC price seems unusual (IRT)', { value: p.BTC });
    }
    // ETH (IRT): حدوداً 50M–500M
    if (p.ETH < 50_000_000 || p.ETH > 500_000_000) {
      logger.warn('ETH price seems unusual (IRT)', { value: p.ETH });
    }
    // TON (IRT): بازهٔ تقریبی
    if (p.TON < 200_000 || p.TON > 5_000_000) {
      logger.warn('TON price seems unusual (IRT)', { value: p.TON });
    }
  }

  private setCache(prices: Required<CryptoPrices>) {
    const ttl = Math.max(5, Number(config.nobitex.cacheTimeout || 300)) * 1000;
    this.cache = { prices, expiresAt: Date.now() + ttl };
  }

  /* ------------------------------ Status ------------------------------- */

  public getStatus() {
    const interval = Number(config.nobitex.updateInterval || 300_000);
    return {
      isRunning: this.isRunning,
      lastUpdate: this.lastUpdate,
      failureCount: this.failureCount,
      maxFailures: this.maxFailures,
      nextUpdate: this.lastUpdate ? new Date(this.lastUpdate.getTime() + interval) : null,
      cacheValidUntil: this.cache ? new Date(this.cache.expiresAt) : null,
    };
  }

  public resetFailures(): void {
    this.failureCount = 0;
    logger.info('🔄 Price update failure count reset');
  }
}
