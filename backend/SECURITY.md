# 🔐 راهنمای امنیت PSYGStore Backend

## 🛡️ اقدامات امنیتی پیاده‌سازی شده

### 1. احراز هویت و مجوزها

#### JWT Security
- **Access Token**: مدت زمان کوتاه (15 دقیقه)
- **Refresh Token**: HttpOnly Cookie با مدت زمان طولانی (7 روز)
- **Secret Keys**: کلیدهای قوی و منحصربه‌فرد
- **Token Rotation**: تولید مجدد refresh token در هر استفاده

#### Password Security
- **Hashing**: bcrypt با 12 rounds
- **Validation**: حداقل 8 کاراکتر، ترکیب حروف و اعداد
- **Reset**: سیستم بازیابی امن با token موقت

#### Two-Factor Authentication (2FA)
- **Admin Only**: فقط برای حساب‌های ادمین
- **TOTP**: استفاده از Google Authenticator یا مشابه
- **Backup Codes**: کدهای پشتیبان برای بازیابی

### 2. امنیت API

#### Rate Limiting
```typescript
// General API: 100 requests per 15 minutes
// Auth endpoints: 5 attempts per 15 minutes  
// Payment endpoints: 10 requests per 5 minutes
// Admin endpoints: 60 requests per minute
```

#### Input Validation
- **Joi Schema**: اعتبارسنجی کامل ورودی‌ها
- **Sanitization**: پاک‌سازی XSS و injection
- **Type Safety**: TypeScript برای type checking

#### CORS Policy
```typescript
// فقط دامنه‌های مجاز:
origins: ['https://psygstore.com', 'https://www.psygstore.com']
credentials: true
```

### 3. امنیت دیتابیس

#### Prisma ORM
- **SQL Injection Prevention**: Prepared statements
- **Type Safety**: TypeScript integration
- **Connection Pooling**: مدیریت بهینه اتصالات

#### Data Encryption
- **Passwords**: bcrypt hashing
- **Sensitive Data**: رمزنگاری فیلدهای حساس
- **Environment Variables**: جداسازی کامل secrets

### 4. امنیت شبکه

#### HTTPS Enforcement
- **SSL/TLS**: اجباری برای تمام ترافیک
- **HSTS**: Strict Transport Security
- **Certificate Pinning**: در صورت نیاز

#### Security Headers
```nginx
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer-when-downgrade
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=63072000
```

### 5. لاگ‌گیری و مانیتورینگ

#### Structured Logging
- **Winston**: سیستم لاگ‌گیری پیشرفته
- **Log Rotation**: چرخش خودکار فایل‌های لاگ
- **Security Events**: لاگ‌گیری رویدادهای امنیتی

#### Monitoring
- **Failed Login Attempts**: ردیابی تلاش‌های ناموفق
- **Admin Actions**: لاگ تمام فعالیت‌های ادمین
- **Payment Events**: ردیابی کامل تراکنش‌ها

## 🚨 تهدیدات و محافظت‌ها

### 1. حملات رایج

#### SQL Injection
- **محافظت**: Prisma ORM با prepared statements
- **اعتبارسنجی**: Joi validation schemas
- **Sanitization**: پاک‌سازی ورودی‌ها

#### XSS (Cross-Site Scripting)
- **محافظت**: Input sanitization
- **CSP Headers**: Content Security Policy
- **Output Encoding**: رمزنگاری خروجی‌ها

#### CSRF (Cross-Site Request Forgery)
- **محافظت**: SameSite cookies
- **CSRF Tokens**: در صورت نیاز
- **Origin Validation**: بررسی منشأ درخواست‌ها

#### Brute Force
- **محافظت**: Rate limiting
- **Account Lockout**: قفل موقت حساب
- **2FA**: احراز هویت دو مرحله‌ای

### 2. امنیت پرداخت

#### Payment Security
- **PCI Compliance**: رعایت استانداردهای پرداخت
- **Webhook Validation**: تأیید امضای webhook ها
- **Amount Validation**: اعتبارسنجی مبالغ
- **Idempotency**: جلوگیری از تراکنش‌های تکراری

#### Crypto Security
- **Wallet Validation**: تأیید آدرس کیف پول‌ها
- **Transaction Monitoring**: نظارت بر تراکنش‌ها
- **Rate Limiting**: محدودیت درخواست‌های پرداخت

## 🔒 بهترین شیوه‌های امنیتی

### 1. Environment Variables
```bash
# همیشه از .env استفاده کنید
# هرگز secrets را در کد commit نکنید
# از strong secrets استفاده کنید
# دسترسی فایل .env را محدود کنید (chmod 600)
```

### 2. Database Security
```sql
-- استفاده از کاربر محدود برای اپلیکیشن
-- عدم استفاده از root user
-- backup منظم دیتابیس
-- رمزنگاری backup ها
```

