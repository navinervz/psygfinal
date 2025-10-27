// backend/src/services/PriceCronService.ts
import cron from 'node-cron';
import { logger } from '@/utils/logger';
import { PriceUpdateService } from './PriceUpdateService';
import { config } from '@/config/environment';

export class PriceCronService {
  private priceUpdateService: PriceUpdateService;
  private cronJob: cron.ScheduledTask | null = null;
  private isTickRunning = false;
  private cronSpec = '*/5 * * * *'; // fallback 5 دقیقه‌ای
  private readonly timezone = 'Asia/Tehran';

  constructor() {
    this.priceUpdateService = new PriceUpdateService();

    // derive cron spec from env interval (ms) => minutes
    const intervalMs = Number(config.nobitex.updateInterval || 300_000);
    let minutes = Math.max(1, Math.floor(intervalMs / 60_000));
    if (minutes > 60) {
      logger.warn('Configured update interval is over 60 minutes; clamping to 60m for cron.');
      minutes = 60;
    }
    this.cronSpec = `*/${minutes} * * * *`;
  }

  /**
   * Start the cron job for price updates (every N minutes, Asia/Tehran)
   * - یک بار هم در شروع با کمی Jitter اجرا می‌شود تا Cache به‌روز شود.
   */
  public start(): void {
    if (this.cronJob) {
      logger.warn('Price cron service is already running');
      return;
    }

    // اجرای اولیه با کمی Jitter تا هجوم همزمان نداشته باشیم
    const jitterMs = Math.floor(Math.random() * 10_000);
    setTimeout(() => void this.runTick('warmup'), jitterMs);

    // زمان‌بندی دوره‌ای
    try {
      this.cronJob = cron.schedule(
        this.cronSpec,
        async () => {
          await this.runTick('scheduled');
        },
        {
          scheduled: true,
          timezone: this.timezone,
        }
      );

      logger.info('🚀 Price cron service started', {
        cronSpec: this.cronSpec,
        timezone: this.timezone,
      });
    } catch (err: any) {
      logger.error('Failed to schedule price cron service', {
        error: err?.message || err,
        cronSpec: this.cronSpec,
        timezone: this.timezone,
      });
    }
  }

  /**
   * Single tick runner with overlap protection
   */
  private async runTick(source: 'scheduled' | 'warmup' | 'manual'): Promise<void> {
    if (this.isTickRunning) {
      logger.warn('Skip price update tick due to ongoing run', { source });
      return;
    }

    this.isTickRunning = true;
    try {
      logger.info('🔁 Price update tick started', { source });
      const r = await this.priceUpdateService.manualUpdate();
      if (r.success) {
        logger.info('✅ Price update tick completed', { source, prices: r.prices });
      } else {
        logger.error('❌ Price update tick failed', { source, error: r.error });
      }
    } catch (error: any) {
      logger.error('❌ Price update tick crashed', {
        source,
        error: error?.message || error,
      });
    } finally {
      this.isTickRunning = false;
    }
  }

  /**
   * Stop the cron job
   */
  public stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      logger.info('🛑 Price cron service stopped');
    }
  }

  /**
   * Get cron service status
   */
  public getStatus(): {
    isRunning: boolean;
    cronSpec: string;
    timezone: string;
    tickInProgress: boolean;
    lastUpdate?: Date;
    nextUpdate?: Date | null;
    failureCount?: number;
    maxFailures?: number;
    cacheValidUntil?: Date | null;
  } {
    const s = this.priceUpdateService.getStatus();
    return {
      isRunning: this.cronJob !== null,
      cronSpec: this.cronSpec,
      timezone: this.timezone,
      tickInProgress: this.isTickRunning,
      lastUpdate: s.lastUpdate || undefined,
      nextUpdate: s.nextUpdate,
      failureCount: s.failureCount,
      maxFailures: s.maxFailures,
      cacheValidUntil: s.cacheValidUntil,
    };
  }
}
