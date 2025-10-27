// backend/src/config/products.ts

/** یک پلن فروشی با قیمت دلاری خام (بدون رُندینگ/مارک‌آپ) */
export type ProductPlan = { key: string; nameFa: string; usd: number };

/** کاتالوگ محصولات: کلید سرویس ← آرایه‌ای از پلن‌ها */
export type ProductCatalog = Record<string, ProductPlan[]>;

/**
 * ⚠️ نکته مهم:
 * - قیمت‌های این فایل دلاری و خام هستند.
 * - تبدیل به تومان/ریال و اعمال کفِ USDT در سرویس قیمت (PriceUpdateService) و کنترلر انجام می‌شود.
 * - اگر پلنی اضافه/حذف می‌کنی، حتماً key یکتا و پایدار بده که روی فرانت/پرداخت وابسته است.
 */
export const PRODUCT_CATALOG: ProductCatalog = {
  telegram: [
    { key: 'telegram_month',   nameFa: 'تلگرام پرمیوم - ماهانه',  usd: 9.36  },
    { key: 'telegram_quarter', nameFa: 'تلگرام پرمیوم - سه‌ماهه',  usd: 14.66 },
    { key: 'telegram_half',    nameFa: 'تلگرام پرمیوم - شش‌ماهه',  usd: 20.34 },
    { key: 'telegram_year',    nameFa: 'تلگرام پرمیوم - سالانه',   usd: 37.71 },
  ],
  spotify: [
    { key: 'spotify_month',    nameFa: 'اسپاتیفای - ماهانه',       usd: 6.01  },
    { key: 'spotify_2month',   nameFa: 'اسپاتیفای - دوماهه',       usd: 10.51 },
    { key: 'spotify_quarter',  nameFa: 'اسپاتیفای - سه‌ماهه',      usd: 13.53 },
    { key: 'spotify_half',     nameFa: 'اسپاتیفای - شش‌ماهه',      usd: 22.54 },
    { key: 'spotify_year',     nameFa: 'اسپاتیفای - سالانه',       usd: 54.97 },
  ],
  chatgpt: [
    { key: 'chatgpt_plus',     nameFa: 'ChatGPT Plus',             usd: 25.0  },
    { key: 'chatgpt_pro',      nameFa: 'ChatGPT Pro',              usd: 205.5 },
  ],
};

/* =========================
   هلپرهای کاربردی (اختیاری)
   ========================= */

/** لیست تختِ همهٔ پلن‌ها به همراه نام سرویس‌شان */
export const listAllPlans = () =>
  Object.entries(PRODUCT_CATALOG).flatMap(([service, plans]) =>
    plans.map((p) => ({ service, ...p }))
  );

/** پیدا کردن یک پلن با key (اگر پیدا نشد null) */
export const findPlanByKey = (key: string) => {
  for (const [service, plans] of Object.entries(PRODUCT_CATALOG)) {
    const plan = plans.find((p) => p.key === key);
    if (plan) return { service, plan };
  }
  return null;
};

/**
 * اعتبارسنجی سادهٔ کاتالوگ (برای تست/اسکریپت)
 * - بررسی یکتا بودن keyها
 * - مثبت بودن قیمت‌ها
 */
export const validateCatalog = () => {
  const seen = new Set<string>();
  for (const [service, plans] of Object.entries(PRODUCT_CATALOG)) {
    for (const p of plans) {
      if (seen.has(p.key)) {
        throw new Error(`Duplicate plan key detected: ${p.key} (service: ${service})`);
      }
      seen.add(p.key);
      if (!(p.usd > 0)) {
        throw new Error(`Invalid USD price for key=${p.key} (service: ${service})`);
      }
    }
  }
  return true;
};
