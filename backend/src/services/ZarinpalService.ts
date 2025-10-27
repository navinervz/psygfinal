// backend/src/services/ZarinpalService.ts
import axios, { AxiosInstance } from 'axios';
import { config } from '@/config/environment';
import { paymentLogger } from '@/utils/logger';

interface ZarinpalEnvelope<T> {
  data: T;
  errors?: Array<{ code?: number; message?: string }>;
}

interface ZarinpalRequestData {
  code: number;
  message: string;
  authority?: string;
  fee_type?: string;
  fee?: number;
}

interface ZarinpalVerifyData {
  code: number;
  message: string;
  card_hash?: string;
  card_pan?: string;
  ref_id?: number;
  fee_type?: string;
  fee?: number;
}

export type CreatePaymentResult = {
  success: boolean;
  authority?: string;
  paymentUrl?: string;
  message?: string;
};

export type VerifyPaymentResult = {
  success: boolean;
  refId?: string;
  message?: string;
};

export class ZarinpalService {
  private merchantId: string;
  private sandbox: boolean;
  private http: AxiosInstance;

  constructor() {
    this.merchantId = config.zarinpal.merchantId;
    this.sandbox = config.zarinpal.sandbox;

    const baseURL = this.sandbox
      ? 'https://sandbox.zarinpal.com/pg/rest/WebGate/'
      : 'https://api.zarinpal.com/pg/rest/WebGate/';

    this.http = axios.create({
      baseURL,
      timeout: 30_000,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      withCredentials: false,
    });
  }

  /* ------------------------------- Utils ------------------------------- */

  private isConfigured(): boolean {
    return Boolean(this.merchantId && config.zarinpal.callbackUrl);
  }

  private sanitizeDescription(s: string): string {
    const trimmed = String(s || '').replace(/[\r\n]+/g, ' ').slice(0, 255);
    return trimmed || 'پرداخت در سای‌جی';
  }

