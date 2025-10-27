# 🚀 راهنمای دیپلوی PSYGStore Backend روی VPS ایران

## 📋 پیش‌نیازهای VPS

### سیستم عامل و نرم‌افزارها
- **Ubuntu 22.04 LTS** (توصیه شده)
- **Node.js 18+** (LTS)
- **MySQL 8.0+** یا **MariaDB 10.6+**
- **Nginx** (Reverse Proxy)
- **PM2** (Process Manager)
- **Git** (Version Control)

## 🛠️ مرحله 1: آماده‌سازی VPS

### نصب پیش‌نیازها

```bash
# به‌روزرسانی سیستم
sudo apt update && sudo apt upgrade -y

# نصب ابزارهای پایه
sudo apt install -y curl wget git unzip software-properties-common build-essential

# نصب Node.js 18 LTS
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# تأیید نصب Node.js
node --version
npm --version

# نصب PM2 به صورت global
sudo npm install -g pm2

# نصب MySQL
sudo apt install -y mysql-server

# نصب Nginx
sudo apt install -y nginx

# نصب Certbot برای SSL
sudo apt install -y certbot python3-certbot-nginx
```

## 🗄️ مرحله 2: تنظیم MySQL

### امن‌سازی و پیکربندی MySQL

```bash
# امن‌سازی MySQL
sudo mysql_secure_installation

# ورود به MySQL
sudo mysql -u root -p
```

### ایجاد دیتابیس و کاربر

```sql
-- ایجاد دیتابیس
CREATE DATABASE xsblbatq_psygstore CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ایجاد کاربر
CREATE USER 'xsblbatq_psygstore'@'localhost' IDENTIFIED BY 'Sample@369963';

-- اعطای دسترسی‌ها
GRANT ALL PRIVILEGES ON xsblbatq_psygstore.* TO 'xsblbatq_psygstore'@'localhost';
FLUSH PRIVILEGES;

-- خروج
EXIT;
```

### تست اتصال دیتابیس

```bash
mysql -u xsblbatq_psygstore -p'Sample@369963' -h localhost xsblbatq_psygstore -e "SELECT 1;"
```

## 📁 مرحله 3: آپلود و تنظیم پروژه

### ایجاد دایرکتوری پروژه

```bash
# ایجاد دایرکتوری
sudo mkdir -p /var/www/psygstore.com
sudo chown -R $USER:$USER /var/www/psygstore.com

# رفتن به دایرکتوری
cd /var/www/psygstore.com
```

### آپلود فایل‌های پروژه

```bash
# گزینه 1: استفاده از Git (توصیه شده)
git clone https://github.com/your-username/psygstore.git .

# گزینه 2: آپلود مستقیم فایل‌ها
# استفاده از scp، rsync یا FileZilla
```

### نصب Dependencies

```bash
# نصب dependencies فرانت‌اند
npm install

# Build فرانت‌اند
npm run build

# رفتن به دایرکتوری بک‌اند
cd backend

# نصب dependencies بک‌اند
npm install

# Build بک‌اند
npm run build
```

## ⚙️ مرحله 4: تنظیم Environment Variables

### ایجاد فایل .env

```bash
cd /var/www/psygstore.com/backend
cp .env.example .env
nano .env
```

### محتوای فایل .env

```env
# Application Settings
NODE_ENV=production
PORT=3000
APP_NAME=PSYGStore
DOMAIN=psygstore.com
BASE_URL=https://psygstore.com

# Database Configuration
DATABASE_URL="mysql://xsblbatq_psygstore:Sample@369963@localhost:3306/xsblbatq_psygstore"

# JWT Configuration
JWT_SECRET={5Eigj_pU~%ume14\7r=zwISq(cP)X@:l'o|.x,6+`Y^?WD8bCJ*nNdy<2avQ#]Z
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this-in-production
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Admin 2FA Settings
ADMIN_2FA_ENABLED=true
ADMIN_2FA_ISSUER=PSYGStore

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=noreply@psygstore.com
FROM_NAME=PSYGStore

# ZarinPal Configuration
ZARINPAL_MERCHANT_ID=3dea5614-27bf-4a03-ad9d-8587f444d9a6
ZARINPAL_SANDBOX=false
ZARINPAL_CALLBACK_URL=https://psygstore.com/api/payment/zarinpal/callback

