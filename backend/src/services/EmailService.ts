// backend/src/services/EmailService.ts
import nodemailer, { Transporter } from 'nodemailer';
import crypto from 'crypto';
import { config } from '@/config/environment';
import { logger } from '@/utils/logger';
import { prisma } from '@/config/database';

type TemplateKey = 'verify' | 'reset' | '2fa' | 'order';

export class EmailService {
  private transporter?: Transporter;
  private verified = false;

  // cooldown ساده برای جلوگیری از اسپم (ms)
  private cooldownMs: Record<TemplateKey, number> = {
    verify: 60_000, // 1m
    reset: 60_000,  // 1m
    '2fa': 30_000,  // 30s
    order: 15_000,  // 15s
  };
  private lastSent = new Map<string, number>(); // key: `${template}:${to}`

  constructor() {
    if (!this.isEmailConfigured()) {
      logger.warn(
        'Email transport is not configured. Emails will be skipped. ' +
          'Set SMTP_* and FROM_* env vars for production.'
      );
      return;
    }

    // اتصال pool برای کارایی بهتر
    this.transporter = nodemailer.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.secure, // true برای 465
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      auth: (config.email.user && config.email.pass)
        ? { user: config.email.user, pass: config.email.pass }
        : undefined,
      tls: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: process.env.NODE_ENV === 'production',
      },
    });
  }

  /* --------------------------------- Public APIs --------------------------------- */

  /** ارسال ایمیل تأیید آدرس ایمیل */
  public async sendVerificationEmail(userId: string, email: string): Promise<void> {
    if (!(await this.ensureReady('verify', email))) return;

    const token = this.generateToken();

    // در مدل کنونی expiry ندارد؛ اگر افزودی، اینجا ست کن
    await prisma.user.update({
      where: { id: userId },
      data: { emailVerificationToken: token },
    });

    const verificationUrl = this.joinUrl(config.app.baseUrl, `/verify-email?token=${encodeURIComponent(token)}`);
    const subject = 'تأیید ایمیل - سای‌جی';
    const html = this.wrapRtlHtml(`
      <h2 style="color:#39ff14;margin:0 0 12px">تأیید ایمیل</h2>
      <p>سلام،</p>
      <p>برای تأیید ایمیل خود در سای‌جی روی دکمه زیر کلیک کنید:</p>
      <p>
        <a href="${this.esc(verificationUrl)}" style="background:#39ff14;color:#000;padding:10px 20px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:600">
          تأیید ایمیل
        </a>
      </p>
      <p style="color:#666">اگر شما این درخواست را نداده‌اید، این ایمیل را نادیده بگیرید.</p>
    `);
    const text = `برای تأیید ایمیل خود در سای‌جی این لینک را باز کنید:\n${verificationUrl}`;

    await this.sendMail({ to: email, subject, html, text }, 'verify');
    logger.info('Verification email sent', { userId, email });
  }

  /** ارسال ایمیل بازیابی رمز عبور */
  public async sendPasswordResetEmail(userId: string, email: string): Promise<void> {
    if (!(await this.ensureReady('reset', email))) return;

    const token = this.generateToken();
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1h

    await prisma.user.update({
      where: { id: userId },
      data: { passwordResetToken: token, passwordResetExpires: expires },
    });

    const resetUrl = this.joinUrl(config.app.baseUrl, `/reset-password?token=${encodeURIComponent(token)}`);
    const subject = 'بازیابی رمز عبور - سای‌جی';
    const html = this.wrapRtlHtml(`
      <h2 style="color:#39ff14;margin:0 0 12px">بازیابی رمز عبور</h2>
      <p>برای تنظیم رمز عبور جدید روی دکمه زیر کلیک کنید (اعتبار: ۱ ساعت):</p>
      <p>
        <a href="${this.esc(resetUrl)}" style="background:#39ff14;color:#000;padding:10px 20px;text-decoration:none;border-radius:8px;display:inline-block;font-weight:600">
          تنظیم رمز عبور جدید
        </a>
      </p>
      <p style="color:#666">اگر شما این درخواست را نداده‌اید، این ایمیل را نادیده بگیرید.</p>
    `);
    const text = `برای تنظیم رمز عبور جدید این لینک را باز کنید (۱ ساعت اعتبار دارد):\n${resetUrl}`;

    await this.sendMail({ to: email, subject, html, text }, 'reset');
    logger.info('Password reset email sent', { userId, email });
  }

  /** ارسال کد 2FA از طریق ایمیل */
  public async send2FACode(email: string, code: string): Promise<void> {
    if (!(await this.ensureReady('2fa', email))) return;

    const subject = 'کد تأیید دو مرحله‌ای - سای‌جی';
    const safeCode = this.esc(code);
    const html = this.wrapRtlHtml(`
      <h2 style="color:#39ff14;margin:0 0 12px">کد تأیید دو مرحله‌ای</h2>
      <p>کد تأیید شما:</p>
      <div style="background:#f2f2f2;padding:16px;text-align:center;font-size:24px;font-weight:700;letter-spacing:6px;border-radius:8px">
        ${safeCode}
      </div>
      <p style="color:#666">این کد تا ۵ دقیقه معتبر است.</p>
    `);
    const text = `کد تأیید شما: ${code} (اعتبار ۵ دقیقه)`;

    await this.sendMail({ to: email, subject, html, text }, '2fa');
    logger.info('2FA code email sent', { email });
  }

  /** ارسال ایمیل تایید سفارش (اختیاری – اگر ایمیلی وجود نداشت، quietly skip) */
  public async sendOrderConfirmation(userId: string, orderDetails: any): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, fullName: true },
    });
    const to = user?.email;
    if (!to) {
      logger.warn('Order confirmation skipped: user has no email', { userId });
      return;
    }
    if (!(await this.ensureReady('order', to))) return;

    const subject = 'تأیید سفارش - سای‌جی';
    const price = Number(orderDetails.totalPrice);
    const html = this.wrapRtlHtml(`
      <h2 style="color:#39ff14;margin:0 0 12px">سفارش شما ثبت شد</h2>
      <p>سلام ${this.esc(user?.fullName || '')}،</p>
      <p>سفارش شما با موفقیت ثبت شد و در حال پردازش است.</p>
      <div style="background:#f9f9f9;padding:16px;border-radius:8px;margin:16px 0">
        <h3 style="margin:0 0 8px">جزئیات سفارش</h3>
        <p><strong>شناسه سفارش:</strong> ${this.esc(String(orderDetails.id))}</p>
        <p><strong>محصول:</strong> ${this.esc(String(orderDetails.productId))}</p>
        <p><strong>گزینه:</strong> ${this.esc(String(orderDetails.optionName))}</p>
        <p><strong>مبلغ:</strong> ${Number.isFinite(price) ? price.toLocaleString('fa-IR') : this.esc(String(price))} تومان</p>
      </div>
      <p>به‌زودی سفارش شما پردازش خواهد شد.</p>
    `);
    const text =
      `سفارش شما ثبت شد\n` +
      `شناسه: ${orderDetails.id}\nمحصول: ${orderDetails.productId}\nگزینه: ${orderDetails.optionName}\n` +
      `مبلغ: ${Number.isFinite(price) ? price.toLocaleString('fa-IR') : price} تومان\n`;

    await this.sendMail({ to, subject, html, text }, 'order');
    logger.info('Order confirmation email sent', { userId, orderId: orderDetails.id });
  }

  /* --------------------------------- Helpers --------------------------------- */

  private isEmailConfigured(): boolean {
    return Boolean(
      config.email.host &&
        config.email.port &&
        (config.email.user || config.email.secure === false) && // امکان SMTP بدون auth در برخی سرورها
        config.email.fromEmail
    );
  }

  private async ensureReady(template: TemplateKey, to: string): Promise<boolean> {
    // پیکربندی
    if (!this.isEmailConfigured() || !this.transporter) {
      logger.warn('Email not configured, skipping send.', { template, to });
      return false;
    }

    // cooldown ضداسپم
    const key = `${template}:${to.toLowerCase()}`;
    const now = Date.now();
    const last = this.lastSent.get(key) || 0;
    if (now - last < this.cooldownMs[template]) {
      logger.warn('Email suppressed by cooldown', {
        template,
        to,
        remainMs: this.cooldownMs[template] - (now - last),
      });
      return false;
    }

    // verify فقط یک‌بار
    if (!this.verified) {
      try {
        await this.transporter.verify();
        this.verified = true;
        logger.info('SMTP transport verified and ready');
      } catch (err: any) {
        logger.error('SMTP transport verification failed', { error: err?.message || err });
        if (process.env.NODE_ENV === 'production') {
          throw err;
        }
        return false;
      }
    }

    return true;
  }

  private async sendMail(
    opts: { to: string; subject: string; html: string; text?: string; replyTo?: string },
    template: TemplateKey
  ) {
    const from = `${config.email.fromName || 'PSYGStore'} <${config.email.fromEmail}>`;
    const messageId = `<${Date.now().toString(36)}.${Math.random().toString(36).slice(2)}@${config.app.domain}>`;

    try {
      await this.transporter!.sendMail({
        from,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
        replyTo: opts.replyTo,
        headers: {
          'X-PSYG-Template': template,
          'X-App-Env': config.app.env,
          'X-PSYG-Domain': config.app.domain,
        },
        messageId,
      });

      // ثبت زمان ارسال برای cooldown
      const key = `${template}:${opts.to.toLowerCase()}`;
      this.lastSent.set(key, Date.now());
    } catch (error: any) {
      logger.error('Failed to send email', {
        to: opts.to,
        subject: opts.subject,
        template,
        error: error?.message || error,
      });
      throw error;
    }
  }

  private generateToken(bytes = 32): string {
    return crypto.randomBytes(bytes).toString('hex');
  }

  private wrapRtlHtml(inner: string): string {
    return `
      <div dir="rtl" style="font-family:Arial, sans-serif; max-width:640px; margin:0 auto; line-height:1.7">
        ${inner}
        <hr style="border:none;border-top:1px solid #eee;margin:24px 0" />
        <p style="color:#888;font-size:12px">
          ${this.esc(config.app.name)} • ${this.esc(config.app.domain)} • ${new Date().toLocaleString('fa-IR')}
        </p>
      </div>
    `;
  }

  private joinUrl(base: string, p: string) {
    try {
      return new URL(p, base).toString();
    } catch {
      const b = (base || '').replace(/\/+$/, '');
      const path = p.startsWith('/') ? p : `/${p}`;
      return `${b}${path}`;
    }
  }

  private esc(s: string) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