### 3. Server Security
```bash
# به‌روزرسانی منظم سیستم عامل
# استفاده از firewall
# محدود کردن دسترسی SSH
# نظارت بر لاگ‌های سیستم
```

### 4. Application Security
```typescript
// اعتبارسنجی تمام ورودی‌ها
// استفاده از HTTPS برای تمام ارتباطات
// مدیریت صحیح خطاها (عدم افشای اطلاعات حساس)
// به‌روزرسانی منظم dependencies
```

## 🔍 بررسی امنیت

### Security Checklist

#### Authentication & Authorization
- [ ] JWT tokens با expiration مناسب
- [ ] Password hashing با bcrypt
- [ ] 2FA برای admin accounts
- [ ] Session management امن
- [ ] Role-based access control

#### API Security  
- [ ] Rate limiting فعال
- [ ] Input validation کامل
- [ ] CORS policy محدود
- [ ] Security headers تنظیم شده
- [ ] Error handling امن

#### Database Security
- [ ] Prepared statements (Prisma)
- [ ] Database user محدود
- [ ] Connection string امن
- [ ] Backup encryption
- [ ] Access logging

#### Infrastructure Security
- [ ] HTTPS enforcement
- [ ] Firewall configuration
- [ ] SSH key authentication
- [ ] Regular security updates
- [ ] Log monitoring

### Security Testing

#### Automated Tests
```bash
# نصب ابزارهای تست امنیت
npm install --save-dev @types/supertest supertest

# اجرای تست‌های امنیتی
npm run test:security
```

#### Manual Testing
1. **Authentication Bypass**: تست دور زدن احراز هویت
2. **Authorization Escalation**: تست افزایش دسترسی
3. **Input Validation**: تست injection attacks
4. **Rate Limiting**: تست محدودیت‌های نرخ
5. **Session Management**: تست مدیریت session

## 📊 مانیتورینگ و لاگ‌ها

### مسیرهای مهم لاگ‌ها:
```bash
# لاگ‌های اپلیکیشن
tail -f /var/www/psygstore.com/backend/logs/combined-YYYY-MM-DD.log

# لاگ‌های خطا
tail -f /var/www/psygstore.com/backend/logs/error-YYYY-MM-DD.log

# لاگ‌های ادمین
tail -f /var/www/psygstore.com/backend/logs/admin-YYYY-MM-DD.log

# لاگ‌های پرداخت
tail -f /var/www/psygstore.com/backend/logs/payments-YYYY-MM-DD.log

# لاگ‌های امنیتی
tail -f /var/www/psygstore.com/backend/logs/security-YYYY-MM-DD.log
```

### Log Retention Policy:
- **Error Logs**: 30 روز (حداکثر 20MB per file)
- **Combined Logs**: 14 روز (حداکثر 20MB per file)
- **Admin Logs**: 90 روز (برای audit trail)
- **Payment Logs**: 365 روز (برای compliance و مالیات)
- **Security Logs**: 180 روز (برای تحلیل امنیتی)

### Log Rotation:
- **روزانه**: فایل‌های جدید ایجاد می‌شوند
- **فشرده‌سازی**: فایل‌های قدیمی zip می‌شوند
- **حداکثر اندازه**: 20MB per file
- **پاک‌سازی خودکار**: بر اساس retention policy

### Monitoring Thresholds:
- **API Response Time**: حداکثر 5 ثانیه
- **Database Query Time**: حداکثر 3 ثانیه
- **Disk Space**: هشدار در 80%، بحرانی در 90%
- **Memory Usage**: هشدار در 80%، بحرانی در 90%
- **SSL Certificate**: هشدار 30 روز، بحرانی 7 روز قبل انقضا
- **Log File Size**: هشدار در 100MB
- **Failed Login Attempts**: هشدار بیش از 50 تلاش در روز
### اسکریپت مانیتورینگ:

## 🚨 پاسخ به حوادث امنیتی

### Incident Response Plan

#### 1. شناسایی تهدید
- مانیتورینگ لاگ‌های امنیتی
- هشدارهای خودکار
- گزارش‌های کاربران

#### 2. ارزیابی و مهار
- تعیین سطح تهدید
- ایزوله کردن سیستم‌های آسیب‌دیده
- جمع‌آوری مدارک

#### 3. بازیابی
- رفع آسیب‌ها
- بازگردانی از backup
- تست عملکرد سیستم

#### 4. بهبود
- تحلیل علت ریشه‌ای
- بهبود اقدامات امنیتی
- به‌روزرسانی procedures

## 📞 تماس اضطراری

### Security Team
- **Email**: security@psygstore.com
- **Telegram**: @Psygsupport
- **Phone**: [شماره تماس اضطراری]

### Escalation Matrix
1. **Level 1**: Developer Team
2. **Level 2**: Security Team  
3. **Level 3**: Management Team
4. **Level 4**: External Security Consultant

---

**⚠️ نکته مهم**: این مستند باید به‌روزرسانی منظم شود و تمام تیم باید با آن آشنا باشد.