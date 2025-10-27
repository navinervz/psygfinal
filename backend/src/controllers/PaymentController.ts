// backend/src/controllers/PaymentController.ts
import { Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '@/config/database';
import { AuthenticatedRequest } from '@/middleware/auth';
import { logger, paymentLogger } from '@/utils/logger';
import { AppError, ValidationError, PaymentError } from '@/utils/AppError';
import { ZarinpalService } from '@/services/ZarinpalService';
import { Payment4Service } from '@/services/Payment4Service';
import { PriceUpdateService } from '@/services/PriceUpdateService';
import { config } from '@/config/environment';

type AnyObj = Record<string, any>;

const toBigInt = (v: number | string | bigint) =>
  typeof v === 'bigint' ? v : BigInt(Math.floor(Number(v)));

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

export class PaymentController {
  private zarinpalService = new ZarinpalService();
  private payment4Service = new Payment4Service();
  private priceUpdateService = new PriceUpdateService();

  /* ------------------------------------------------------------------ */
  /*                       ZarinPal (Rial) Payments                      */
  /* ------------------------------------------------------------------ */

  /**
   * Create ZarinPal payment request
   */
  public createZarinpalPayment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const { amount, description, orderId } = req.body as {
      amount: number;
      description: string;
      orderId?: string;
    };

    // amount به تومان
    if (amount < 1_000 || amount > 50_000_000) {
      throw new ValidationError('Amount must be between 1,000 and 50,000,000 Toman');
    }

    try {
      // 1) درخواست پرداخت نزد درگاه
      const paymentResult = await this.zarinpalService.createPayment(amount, description, orderId);
      if (!paymentResult.success || !paymentResult.authority || !paymentResult.paymentUrl) {
        throw new PaymentError('Failed to create payment request', paymentResult as AnyObj);
      }

      // 2) ثبت رکورد درخواست پرداخت
      const paymentRequest = await prisma.paymentRequest.create({
        data: {
          userId,
          authority: paymentResult.authority,
          amount,
          description,
          orderId,
          status: 'PENDING',
          provider: 'ZARINPAL',
        },
      });

      paymentLogger.info('ZarinPal payment request created', {
        id: (req as AnyObj).id,
        userId,
        paymentId: paymentRequest.id,
        authority: paymentResult.authority,
        amount,
        ip: req.ip,
      });

      res.json({
        success: true,
        paymentUrl: paymentResult.paymentUrl,
        authority: paymentResult.authority,
        amount,
      });
    } catch (error) {
      paymentLogger.error('ZarinPal payment creation failed', {
        id: (req as AnyObj).id,
        userId,
        amount,
        error: error instanceof Error ? error.message : 'Unknown error',
        ip: req.ip,
      });
      throw error;
    }
  };

  /**
   * Verify ZarinPal payment (after user redirect)
   */
  public verifyZarinpalPayment = async (req: Request, res: Response): Promise<void> => {
    const authority = String(req.query.Authority || '');
    const status = String(req.query.Status || '');

    if (!authority) throw new ValidationError('Authority parameter is required');

    const paymentRequest = await prisma.paymentRequest.findUnique({
      where: { authority },
      include: { user: true },
    });
    if (!paymentRequest) throw new AppError('Payment request not found', 404);

    // اگر قبلاً تکمیل شده، پاسخ idempotent
    if (paymentRequest.status === 'COMPLETED') {
      return res.json({
        success: true,
        message: 'Payment already completed',
        refId: paymentRequest.refId,
        amount: Number(paymentRequest.amount),
      });
    }

    if (status !== 'OK') {
      await prisma.paymentRequest.update({
        where: { authority },
        data: { status: 'FAILED' },
      });

      paymentLogger.warn('ZarinPal payment failed', {
        authority,
        status,
        userId: paymentRequest.userId,
      });

      res.json({
        success: false,
        message: 'Payment was cancelled or failed',
      });
      return;
    }

    try {
      // تماس با درگاه برای تایید
      const verificationResult = await this.zarinpalService.verifyPayment(
        authority,
        Number(paymentRequest.amount)
      );

      if (verificationResult.success) {
        // تراکنش اتمی + ضد-دابل‌شارژ: فقط اگر هنوز COMPLETED نشده بود
        await prisma.$transaction(async (tx) => {
          const updated = await tx.paymentRequest.updateMany({
            where: { authority, status: { not: 'COMPLETED' } },
            data: { status: 'COMPLETED', refId: verificationResult.refId },
          });

          if (updated.count > 0) {
            await tx.user.update({
              where: { id: paymentRequest.userId },
              data: {
                walletBalanceRial: { increment: toBigInt(paymentRequest.amount) },
              },
            });
          }
        });

        paymentLogger.info('ZarinPal payment completed', {
          authority,
          refId: verificationResult.refId,
          amount: Number(paymentRequest.amount),
          userId: paymentRequest.userId,
        });

        res.json({
          success: true,
          message: 'Payment completed successfully',
          refId: verificationResult.refId,
          amount: Number(paymentRequest.amount),
        });
      } else {
        await prisma.paymentRequest.update({
          where: { authority },
          data: { status: 'FAILED' },
        });

        paymentLogger.warn('ZarinPal payment verification failed', {
          authority,
          error: verificationResult.message,
          userId: paymentRequest.userId,
        });

        res.json({
          success: false,
          message: verificationResult.message || 'Payment verification failed',
        });
      }
    } catch (error) {
      paymentLogger.error('ZarinPal verification error', {
        authority,
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: paymentRequest.userId,
      });
      throw error;
    }
  };

  /**
   * ZarinPal callback handler (server-to-server)
   * فقط ریدایرکت سمت فرانت را انجام می‌دهد.
   */
  public zarinpalCallback = async (req: Request, res: Response): Promise<void> => {
    const authority = String(req.query.Authority || '');
    const status = String(req.query.Status || '');
    const frontend = config.app.baseUrl || `https://${config.app.domain}`;
    const u = new URL(frontend);

    if (status === 'OK' && authority) {
      u.pathname = '/payment/success';
      u.searchParams.set('authority', authority);
    } else {
      u.pathname = '/payment/failed';
      if (authority) u.searchParams.set('authority', authority);
    }
    res.redirect(u.toString());
  };

  /* ------------------------------------------------------------------ */
  /*                          Crypto (Payment4)                          */
  /* ------------------------------------------------------------------ */

  /**
   * Create crypto payment request
   */
  public createCryptoPayment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const { amount, currency, description, orderId } = req.body as {
      amount: number;
      currency: 'USDT' | 'BTC' | 'ETH' | 'TON';
      description: string;
      orderId?: string;
    };

    // نرخ فعلی
    const currentPrices = await this.priceUpdateService.getCurrentPrices();
    const exchangeRate = (currentPrices as AnyObj)[currency];
    if (!exchangeRate) throw new AppError('Exchange rate not available', 503);

    try {
      // ایجاد درخواست نزد ارائه‌دهنده
      const paymentResult = await this.payment4Service.createPayment(
        amount,
        currency,
        description,
        orderId,
        userId
      );
      if (!paymentResult.success || !paymentResult.paymentId) {
        throw new PaymentError('Failed to create crypto payment request', paymentResult as AnyObj);
      }

      // ثبت در DB
      const cryptoPaymentRequest = await prisma.cryptoPaymentRequest.create({
        data: {
          userId,
          paymentId: paymentResult.paymentId,
          amount,
          currency,
          description,
          orderId,
          status: 'PENDING',
          walletAddress: paymentResult.walletAddress ?? null,
          exchangeRate,
          provider: 'PAYMENT4',
        },
      });

      const tomanEquivalent = Math.floor(Number(amount) * Number(exchangeRate));

      paymentLogger.info('Crypto payment request created', {
        id: (req as AnyObj).id,
        userId,
        paymentId: paymentResult.paymentId,
        amount,
        currency,
        exchangeRate,
        ip: req.ip,
      });

      res.json({
        success: true,
        paymentId: paymentResult.paymentId,
        paymentUrl: paymentResult.paymentUrl,
        walletAddress: paymentResult.walletAddress,
        amount,
        currency,
        exchangeRate,
        tomanEquivalent,
      });
    } catch (error) {
      paymentLogger.error('Crypto payment creation failed', {
        id: (req as AnyObj).id,
        userId,
        amount,
        currency,
        error: error instanceof Error ? error.message : 'Unknown error',
        ip: req.ip,
      });
      throw error;
    }
  };

  /**
   * Verify crypto payment (client poll)
   */
  public verifyCryptoPayment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const paymentId = String(req.params.paymentId);
    const userId = req.user!.id;

    const paymentRequest = await prisma.cryptoPaymentRequest.findFirst({
      where: { paymentId, userId },
    });
    if (!paymentRequest) throw new AppError('Payment request not found', 404);

    // اگر قبلاً تکمیل شده، پاسخ idempotent
    if (paymentRequest.status === 'COMPLETED') {
      return res.json({
        success: true,
        status: 'completed',
        transactionHash: paymentRequest.transactionHash,
        amount: Number(paymentRequest.amount),
        currency: paymentRequest.currency,
        tomanEquivalent: Math.floor(Number(paymentRequest.amount) * Number(paymentRequest.exchangeRate)),
      });
    }

    try {
      const verificationResult = await this.payment4Service.verifyPayment(paymentId);
      const status = (verificationResult.status || 'pending').toLowerCase();

      if (verificationResult.success && status === 'completed') {
        await prisma.$transaction(async (tx) => {
          // فقط اگر هنوز تکمیل نشده بود، آپدیت و شارژ کن
          const updated = await tx.cryptoPaymentRequest.updateMany({
            where: { paymentId, status: { not: 'COMPLETED' } },
            data: {
              status: 'COMPLETED',
              transactionHash: verificationResult.transactionHash || paymentRequest.transactionHash || null,
              confirmedAt: new Date(),
            },
          });

          if (updated.count > 0) {
            const tomanAmount = Math.floor(Number(paymentRequest.amount) * Number(paymentRequest.exchangeRate));
            await tx.user.update({
              where: { id: userId },
              data: { walletBalanceRial: { increment: toBigInt(tomanAmount) } },
            });
          }
        });

        paymentLogger.info('Crypto payment completed', {
          paymentId,
          transactionHash: verificationResult.transactionHash,
          amount: Number(paymentRequest.amount),
          currency: paymentRequest.currency,
          userId,
        });

        res.json({
          success: true,
          status: 'completed',
          transactionHash: verificationResult.transactionHash,
          amount: Number(paymentRequest.amount),
          currency: paymentRequest.currency,
          tomanEquivalent: Math.floor(Number(paymentRequest.amount) * Number(paymentRequest.exchangeRate)),
        });
      } else {
        res.json({
          success: true,
          status,
          message: this.getPaymentStatusMessage(status),
        });
      }
    } catch (error) {
      paymentLogger.error('Crypto payment verification failed', {
        paymentId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  };

  /**
   * Crypto payment callback (webhook)
   * - امضا بررسی می‌شود (HMAC)
   * - idempotent: اگر قبلاً تکمیل شده بود، دوباره شارژ نمی‌کنیم
   */
  public cryptoCallback = async (req: Request, res: Response): Promise<void> => {
    const paymentId = String((req.body?.payment_id ?? '')).trim();
    const status = String((req.body?.status ?? '')).toLowerCase();
    const transactionHash = (req.body?.transaction_hash as string) || null;

    if (!paymentId || !status) throw new ValidationError('Missing required fields');

    // Verify webhook signature (MANDATORY)
    const signature = req.headers['x-payment4-signature'] as string;
    if (!signature) {
      paymentLogger.warn('Missing Payment4 signature', { ip: req.ip });
      return res.status(401).json({ error: 'Missing signature' });
    }

    const raw =
      (req as AnyObj).rawBody ? (req as AnyObj).rawBody : Buffer.from(JSON.stringify(req.body));
    const ok = this.payment4Service?.verifyWebhookSignature
      ? this.payment4Service.verifyWebhookSignature(raw, signature)
      : (() => {
          const secret = process.env.PAYMENT4_WEBHOOK_SECRET || '';
          const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');
          const a = Buffer.from((signature || '').trim(), 'hex');
          const b = Buffer.from(expected, 'hex');
          return a.length === b.length && crypto.timingSafeEqual(a, b);
        })();

    if (!ok) {
      paymentLogger.warn('Invalid Payment4 signature', { ip: req.ip });
      return res.status(401).json({ error: 'Invalid signature' });
    }

    try {
      const paymentRequest = await prisma.cryptoPaymentRequest.findUnique({ where: { paymentId } });
      if (!paymentRequest) throw new AppError('Payment request not found', 404);

      // ضد-دابل‌شارژ با updateMany مشروط
      await prisma.$transaction(async (tx) => {
        const updated = await tx.cryptoPaymentRequest.updateMany({
          where: { paymentId, status: { not: 'COMPLETED' } },
          data: {
            status: status.toUpperCase(),
            transactionHash,
            ...(status === 'completed' ? { confirmedAt: new Date() } : {}),
          },
        });

        if (updated.count > 0 && status === 'completed') {
          const tomanAmount = Math.floor(Number(paymentRequest.amount) * Number(paymentRequest.exchangeRate));
          await tx.user.update({
            where: { id: paymentRequest.userId },
            data: { walletBalanceRial: { increment: toBigInt(tomanAmount) } },
          });

          paymentLogger.info('Crypto payment webhook processed', {
            paymentId,
            status,
            transactionHash,
            userId: paymentRequest.userId,
            tomanAmount,
          });
        }
      });

      res.json({ success: true });
    } catch (error) {
      paymentLogger.error('Crypto payment webhook error', {
        paymentId,
        status,
        error: error instanceof Error ? error.message : 'Unknown error',
        ip: req.ip,
      });
      throw error;
    }
  };

  /* ------------------------------------------------------------------ */
  /*                              Prices                                 */
  /* ------------------------------------------------------------------ */

  /**
   * Get current crypto prices
   */
  public getCurrentPrices = async (_req: Request, res: Response): Promise<void> => {
    try {
      const prices = await this.priceUpdateService.getCurrentPrices();
      res.json({ success: true, prices, timestamp: new Date().toISOString() });
    } catch (error) {
      logger.error('Error getting current prices', { error: (error as any)?.message });
      throw new AppError('Failed to get current prices', 503);
    }
  };

  /**
   * Get price history
   */
  public getPriceHistory = async (req: Request, res: Response): Promise<void> => {
    const currency = String(req.params.currency || '').toUpperCase();
    const days = clamp(Number(req.query.days ?? 7), 1, 365);

    try {
      const history = await this.priceUpdateService.getPriceHistory(currency, days);
      res.json({ success: true, currency, history, days });
    } catch (error) {
      logger.error(`Error getting price history for ${currency}`, { error: (error as any)?.message });
      throw new AppError('Failed to get price history', 503);
    }
  };

  /**
   * Get list of supported currencies from Payment4
   */
  public getSupportedCurrencies = async (_req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.payment4Service.getSupportedCurrencies();
      const currencies =
        Array.isArray((result as AnyObj).currencies) && (result as AnyObj).currencies.length > 0
          ? (result as AnyObj).currencies
          : [
              { code: 'USDT', name: 'Tether', network: 'Ethereum' },
              { code: 'BTC', name: 'Bitcoin', network: 'Bitcoin' },
              { code: 'ETH', name: 'Ethereum', network: 'Ethereum' },
              { code: 'TON', name: 'Toncoin', network: 'TON' },
            ];

      res.json({ success: true, currencies });
    } catch (error) {
      paymentLogger.error('Failed to fetch Payment4 supported currencies', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(503).json({ success: false, error: 'Unable to fetch supported currencies' });
    }
  };

  /* ------------------------------------------------------------------ */

  /**
   * Human-friendly payment status (fa-IR)
   */
  private getPaymentStatusMessage(status: string): string {
    const s = status.toLowerCase();
    const messages: Record<string, string> = {
      pending: 'در انتظار پرداخت',
      completed: 'پرداخت تکمیل شد',
      failed: 'پرداخت ناموفق',
      expired: 'مهلت پرداخت منقضی شد',
      cancelled: 'پرداخت لغو شد',
    };
    return messages[s] || 'وضعیت نامشخص';
  }
}
