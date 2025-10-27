// backend/src/controllers/AlertController.ts
import { Response } from 'express';
import { AuthenticatedRequest } from '@/middleware/auth';
import { logger, logAdminAction } from '@/utils/logger';
import { AppError } from '@/utils/AppError';
import { AlertService } from '@/services/AlertService';
import { config } from '@/config/environment';

type Severity = 'CRITICAL' | 'WARNING' | 'INFO';

export class AlertController {
  private alertService = new AlertService();

  /* ------------------------------ Helpers ------------------------------ */

  private assertAdmin(req: AuthenticatedRequest) {
    const user = req.user;
    if (!user?.id || !user.isAdmin) {
      throw new AppError('Admin privileges required', 403);
    }
    return user.id;
  }

  // ورودی متادیتا را کمی امن و محدود می‌کنیم (از نظر حجم/ساختار)
  private sanitizeMetadata(meta: any) {
    try {
      if (!meta || typeof meta !== 'object') return undefined;
      const json = JSON.stringify(meta);
      // محدودیت حجم 10KB
      if (json.length > 10_000) return { note: 'metadata too large, truncated' };
      return meta;
    } catch {
      return undefined;
    }
  }

  /* ------------------------------- Actions ----------------------------- */

  /** Test alert system */
  public testAlerts = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const adminId = this.assertAdmin(req);

    logger.info('Admin requested alert system test', { adminId, ip: req.ip });

    const results = await this.alertService.testAlerts();

    logAdminAction(adminId, 'test_alerts', { results, ip: req.ip });

    res.json({
      success: true,
      message: 'Alert test completed',
      results: {
        telegram: !!results.telegram,
        email: !!results.email,
      },
      timestamp: new Date().toISOString(),
    });
  };

  /** Send manual alert */
  public sendAlert = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const adminId = this.assertAdmin(req);
    const { severity, title, message, metadata } = req.body as {
      severity: Severity;
      title: string;
      message: string;
      metadata?: any;
    };

    const validSeverities: Severity[] = ['CRITICAL', 'WARNING', 'INFO'];
    if (!validSeverities.includes(severity)) throw new AppError('Invalid severity level', 400);
    if (!title || !message) throw new AppError('Title and message are required', 400);

    const safeMeta = this.sanitizeMetadata(metadata);

    await this.alertService.sendAlert(severity, title, message, {
      ...safeMeta,
      sentBy: adminId,
      manual: true,
      ip: req.ip,
      ua: req.get('User-Agent'),
    });

    logAdminAction(adminId, 'send_manual_alert', { severity, title, ip: req.ip });

    res.json({
      success: true,
      message: 'Alert sent successfully',
      timestamp: new Date().toISOString(),
    });
  };

  /** Get alert configuration (derived from config/environment) */
  public getAlertConfig = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const adminId = this.assertAdmin(req);

    const cfg = {
      telegram: {
        enabled: !!config.alerts.telegramBotToken && !!config.alerts.telegramChatId,
        botConfigured: !!config.alerts.telegramBotToken,
        chatConfigured: !!config.alerts.telegramChatId,
      },
      email: {
        enabled: !!config.alerts.emailEnabled,
        smtpConfigured: !!config.email.user && !!config.email.pass,
        recipients: Array.isArray(config.alerts.emailRecipients)
          ? config.alerts.emailRecipients.length
          : 0,
      },
      thresholds: {
        maxResponseTime: config.monitoring.maxResponseTime,
        minFreeDisk: config.monitoring.minFreeDisk,
        minFreeMemory: config.monitoring.minFreeMemory,
        maxLogSize: config.monitoring.maxLogSize,
        sslWarningDays: config.monitoring.sslWarningDays,
        sslCriticalDays: config.monitoring.sslCriticalDays,
        dbSlowQueryThreshold: config.monitoring.dbSlowQueryThreshold,
        apiTimeoutThreshold: config.monitoring.apiTimeoutThreshold,
        highErrorCountThreshold: config.monitoring.highErrorCountThreshold,
        largeLogFileThreshold: config.monitoring.largeLogFileThreshold,
        diskCriticalThreshold: config.monitoring.diskCriticalThreshold,
        memoryCriticalThreshold: config.monitoring.memoryCriticalThreshold,
        cpuWarningThreshold: config.monitoring.cpuWarningThreshold,
        cpuCriticalThreshold: config.monitoring.cpuCriticalThreshold,
      },
    };

    logAdminAction(adminId, 'view_alert_config', { ip: req.ip });

    res.json({
      success: true,
      config: cfg,
      timestamp: new Date().toISOString(),
    });
  };

  /** Update alert configuration (delegates to service if supported) */
  public updateAlertConfig = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const adminId = this.assertAdmin(req);
    const { telegramToken, telegramChatId, emailEnabled, emailRecipients, thresholds } = req.body || {};

    // اگر سرویس متد updateConfig داشته باشد، به آن می‌سپاریم
    const anyService = this.alertService as unknown as {
      updateConfig?: (opts: any) => Promise<void> | void;
    };

    if (typeof anyService.updateConfig === 'function') {
      await anyService.updateConfig({
        telegramToken,
        telegramChatId,
        emailEnabled,
        emailRecipients,
        thresholds,
      });
    } else {
      logger.warn('AlertService.updateConfig not implemented; applying no-op', { adminId });
    }

    logAdminAction(adminId, 'update_alert_config', {
      telegram: !!(telegramToken || telegramChatId),
      email: typeof emailEnabled === 'boolean' ? emailEnabled : undefined,
      thresholds: !!thresholds,
      ip: req.ip,
    });

    res.json({
      success: true,
      message: 'Alert configuration updated',
      note: 'If transport credentials changed, restart may be required.',
      timestamp: new Date().toISOString(),
    });
  };
}
