// backend/src/services/AlertService.ts
import axios from 'axios';
import nodemailer from 'nodemailer';
import { config } from '@/config/environment';
import { logger } from '@/utils/logger';

type Severity = 'CRITICAL' | 'WARNING' | 'INFO';

interface AlertConfig {
  telegram?: {
    botToken: string;
    chatId: string;
  };
  email?: {
    enabled: boolean;
    recipients: string[];
  };
}

export class AlertService {
  private alertConfig: AlertConfig;
  private emailTransporter?: nodemailer.Transporter;

  constructor() {
    this.alertConfig = {
      telegram: {
        botToken: config.alerts.telegramBotToken,
        chatId: config.alerts.telegramChatId,
      },
      email: {
        enabled: !!config.alerts.emailEnabled,
        recipients: Array.isArray(config.alerts.emailRecipients)
          ? config.alerts.emailRecipients
          : [],
      },
    };

    this.configureEmailTransporter();
  }

  /* -------------------------- Public API -------------------------- */

  /**
   * Send alert via configured channels (Telegram / Email)
   */
  public async sendAlert(
    severity: Severity,
    title: string,
    message: string,
    metadata?: any
  ): Promise<void> {
    const textBlock = this.formatTextBlock(severity, title, message, metadata);
    const telegramHtml = this.formatTelegramHtml(severity, title, message, metadata);
    const emailHtml = this.formatEmailHtml(severity, title, message, metadata);

    const sendTasks: Promise<any>[] = [];

    // Telegram
    if (this.alertConfig.telegram?.botToken && this.alertConfig.telegram?.chatId) {
      sendTasks.push(this.sendTelegramAlert(telegramHtml));
    }

    // Email
    if (this.alertConfig.email?.enabled && this.emailTransporter) {
      sendTasks.push(this.sendEmailAlert(`[${severity}] PSYGStore Alert: ${title}`, emailHtml));
    }

    try {
      await Promise.all(sendTasks);
      logger.info('Alert sent', {
        severity,
        title,
        channels: {
          telegram: !!this.alertConfig.telegram?.botToken && !!this.alertConfig.telegram?.chatId,
          email: !!this.alertConfig.email?.enabled && !!this.emailTransporter,
        },
      });
    } catch (error) {
      logger.error('Failed to send alert', {
        severity,
        title,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Test alert system on all enabled channels
   */
  public async testAlerts(): Promise<{ telegram: boolean; email: boolean }> {
    let telegramOk = false;
    let emailOk = false;

    try {
      if (this.alertConfig.telegram?.botToken && this.alertConfig.telegram?.chatId) {
        await this.sendTelegramAlert(
          this.formatTelegramHtml(
            'INFO',
            'تست سیستم هشدار',
            'این یک پیام تست برای بررسی عملکرد سیستم هشدار است.',
            { test: true, timestamp: new Date().toISOString() }
          )
        );
        telegramOk = true;
      }
    } catch (e) {
      logger.error('Telegram test failed', { error: e instanceof Error ? e.message : e });
    }

    try {
      if (this.alertConfig.email?.enabled && this.emailTransporter) {
        await this.sendEmailAlert(
          '[INFO] PSYGStore Alert: تست سیستم هشدار',
          this.formatEmailHtml(
            'INFO',
            'تست سیستم هشدار',
            'این یک پیام تست برای بررسی عملکرد سیستم هشدار است.',
            { test: true, timestamp: new Date().toISOString() }
          )
        );
        emailOk = true;
      }
    } catch (e) {
      logger.error('Email test failed', { error: e instanceof Error ? e.message : e });
    }

    return { telegram: telegramOk, email: emailOk };
  }

  /**
   * Optional: update config at runtime (used by admin controller)
   * Recreates email transporter if needed.
   */
  public async updateConfig(opts: {
    telegramToken?: string;
    telegramChatId?: string;
    emailEnabled?: boolean;
    emailRecipients?: string[];
    thresholds?: Record<string, any>;
  }): Promise<void> {
    if (typeof opts.telegramToken === 'string') {
      this.alertConfig.telegram = this.alertConfig.telegram || { botToken: '', chatId: '' };
      this.alertConfig.telegram.botToken = opts.telegramToken;
    }
    if (typeof opts.telegramChatId === 'string') {
      this.alertConfig.telegram = this.alertConfig.telegram || { botToken: '', chatId: '' };
      this.alertConfig.telegram.chatId = opts.telegramChatId;
    }
    if (typeof opts.emailEnabled === 'boolean') {
      this.alertConfig.email = this.alertConfig.email || { enabled: false, recipients: [] };
      this.alertConfig.email.enabled = opts.emailEnabled;
    }
    if (Array.isArray(opts.emailRecipients)) {
      this.alertConfig.email = this.alertConfig.email || { enabled: false, recipients: [] };
      this.alertConfig.email.recipients = opts.emailRecipients;
    }

    this.configureEmailTransporter();
    logger.info('AlertService config updated', {
      telegramConfigured:
        !!this.alertConfig.telegram?.botToken && !!this.alertConfig.telegram?.chatId,
      emailEnabled: !!this.alertConfig.email?.enabled,
      recipients: this.alertConfig.email?.recipients?.length || 0,
    });
  }

  /* -------------------------- Channel senders -------------------------- */

  private async sendTelegramAlert(html: string): Promise<void> {
    const bot = this.alertConfig.telegram?.botToken!;
    const chat = this.alertConfig.telegram?.chatId!;
    const url = `https://api.telegram.org/bot${bot}/sendMessage`;

    // Telegram hard limit: 4096 chars — chunk message if needed
    const chunks = this.chunkString(html, 4096);
    for (const chunk of chunks) {
      await axios.post(
        url,
        {
          chat_id: chat,
          text: chunk,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        },
        { timeout: 10_000 }
      );
    }
  }

  private async sendEmailAlert(subject: string, html: string): Promise<void> {
    if (!this.emailTransporter || !this.alertConfig.email?.recipients?.length) return;

    await this.emailTransporter.sendMail({
      from: `${config.email.fromName} <${config.email.fromEmail}>`,
      to: this.alertConfig.email.recipients.join(', '),
      subject,
      html,
    });
  }

  /* -------------------------- Formatters -------------------------- */

  private formatTextBlock(
    severity: Severity,
    title: string,
    message: string,
    metadata?: any
  ): string {
    let out = `[${severity}] ${title}\n\n${message}`;
    if (metadata) {
      try {
        const json = JSON.stringify(metadata, null, 2);
        out += `\n\n--- metadata ---\n${json}`;
      } catch {
        out += `\n\n--- metadata ---\n[unserializable]`;
      }
    }
    out += `\n\nزمان: ${new Date().toLocaleString('fa-IR')}`;
    out += `\nسرور: ${config.app.domain}`;
    return out;
  }

  private formatTelegramHtml(
    severity: Severity,
    title: string,
    message: string,
    metadata?: any
  ): string {
    const esc = (s: string) => this.escapeHtml(s);
    let html =
      `${this.getSeverityEmoji(severity)} <b>PSYGStore Alert</b>\n\n` +
      `<b>${esc(title)}</b>\n\n${esc(message)}`;

    if (metadata) {
      let json = '';
      try {
        json = JSON.stringify(metadata, null, 2);
      } catch {
        json = '[unserializable]';
      }
      // code block
      html += `\n\n<b>جزئیات:</b>\n<pre>${esc(json)}</pre>`;
    }

    html += `\n\n<b>زمان:</b> ${esc(new Date().toLocaleString('fa-IR'))}`;
    html += `\n<b>سرور:</b> ${esc(config.app.domain)}`;
    return html;
    }

  private formatEmailHtml(
    severity: Severity,
    title: string,
    message: string,
    metadata?: any
  ): string {
    const color = this.getSeverityColor(severity);
    let metaHtml = '';
    if (metadata) {
      try {
        const json = JSON.stringify(metadata, null, 2);
        metaHtml = `<h4 style="margin:16px 0 8px 0;">جزئیات</h4>
                    <pre style="background:#fff;border:1px solid #eee;padding:12px;border-radius:6px;white-space:pre-wrap;margin:0;">${this.escapeHtml(
                      json
                    )}</pre>`;
      } catch {
        metaHtml = `<p style="color:#999">Metadata: [unserializable]</p>`;
      }
    }

    return `
      <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;">
        <div style="background:${color};color:#fff;padding:16px 20px;border-radius:12px 12px 0 0;">
          <h2 style="margin:0;">${this.getSeverityEmoji(severity)} PSYGStore Alert</h2>
          <p style="margin:6px 0 0 0;opacity:.9;">${severity} — ${new Date().toLocaleString(
            'fa-IR'
          )}</p>
        </div>
        <div style="background:#f7f7f8;padding:20px;border-radius:0 0 12px 12px;border:1px solid #eee;border-top:none;">
          <h3 style="margin:0 0 12px 0;color:#111;">${this.escapeHtml(title)}</h3>
          <div style="background:#fff;border:1px solid #eee;padding:12px;border-radius:6px;">
            <pre style="white-space:pre-wrap;margin:0;">${this.escapeHtml(message)}</pre>
          </div>
          ${metaHtml}
          <hr style="border:none;border-top:1px solid #e9e9ea;margin:20px 0;" />
          <p style="color:#666;font-size:12px;margin:0;">
            این هشدار از سیستم مانیتورینگ PSYGStore ارسال شده است.<br/>
            سرور: ${this.escapeHtml(config.app.domain)} — زمان: ${new Date().toISOString()}
          </p>
        </div>
      </div>
    `;
  }

  /* -------------------------- Utils -------------------------- */

  private getSeverityEmoji(severity: string): string {
    switch (severity) {
      case 'CRITICAL':
        return '🚨';
      case 'WARNING':
        return '⚠️';
      case 'INFO':
        return 'ℹ️';
      default:
        return '📢';
    }
  }

  private getSeverityColor(severity: string): string {
    switch (severity) {
      case 'CRITICAL':
        return '#dc3545';
      case 'WARNING':
        return '#ffc107';
      case 'INFO':
        return '#17a2b8';
      default:
        return '#6c757d';
    }
  }

  private escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  private chunkString(s: string, limit: number): string[] {
    if (s.length <= limit) return [s];
    const parts: string[] = [];
    let i = 0;
    while (i < s.length) {
      parts.push(s.slice(i, i + limit));
      i += limit;
    }
    return parts;
  }

  private configureEmailTransporter() {
    if (this.alertConfig.email?.enabled && config.email.user && config.email.pass) {
      this.emailTransporter = nodemailer.createTransport({
        host: config.email.host,
        port: config.email.port,
        secure: config.email.secure,
        auth: {
          user: config.email.user,
          pass: config.email.pass,
        },
      });
    } else {
      this.emailTransporter = undefined;
    }
  }
}