  /** Backoff با jitter برای خطاهای شبکه/۵xx/timeout */
  private async postWithRetry<TReq, TRes>(
    url: string,
    payload: TReq,
    retries = 2
  ): Promise<ZarinpalEnvelope<TRes>> {
    let attempt = 0;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms + Math.floor(Math.random() * 150)));

    // همه درخواست‌ها log context مختصر بگیرند (بدون لو دادن اطلاعات حساس)
    while (true) {
      try {
        const res = await this.http.post<ZarinpalEnvelope<TRes>>(url, payload, { timeout: 30_000 });
        return res.data;
      } catch (err: any) {
        const status = err?.response?.status as number | undefined;
        const isRetryable = !status || (status >= 500 && status < 600) || err.code === 'ECONNABORTED';
        if (attempt < retries && isRetryable) {
          attempt++;
          await sleep(250 * attempt);
          continue;
        }
        throw err;
      }
    }
  }

  /** ساخت URL شروع پرداخت */
  private getStartPayUrl(authority: string): string {
    return this.sandbox
      ? `https://sandbox.zarinpal.com/pg/StartPay/${authority}`
      : `https://www.zarinpal.com/pg/StartPay/${authority}`;
  }

  /* --------------------------- Public methods -------------------------- */

  /**
   * Create payment request (amount بر حسب «تومان»)
   */
  public async createPayment(amount: number, description: string, orderId?: string): Promise<CreatePaymentResult> {
    if (!this.isConfigured()) {
      paymentLogger.warn('ZarinPal not configured; skipping PaymentRequest');
      return { success: false, message: 'درگاه پرداخت پیکربندی نشده است' };
    }

    const amt = Math.floor(Number(amount) || 0);
    const desc = this.sanitizeDescription(description);

    try {
      const payload = {
        merchant_id: this.merchantId,
        amount: amt,
        description: desc,
        callback_url: config.zarinpal.callbackUrl,
        metadata: {
          order_id: orderId,
          timestamp: Date.now(),
        },
      };

      const envelope = await this.postWithRetry<typeof payload, ZarinpalRequestData>('PaymentRequest.json', payload);

      // اگر خودِ API فیلد errors برگردوند، برای لاگ‌ بهتر ثبت کنیم
      if (Array.isArray(envelope.errors) && envelope.errors.length) {
        paymentLogger.warn('ZarinPal PaymentRequest returned errors[]', {
          errors: envelope.errors.map((e) => e.message || e.code),
        });
      }

      const { data } = envelope;

      if (data.code === 100 && data.authority) {
        const authority = data.authority;
        const paymentUrl = this.getStartPayUrl(authority);

        paymentLogger.info('ZarinPal payment request created', { authority, amount: amt });
        return { success: true, authority, paymentUrl };
      }

      const message = this.getStatusMessage(data.code);
      paymentLogger.warn('ZarinPal payment request failed', { code: data.code, message, amount: amt });
      return { success: false, message };
    } catch (error: any) {
      paymentLogger.error('ZarinPal API error (PaymentRequest)', {
        error: error?.message || 'Unknown error',
        amount: amt,
        // description را لاگ نکن برای حریم خصوصی/طول
      });
      return { success: false, message: 'خطا در ارتباط با درگاه پرداخت' };
    }
  }

  /**
   * Verify payment
   */
  public async verifyPayment(authority: string, amount: number): Promise<VerifyPaymentResult> {
    if (!this.isConfigured()) {
      paymentLogger.warn('ZarinPal not configured; skipping PaymentVerification');
      return { success: false, message: 'درگاه پرداخت پیکربندی نشده است' };
    }

    const amt = Math.floor(Number(amount) || 0);

    try {
      const payload = {
        merchant_id: this.merchantId,
        authority,
        amount: amt,
      };

      const envelope = await this.postWithRetry<typeof payload, ZarinpalVerifyData>('PaymentVerification.json', payload);

      if (Array.isArray(envelope.errors) && envelope.errors.length) {
        paymentLogger.warn('ZarinPal PaymentVerification returned errors[]', {
          authority,
          errors: envelope.errors.map((e) => e.message || e.code),
        });
      }

      const { data } = envelope;

      // 100: موفق | 101: قبلاً تایید شده
      if (data.code === 100 || data.code === 101) {
        paymentLogger.info('ZarinPal payment verified', {
          authority,
          refId: data.ref_id,
          amount: amt,
          code: data.code,
        });
        return { success: true, refId: data.ref_id?.toString() };
      }

      const message = this.getStatusMessage(data.code);
      paymentLogger.warn('ZarinPal payment verification failed', { authority, code: data.code, message, amount: amt });
      return { success: false, message };
    } catch (error: any) {
      paymentLogger.error('ZarinPal API error (PaymentVerification)', {
        authority,
        amount: amt,
        error: error?.message || 'Unknown error',
      });
      return { success: false, message: 'خطا در تأیید پرداخت' };
    }
  }

  /** نگاشت کدهای وضعیت زرین‌پال به پیام فارسی */
  private getStatusMessage(code: number): string {
    const messages: Record<number, string> = {
      [-1]: 'اطلاعات ارسال شده ناقص است',
      [-2]: 'IP یا مرچنت کد پذیرنده صحیح نیست',
      [-3]: 'با توجه به محدودیت‌های شاپرک امکان پرداخت با رقم درخواست شده میسر نمی‌باشد',
      [-4]: 'سطح تأیید پذیرنده پایین‌تر از سطح نقره‌ای است',
      [-11]: 'درخواست مورد نظر یافت نشد',
      [-12]: 'امکان ویرایش درخواست میسر نمی‌باشد',
      [-21]: 'هیچ نوع عملیات مالی برای این تراکنش یافت نشد',
      [-22]: 'تراکنش ناموفق است',
      [-33]: 'رقم تراکنش با رقم پرداخت شده مطابقت ندارد',
      [-34]: 'سقف تقسیم تراکنش از لحاظ تعداد یا رقم عبور نموده است',
      [-40]: 'اجازه دسترسی به متد مربوطه وجود ندارد',
      [-41]: 'اطلاعات ارسال شده مربوط به AdditionalData غیرمعتبر است',
      [-42]: 'مدت زمان معتبر طول عمر شناسه پرداخت باید بین ۳۰ دقیقه تا ۴۵ روز باشد',
      [-54]: 'درخواست مورد نظر آرشیو شده است',
      [100]: 'عملیات با موفقیت انجام شد',
      [101]: 'پرداخت موفق بوده و قبلاً تأیید شده است',
    };
    return messages[code] ?? 'خطای نامشخص';
  }
}
