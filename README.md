## Run locally (Quick start)

Prerequisites
- Node.js (>= 20.0.0 recommended)
- npm (or yarn)
- Docker (optional, for running Postgres) or Supabase account

1) کلون و ورود به پروژه
```
git clone https://github.com/navinervz/psygfinal.git
cd psygfinal
```

2) نصب وابستگی‌ها
- در ریشه (فرانت):
```
npm ci
```
- در پوشه backend:
```
cd backend
npm ci
cd ..
```

3) متغیرهای محیطی
- یک کپی از مثال بسازید و مقداردهی کنید:
```
cp .env.example .env
# و سپس مقادیر را با کلیدهای واقعی جایگزین کنید
```
- فرانت فقط متغیرهایی که با prefix `VITE_` شروع شده‌اند را به کلاینت در دسترس می‌گذارد.

4) راه‌اندازی دیتابیس
- اگر از Supabase cloud استفاده می‌کنید: URL و کلیدها را از داشبورد بردارید و در `.env` قرار دهید.
- اگر می‌خواهید Postgres لوکال اجرا کنید، از docker-compose (راهنمایی در docs/supabase-setup.md) یا نصب محلی استفاده کنید.

5) اجرای هم‌زمان فرانت و بک
در ریشه پروژه:
```
npm run dev:all
```
- فرانت: http://localhost:5173
- بک‌اند: http://localhost:3000 (یا پورتی که در `.env` مشخص شده)

Notes
- اگر با CORS مواجه شدید: مطمئن شوید backend هدرهای CORS را فعال کرده و یا از proxy در vite استفاده شود.
- برای اجرای تست‌ها:
  - Frontend: `npm test`
  - Backend: داخل پوشه `backend` دستور `npm test`