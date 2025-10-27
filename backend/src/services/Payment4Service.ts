// backend/src/services/Payment4Service.ts
import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';
import { config } from '@/config/environment';
import { logger, paymentLogger } from '@/utils/logger';

type CurrencyCode = 'USDT' | 'BTC' | 'ETH' | 'TON';

type ProviderStatus = 'pending' | 'completed' | 'failed' | 'cancelled' | 'expired' | string;
type NormalizedStatus = 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'EXPIRED' | 'UNKNOWN';

interface Payment4Envelope<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

interface Payment4CreateData {
  payment_id: string;
  payment_url: string;
  qr_code?: string;
  wallet_address: string;
  amount: number;
  currency: string;
}

interface Payment4VerifyData {
  status: ProviderStatus;
  transaction_hash?: string;
  amount: number;
  currency: string;
  confirmed_at?: string;
}

export type CreatePaymentResult = {
  success: boolean;
  paymentId?: string;
  paymentUrl?: string;
  walletAddress?: string;
  qrCode?: string;
  message?: string;
};

export type VerifyPaymentResult = {
  success: boolean;
  status?: NormalizedStatus;
  rawStatus?: string;
  transactionHash?: string;
  message?: string;
};

export class Payment4Service {
  private apiKey: string;
  private sandbox: boolean;
  private http!: AxiosInstance;
  private webhookSecret: string;
  private configured = false;

  constructor() {
    this.apiKey = config.payment4.apiKey;
    this.sandbox = config.payment4.sandbox;
    this.webhookSecret = process.env.PAYMENT4_WEBHOOK_SECRET || this.apiKey; // سازگاری عقب‌رو

    if (!this.apiKey) {
      logger.warn('Payment4Service: API key is missing. Service is not configured.');
      return;
    }

    const baseURL = (this.sandbox ? 'https://sandbox-api.payment4.io/v1/' : 'https://api.payment4.io/v1/').replace(
      /\/+$/g,
      '/'
    );

    this.http = axios.create({
      baseURL,
      timeout: 30_000,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      withCredentials: false,
    });

    this.configured = true;
  }

  public isConfigured(): boolean {
    return this.configured;
  }

