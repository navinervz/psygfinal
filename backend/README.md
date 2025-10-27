# PSYGStore Backend

## وضعیت فعلی

### ✅ موارد تکمیل شده:

1. **Prisma Schema**: 
   - مدل `Subscription` اضافه شده
   - رابطه با `User` برقرار شده
   - فیلدهای مورد نیاز تعریف شده

2. **PriceCronService**: 
   - سرویس cron برای به‌روزرسانی قیمت‌ها هر 5 دقیقه
   - ادغام با `PriceUpdateService`
   - مدیریت خطا و logging

3. **SubscriptionController**: 
   - متد `list`: لیست subscription های کاربر
   - متد `create`: ایجاد subscription جدید
   - متد `renew`: تمدید subscription
   - متد `cancel`: لغو subscription
   - validation و error handling کامل

4. **Subscription Routes**: 
   - `GET /api/subscriptions`: لیست subscription ها
   - `POST /api/subscriptions`: ایجاد subscription جدید
   - `POST /api/subscriptions/:id/renew`: تمدید subscription
   - `POST /api/subscriptions/:id/cancel`: لغو subscription

5. **Dockerfile**: 
   - استیج‌های Node.js برای backend اضافه شده
   - Multi-stage build برای بهینه‌سازی
   - پورت 3000 برای backend

6. **CI/CD**: 
   - job `backend-test` برای تست و build backend
   - ادغام با workflow اصلی

7. **Nginx Configuration**: 
   - proxy برای `/api/` به پورت 3000 backend
   - تنظیمات header و timeout

### ⚠️ مشکلات باقی‌مانده:

1. **TypeScript Errors**: 
   - مشکلات syntax در فایل‌های مختلف
   - نیاز به تنظیم strict mode
   - مشکلات JWT middleware

2. **Prisma Migration**: 
   - نیاز به اجرای migration برای اضافه کردن جدول subscription
   - نیاز به DATABASE_URL در .env

3. **Test Dependencies**: 
   - نیاز به نصب supertest
   - مشکلات Jest configuration

### 🎯 اقدامات بعدی:

1. **ایجاد فایل .env**:
   ```bash
   cp .env.example .env
   # سپس مقادیر واقعی را وارد کنید
   ```

2. **اجرای Prisma Migration**:
   ```bash
   npx prisma migrate dev --name add-subscription
   ```

3. **نصب Test Dependencies**:
   ```bash
   npm install --save-dev supertest @types/supertest
   ```

4. **رفع TypeScript Errors**:
   - تنظیم strict mode در tsconfig.json
   - رفع مشکلات JWT
   - رفع مشکلات Request type

5. **تست و Build**:
   ```bash
   npm run build
   npm test
   ```

## ساختار فایل‌ها

```
backend/
├── src/
│   ├── controllers/
│   │   └── SubscriptionController.ts  ✅
│   ├── routes/
│   │   └── subscriptions.ts          ✅
│   ├── services/
│   │   └── PriceCronService.ts       ✅
│   └── server.ts                     ✅
├── prisma/
│   └── schema.prisma                 ✅
├── Dockerfile                        ✅
├── package.json                      ✅
└── tsconfig.json                     ✅
```

## نحوه اجرا

1. **Development**:
   ```bash
   npm run dev
   ```

2. **Production Build**:
   ```bash
   npm run build
   npm start
   ```

3. **Docker**:
   ```bash
   docker build -t psygstore-backend .
   docker run -p 3000:3000 psygstore-backend
   ```

## API Endpoints

### Subscriptions
- `GET /api/subscriptions` - لیست subscription های کاربر
- `POST /api/subscriptions` - ایجاد subscription جدید
- `POST /api/subscriptions/:id/renew` - تمدید subscription
- `POST /api/subscriptions/:id/cancel` - لغو subscription

### Authentication Required
تمام endpoint های subscription نیاز به authentication دارند.

## نکات مهم

1. **Environment Variables**: حتماً فایل .env را با مقادیر واقعی پر کنید
2. **Database**: اطمینان حاصل کنید که MySQL در حال اجرا است
3. **Ports**: backend روی پورت 3000 اجرا می‌شود
4. **Cron Service**: قیمت‌ها هر 5 دقیقه به‌روزرسانی می‌شوند