# Payment4 Configuration
PAYMENT4_API_KEY=A3H697H25VS51HKX4DERXG90ZLZNY7IK6REGKYGRCOVOCY7242FNGIBMVEQZ
PAYMENT4_SANDBOX=false
PAYMENT4_CALLBACK_URL=https://psygstore.com/api/payment/payment4/callback

# Crypto Wallet Addresses
STORE_ETH_WALLET=0x925FE9Df719925C3864c4C17bf7F3FeE8047C938
STORE_TON_WALLET=UQCyrjAMQtUdwwlzHAhQhjTkcX14A8v6aTimsB4htUmfdi8m

# Nobitex API Configuration
NOBITEX_API_URL=https://api.nobitex.ir/market/stats
PRICE_UPDATE_INTERVAL=300000
PRICE_CACHE_TTL=300

# Support Configuration
TELEGRAM_SUPPORT=@Psygsupport
SUPPORT_EMAIL=support@psygstore.com
INSTAGRAM_USERNAME=psygstore

# CORS Origins
CORS_ORIGINS=https://psygstore.com,https://www.psygstore.com

# Monitoring Thresholds
MAX_RESPONSE_TIME=5000
MIN_FREE_DISK=10
MIN_FREE_MEMORY=10
MAX_LOG_SIZE=500
SSL_WARNING_DAYS=30
SSL_CRITICAL_DAYS=7
DB_SLOW_QUERY_THRESHOLD=3000
API_TIMEOUT_THRESHOLD=10000
HIGH_ERROR_COUNT_THRESHOLD=50
DISK_CRITICAL_THRESHOLD=90
MEMORY_CRITICAL_THRESHOLD=90
CPU_WARNING_THRESHOLD=80
CPU_CRITICAL_THRESHOLD=90

# Admin Settings
ADMIN_EMAIL=admin@psygstore.com
ADMIN_DEFAULT_PASSWORD=change-this-password-immediately

# Monitoring & Alerting
MAX_RESPONSE_TIME=5000
MIN_FREE_DISK=10
MIN_FREE_MEMORY=10
MAX_LOG_SIZE=500
HEALTH_CHECK_INTERVAL=300000

# Telegram Alerts (اختیاری)
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
TELEGRAM_CHAT_ID=your-telegram-chat-id

# Email Alerts (اختیاری)
ALERT_EMAIL_ENABLED=true
ALERT_EMAIL_RECIPIENTS=admin@psygstore.com,support@psygstore.com
```

## 🗄️ مرحله 5: راه‌اندازی دیتابیس

### اجرای Prisma Migrations

```bash
cd /var/www/psygstore.com/backend

# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# (اختیاری) Seed initial data
npm run db:seed
```

### تست اتصال دیتابیس

```bash
# تست اتصال
npx prisma db pull

# مشاهده دیتابیس (در development)
npx prisma studio
```

## 🌐 مرحله 6: تنظیم Nginx

### ایجاد فایل پیکربندی

```bash
sudo nano /etc/nginx/sites-available/psygstore.com
```

### محتوای فایل Nginx

```nginx
server {
    listen 80;
    server_name psygstore.com www.psygstore.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name psygstore.com www.psygstore.com;
    
    # SSL Configuration (will be added by Certbot)
    
    # Security Headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;

    # Root directory for frontend
    root /var/www/psygstore.com/dist;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/css application/javascript application/json image/svg+xml;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header X-Content-Type-Options "nosniff" always;
    }

    # API routes (proxy to Node.js backend)
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
    }

    # Admin panel routes (proxy to Node.js backend)
    location /admin/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Frontend routes (SPA)
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }

    # Security: Block access to sensitive files
    location ~ /\. {
        deny all;
    }

    location ~ \.(env|log|sql|bak|backup)$ {
        deny all;
    }

    # Error pages
    error_page 404 /index.html;
    error_page 500 502 503 504 /50x.html;
    
    location = /50x.html {
        root /var/www/psygstore.com/dist;
    }
}
```

### فعال‌سازی سایت

```bash
# فعال‌سازی سایت
sudo ln -s /etc/nginx/sites-available/psygstore.com /etc/nginx/sites-enabled/

# غیرفعال کردن سایت پیش‌فرض
sudo rm /etc/nginx/sites-enabled/default

# تست پیکربندی
sudo nginx -t