  /** backoff سبک برای خطاهای شبکه/۵xx */
  private async requestWithRetry<T>(
    fn: () => Promise<{ data: Payment4Envelope<T> }>,
    retries = 2
  ): Promise<Payment4Envelope<T>> {
    let attempt = 0;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms + Math.floor(Math.random() * 150)));

    // 0, 250ms, 500ms backoff با jitter
    while (true) {
      try {
        const res = await fn();
        return res.data;
      } catch (err: any) {
        const status = err?.response?.status as number | undefined;
        const isRetryable = !status || (status >= 500 && status < 600) || err.code === 'ECONNABORTED';
        if (attempt < retries && isRetryable) {
          attempt++;
          await sleep(250 * attempt);
          continue;
        }
        // لاگ جزئیات خطای غیر قابل تکرار
        paymentLogger.error('Payment4 request failed', {
          attempt,
          status,
          code: err?.code,
          msg: err?.message,
        });
        throw err;
      }
    }
  }

  private normalizeCurrency(c: string): CurrencyCode {
    const up = (c || '').toUpperCase();
    if (up === 'USDT' || up === 'BTC' || up === 'ETH' || up === 'TON') return up;
    return 'USDT';
  }

  private normalizeStatus(s: ProviderStatus): NormalizedStatus {
    const v = String(s || '').toLowerCase();
    if (v === 'pending') return 'PENDING';
    if (v === 'completed') return 'COMPLETED';
    if (v === 'failed') return 'FAILED';
    if (v === 'cancelled') return 'CANCELLED';
    if (v === 'expired') return 'EXPIRED';
    return 'UNKNOWN';
  }

  /**
   * Create crypto payment request
   */
  public async createPayment(
    amount: number,
    currency: string,
    description: string,
    orderId?: string,
    userId?: string
  ): Promise<CreatePaymentResult> {
    if (!this.configured) {
      return { success: false, message: 'درگاه پرداخت ارزی پیکربندی نشده است' };
    }

    const cur = this.normalizeCurrency(currency);
    const amountNum = Number(amount);

    try {
      const payload = {
        amount: amountNum,
        currency: cur,
        description: String(description || '').substring(0, 255),
        callback_url: config.payment4.callbackUrl,
        metadata: {
          order_id: orderId,
          user_id: userId,
          timestamp: Date.now(),
        },
        wallet_address: this.getStoreWalletAddress(cur),
      };

      const idemKey = crypto.randomUUID();

      const envelope = await this.requestWithRetry<Payment4CreateData>(() =>
        this.http.post('payments', payload, {
          headers: { 'Idempotency-Key': idemKey },
        })
      );

      if (envelope.success && envelope.data) {
        const d = envelope.data;

        paymentLogger.info('Payment4 payment request created', {
          paymentId: d.payment_id,
          amount: amountNum,
          currency: cur,
          userId,
        });

        return {
          success: true,
          paymentId: d.payment_id,
          paymentUrl: d.payment_url,
          walletAddress: d.wallet_address,
          qrCode: d.qr_code,
        };
      }

      paymentLogger.warn('Payment4 payment request failed', {
        amount: amountNum,
        currency: cur,
        error: envelope.error,
        message: envelope.message,
      });

      return {
        success: false,
        message: envelope.message || 'خطا در ایجاد درخواست پرداخت ارزی',
      };
    } catch (error: any) {
      paymentLogger.error('Payment4 API error (createPayment)', {
        amount: amountNum,
        currency: cur,
        error: error?.message || 'Unknown error',
      });

      return { success: false, message: 'خطا در ارتباط با درگاه پرداخت ارزی' };
    }
  }

  /**
   * Verify crypto payment
   */
  public async verifyPayment(paymentId: string): Promise<VerifyPaymentResult> {
    if (!this.configured) {
      return { success: false, message: 'درگاه پرداخت ارزی پیکربندی نشده است' };
    }

    try {
      const envelope = await this.requestWithRetry<Payment4VerifyData>(() =>
        this.http.get(`payments/${paymentId}`, { timeout: 15_000 })
      );

      if (envelope.success && envelope.data) {
        const d = envelope.data;
        const normalized = this.normalizeStatus(d.status);
        return {
          success: true,
          status: normalized,
          rawStatus: d.status,
          transactionHash: d.transaction_hash,
        };
      }

      return {
        success: false,
        message: envelope.message || 'خطا در تأیید پرداخت',
      };
    } catch (error: any) {
      paymentLogger.error('Payment4 verification error', {
        paymentId,
        error: error?.message || 'Unknown error',
      });
      return { success: false, message: 'خطا در تأیید پرداخت ارزی' };
    }
  }

  /**
   * Get supported currencies
   */
  public async getSupportedCurrencies(): Promise<{
    success: boolean;
    currencies?: Array<{ code: CurrencyCode; name: string; network: string }>;
  }> {
    if (!this.configured) {
      // Fallback اگر کانفیگ نیست
      return {
        success: true,
        currencies: [
          { code: 'USDT', name: 'Tether', network: 'Ethereum' },
          { code: 'BTC', name: 'Bitcoin', network: 'Bitcoin' },
          { code: 'ETH', name: 'Ethereum', network: 'Ethereum' },
          { code: 'TON', name: 'Toncoin', network: 'TON' },
        ],
      };
    }

    try {
      const res = await this.requestWithRetry<any>(() => this.http.get('currencies', { timeout: 10_000 }));

      if (res.success && Array.isArray(res.data)) {
        const mapped = res.data.map((c: any) => ({
          code: this.normalizeCurrency(c.code) as CurrencyCode,
          name: String(c.name || ''),
          network: String(c.network || ''),
        }));
        return { success: true, currencies: mapped };
      }
    } catch (error: any) {
      logger.error('Error getting supported currencies', { error: error?.message });
    }

    // Fallback
    return {
      success: true,
      currencies: [
        { code: 'USDT', name: 'Tether', network: 'Ethereum' },
        { code: 'BTC', name: 'Bitcoin', network: 'Bitcoin' },
        { code: 'ETH', name: 'Ethereum', network: 'Ethereum' },
        { code: 'TON', name: 'Toncoin', network: 'TON' },
      ],
    };
  }

  /**
   * Verify webhook signature
   * - payload باید RAW باشد (Buffer یا string)
   * - امضا Hex فرض می‌شود
   */
  public verifyWebhookSignature(payloadRaw: Buffer | string, signature: string): boolean {
    try {
      const raw = Buffer.isBuffer(payloadRaw) ? payloadRaw : Buffer.from(payloadRaw, 'utf8');

      const expected = crypto.createHmac('sha256', this.webhookSecret).update(raw).digest('hex');

      const a = Buffer.from((signature || '').trim(), 'hex');
      const b = Buffer.from(expected, 'hex');

      return a.length === b.length && crypto.timingSafeEqual(a, b);
    } catch (error) {
      logger.error('Error verifying webhook signature', { error: (error as any)?.message });
      return false;
    }
  }

  /**
   * Get store wallet address per currency
   */
  private getStoreWalletAddress(currency: CurrencyCode): string {
    switch (currency) {
      case 'TON': {
        if (!config.crypto.storeTonWallet) {
          logger.warn('TON wallet address is not configured');
        }
        return config.crypto.storeTonWallet;
      }
      case 'USDT':
      case 'ETH':
      case 'BTC':
      default: {
        if (!config.crypto.storeEthWallet) {
          logger.warn('ETH/BTC/USDT wallet address is not configured');
        }
        return config.crypto.storeEthWallet;
      }
    }
  }
}