# راه‌اندازی مجدد Nginx
sudo systemctl restart nginx
```

## 🔒 مرحله 7: تنظیم SSL

### دریافت SSL Certificate

```bash
# دریافت SSL از Let's Encrypt
sudo certbot --nginx -d psygstore.com -d www.psygstore.com

# تست تمدید خودکار
sudo certbot renew --dry-run
```

## 🚀 مرحله 8: راه‌اندازی Backend با PM2

### ایجاد فایل ecosystem

```bash
cd /var/www/psygstore.com/backend
nano ecosystem.config.js
```

### محتوای فایل ecosystem

```javascript
module.exports = {
  apps: [{
    name: 'psygstore-backend',
    script: 'dist/server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: 'logs/pm2-error.log',
    out_file: 'logs/pm2-out.log',
    log_file: 'logs/pm2-combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024'
  }]
};
```

### راه‌اندازی با PM2

```bash
# ایجاد دایرکتوری logs
mkdir -p logs

# شروع اپلیکیشن
pm2 start ecosystem.config.js

# ذخیره تنظیمات PM2
pm2 save

# تنظیم startup script
pm2 startup

# مشاهده وضعیت
pm2 status
pm2 logs psygstore-backend
```

## ⏰ مرحله 9: تنظیم Cron Jobs

### ویرایش Crontab

```bash
crontab -e
```

### اضافه کردن Job ها

```bash
# به‌روزرسانی قیمت‌ها هر 5 دقیقه
*/5 * * * * cd /var/www/psygstore.com/backend && npm run price:update >> logs/price-update.log 2>&1

# Backup روزانه ساعت 2 صبح
0 2 * * * /var/www/psygstore.com/scripts/backup.sh >> logs/backup.log 2>&1

# پاک‌سازی لاگ‌های قدیمی هر هفته
0 0 * * 0 find /var/www/psygstore.com/backend/logs -name "*.log" -mtime +7 -delete

# بررسی سلامت سیستم هر ساعت
0 * * * * curl -f http://localhost:3000/health || pm2 restart psygstore-backend
```

## 🔧 مرحله 10: تنظیمات بهینه‌سازی

### تنظیم مجوزهای فایل‌ها

```bash
# تنظیم مالکیت
sudo chown -R $USER:$USER /var/www/psygstore.com

# تنظیم مجوزها
chmod -R 755 /var/www/psygstore.com
chmod 600 /var/www/psygstore.com/backend/.env
chmod +x /var/www/psygstore.com/scripts/*.sh

# مجوزهای لاگ
mkdir -p /var/www/psygstore.com/backend/logs
chmod 755 /var/www/psygstore.com/backend/logs
```

### بهینه‌سازی MySQL

```bash
sudo nano /etc/mysql/mysql.conf.d/mysqld.cnf
```

```ini
[mysqld]
# Performance tuning
innodb_buffer_pool_size = 1G
innodb_log_file_size = 256M
max_connections = 200
query_cache_size = 64M
query_cache_type = 1

# Character set
character-set-server = utf8mb4
collation-server = utf8mb4_unicode_ci

# Security
bind-address = 127.0.0.1
```

```bash
sudo systemctl restart mysql
```

## 🔐 مرحله 11: تنظیمات امنیتی

### فایروال (UFW)

```bash
# فعال‌سازی UFW
sudo ufw enable

# اجازه دسترسی به پورت‌های ضروری
sudo ufw allow 22     # SSH
sudo ufw allow 80     # HTTP
sudo ufw allow 443    # HTTPS

# محدود کردن SSH
sudo ufw limit 22

# مشاهده وضعیت
sudo ufw status
```

### Fail2Ban

```bash
# نصب Fail2Ban
sudo apt install -y fail2ban

# پیکربندی
sudo nano /etc/fail2ban/jail.local
```

```ini
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[nginx-http-auth]
enabled = true

[nginx-limit-req]
enabled = true

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
```

```bash
sudo systemctl restart fail2ban
```

## 📊 مرحله 12: مانیتورینگ و لاگ‌ها

### اسکریپت Health Check

```bash
nano /var/www/psygstore.com/scripts/health-check.sh
```

```bash
#!/bin/bash

echo "=== PSYGStore Health Check - $(date) ==="

# Check Node.js backend
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ Backend: Running"
else
    echo "❌ Backend: Not responding"
    pm2 restart psygstore-backend
fi

# Check Nginx
if systemctl is-active --quiet nginx; then
    echo "✅ Nginx: Running"
else
    echo "❌ Nginx: Not running"
    sudo systemctl restart nginx
fi

# Check MySQL
if systemctl is-active --quiet mysql; then
    echo "✅ MySQL: Running"
else
    echo "❌ MySQL: Not running"
    sudo systemctl restart mysql
fi

# Check SSL certificate
if openssl s_client -connect psygstore.com:443 -servername psygstore.com < /dev/null 2>/dev/null | grep -q "Verify return code: 0"; then
    echo "✅ SSL: Valid"
else
    echo "❌ SSL: Invalid or expired"
fi

echo "================================"
```

```bash
chmod +x /var/www/psygstore.com/scripts/health-check.sh

# اضافه کردن به crontab
echo "*/30 * * * * /var/www/psygstore.com/scripts/health-check.sh >> /var/log/health-check.log 2>&1" | crontab -
```

## 🔄 مرحله 13: اسکریپت‌های مدیریتی

### اسکریپت Deploy

```bash
nano /var/www/psygstore.com/scripts/deploy.sh
```

```bash
#!/bin/bash

echo "🚀 Starting deployment..."

cd /var/www/psygstore.com

# Pull latest changes
git pull origin main

# Install/update frontend dependencies
npm install

# Build frontend
npm run build

# Install/update backend dependencies
cd backend
npm install

# Build backend
npm run build

# Run database migrations
npx prisma db push

# Restart backend
pm2 restart psygstore-backend

# Reload Nginx
sudo systemctl reload nginx

echo "✅ Deployment completed!"
```

```bash
chmod +x /var/www/psygstore.com/scripts/deploy.sh
```

## ✅ مرحله 14: تست و تأیید

### تست‌های اولیه

```bash
# تست سلامت بک‌اند
curl http://localhost:3000/health

# تست API
curl https://psygstore.com/api/health

# تست فرانت‌اند
curl https://psygstore.com

# مشاهده لاگ‌های PM2
pm2 logs psygstore-backend --lines 50
```

### تست عملکرد

1. **تست ثبت‌نام و ورود کاربر**
2. **تست درگاه‌های پرداخت**
3. **تست پنل ادمین**
4. **تست به‌روزرسانی قیمت‌ها**
5. **تست سیستم کوپن**

## 🔧 عیب‌یابی

### مشکلات رایج

#### 1. Backend شروع نمی‌شود
```bash
# بررسی لاگ‌های PM2
pm2 logs psygstore-backend

# بررسی فایل .env
cat /var/www/psygstore.com/backend/.env

# تست اتصال دیتابیس
cd /var/www/psygstore.com/backend
npx prisma db pull
```

#### 2. خطای 502 Bad Gateway
```bash
# بررسی وضعیت backend
pm2 status

# بررسی لاگ‌های Nginx
sudo tail -f /var/log/nginx/error.log

# راه‌اندازی مجدد
pm2 restart psygstore-backend
```

#### 3. خطای دیتابیس
```bash
# بررسی وضعیت MySQL
sudo systemctl status mysql

# بررسی لاگ‌های MySQL
sudo tail -f /var/log/mysql/error.log

# تست اتصال
mysql -u xsblbatq_psygstore -p -h localhost xsblbatq_psygstore
```

## 📞 پشتیبانی

در صورت بروز مشکل:
- **تلگرام**: @Psygsupport
- **ایمیل**: support@psygstore.com

## 📋 Checklist نهایی

- [ ] VPS آماده و به‌روزرسانی شده
- [ ] Node.js 18+ نصب شده
- [ ] MySQL نصب و پیکربندی شده
- [ ] دیتابیس و کاربر ایجاد شده
- [ ] Nginx نصب و پیکربندی شده
- [ ] SSL Certificate نصب شده
- [ ] فایل‌های پروژه آپلود شدند
- [ ] Dependencies نصب شدند
- [ ] فایل .env تنظیم شده
- [ ] Prisma migrations اجرا شدند
- [ ] PM2 تنظیم و راه‌اندازی شده
- [ ] Cron jobs تنظیم شدند
- [ ] مجوزهای فایل‌ها تنظیم شدند
- [ ] تست‌های اولیه OK هستند
- [ ] مانیتورینگ فعال است
- [ ] Backup اتوماتیک تنظیم شده

---

**🎉 تبریک! سایت شما در آدرس `https://psygstore.com` آماده استفاده است.**