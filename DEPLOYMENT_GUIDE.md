# راهنمای دیپلوی PSYGStore روی VPS ایران

## 📋 پیش‌نیازهای VPS

### سیستم عامل و نرم‌افزارها
- **Ubuntu 22.04 LTS**
- **Node.js 18+** (برای فرانت‌اند)
- **PHP 8.0+** با افزونه‌های:
  - `php-mysql`
  - `php-curl`
  - `php-json`
  - `php-mbstring`
  - `php-xml`
- **MySQL 8.0+** یا **MariaDB 10.6+**
- **Nginx** (وب سرور)
- **PM2** (مدیریت پروسه Node.js)
- **Certbot** (SSL Certificate)

## 🚀 مراحل نصب

### مرحله 1: آماده‌سازی VPS

```bash
# به‌روزرسانی سیستم
sudo apt update && sudo apt upgrade -y

# نصب پیش‌نیازها
sudo apt install -y curl wget git unzip software-properties-common

# نصب Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# نصب PM2
sudo npm install -g pm2

# نصب PHP 8.0
sudo add-apt-repository ppa:ondrej/php -y
sudo apt update
sudo apt install -y php8.0 php8.0-fpm php8.0-mysql php8.0-curl php8.0-json php8.0-mbstring php8.0-xml php8.0-zip

# نصب MySQL
sudo apt install -y mysql-server

# نصب Nginx
sudo apt install -y nginx

# نصب Certbot
sudo apt install -y certbot python3-certbot-nginx
```

### مرحله 2: تنظیم MySQL

```bash
# امن‌سازی MySQL
sudo mysql_secure_installation

# ورود به MySQL
sudo mysql -u root -p

# ایجاد دیتابیس و کاربر
CREATE DATABASE xsblbatq_psygstore CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'xsblbatq_psygstore'@'localhost' IDENTIFIED BY 'Sample@369963';
GRANT ALL PRIVILEGES ON xsblbatq_psygstore.* TO 'xsblbatq_psygstore'@'localhost';
FLUSH PRIVILEGES;
EXIT;

# اجرای Schema
mysql -u xsblbatq_psygstore -p xsblbatq_psygstore < /path/to/database/mysql_schema.sql
```

### مرحله 3: آپلود و تنظیم پروژه

```bash
# ایجاد دایرکتوری پروژه
sudo mkdir -p /var/www/psygstore.com
sudo chown -R $USER:$USER /var/www/psygstore.com

# آپلود فایل‌های پروژه
# (استفاده از scp، rsync یا git clone)

# نصب dependencies
cd /var/www/psygstore.com
npm install

# Build فرانت‌اند
npm run build

# کپی فایل‌های API
sudo cp -r api /var/www/psygstore.com/
sudo cp -r database /var/www/psygstore.com/
sudo cp -r scripts /var/www/psygstore.com/

# تنظیم مجوزها
sudo chown -R www-data:www-data /var/www/psygstore.com
sudo chmod -R 755 /var/www/psygstore.com
sudo chmod 600 /var/www/psygstore.com/api/.env
sudo chmod +x /var/www/psygstore.com/scripts/price-updater.php
```

### مرحله 4: تنظیم Nginx

```bash
# ایجاد فایل پیکربندی Nginx
sudo nano /etc/nginx/sites-available/psygstore.com
```

محتوای فایل:
```nginx
server {
    listen 80;
    server_name psygstore.com www.psygstore.com;
    root /var/www/psygstore.com/dist;
    index index.html;

    # Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Gzip compression
    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
    gzip_min_length 1024;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API routes
    location /api/ {
        try_files $uri $uri/ @php;
    }

    location @php {
        fastcgi_pass unix:/var/run/php/php8.0-fpm.sock;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME /var/www/psygstore.com$fastcgi_script_name;
        include fastcgi_params;
        fastcgi_read_timeout 300;
    }

    # Frontend routes (SPA)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Security: Block access to sensitive files
    location ~ /\. {
        deny all;
    }

    location ~ \.(env|log|sql|bak|backup)$ {
        deny all;
    }
}
```

```bash
# فعال‌سازی سایت
sudo ln -s /etc/nginx/sites-available/psygstore.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### مرحله 5: تنظیم SSL

```bash
# دریافت SSL Certificate
sudo certbot --nginx -d psygstore.com -d www.psygstore.com

# تست تمدید خودکار
sudo certbot renew --dry-run
```

### مرحله 6: تنظیم Cron Jobs

```bash
# ویرایش crontab
crontab -e

# اضافه کردن job های زیر:
# به‌روزرسانی قیمت‌ها هر 5 دقیقه
*/5 * * * * /usr/bin/php /var/www/psygstore.com/scripts/price-updater.php >> /var/log/price-updater.log 2>&1

# Backup روزانه ساعت 2 صبح
0 2 * * * /var/www/psygstore.com/scripts/backup.sh >> /var/log/backup.log 2>&1

# پاک‌سازی لاگ‌های قدیمی هر هفته
0 0 * * 0 find /var/www/psygstore.com/api/logs -name "*.log" -mtime +7 -delete
```

### مرحله 7: تنظیم PM2 (اختیاری - برای Node.js services)

```bash
# اگر نیاز به سرویس‌های Node.js دارید
cd /var/www/psygstore.com

# ایجاد فایل ecosystem
cat > ecosystem.config.js << 'EOL'
module.exports = {
  apps: [{
    name: 'psygstore-api',
    script: 'server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
EOL

# شروع با PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## 🔧 تنظیمات بهینه‌سازی

### PHP-FPM Optimization

```bash
sudo nano /etc/php/8.0/fpm/pool.d/www.conf
```

تنظیمات پیشنهادی:
```ini
pm = dynamic
pm.max_children = 50
pm.start_servers = 5
pm.min_spare_servers = 5
pm.max_spare_servers = 35
pm.max_requests = 500
```

### MySQL Optimization

```bash
sudo nano /etc/mysql/mysql.conf.d/mysqld.cnf
```

تنظیمات پیشنهادی:
```ini
[mysqld]
innodb_buffer_pool_size = 1G
innodb_log_file_size = 256M
max_connections = 200
query_cache_size = 64M
query_cache_type = 1
```

## 📊 مانیتورینگ و لاگ‌ها

### مسیرهای مهم لاگ‌ها:
```bash
# لاگ‌های اپلیکیشن
tail -f /var/www/psygstore.com/api/logs/app.log

# لاگ‌های PHP
tail -f /var/log/php8.0-fpm.log

# لاگ‌های Nginx
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# لاگ‌های MySQL
tail -f /var/log/mysql/error.log

# لاگ‌های به‌روزرسانی قیمت
tail -f /var/log/price-updater.log
```

### اسکریپت مانیتورینگ:

```bash
# ایجاد اسکریپت health check
cat > /var/www/psygstore.com/scripts/health-check.sh << 'EOL'
#!/bin/bash

echo "=== PSYGStore Health Check - $(date) ==="

# Check Nginx
if systemctl is-active --quiet nginx; then
    echo "✅ Nginx: Running"
else
    echo "❌ Nginx: Not running"
fi

# Check PHP-FPM
if systemctl is-active --quiet php8.0-fpm; then
    echo "✅ PHP-FPM: Running"
else
    echo "❌ PHP-FPM: Not running"
fi

# Check MySQL
if systemctl is-active --quiet mysql; then
    echo "✅ MySQL: Running"
else
    echo "❌ MySQL: Not running"
fi

# Check database connection
if php /var/www/psygstore.com/api/test-db.php > /dev/null 2>&1; then
    echo "✅ Database: Connected"
else
    echo "❌ Database: Connection failed"
fi

# Check SSL certificate
if openssl s_client -connect psygstore.com:443 -servername psygstore.com < /dev/null 2>/dev/null | grep -q "Verify return code: 0"; then
    echo "✅ SSL: Valid"
else
    echo "❌ SSL: Invalid or expired"
fi

echo "================================"
EOL

chmod +x /var/www/psygstore.com/scripts/health-check.sh

# اضافه کردن به crontab برای چک روزانه
echo "0 8 * * * /var/www/psygstore.com/scripts/health-check.sh >> /var/log/health-check.log 2>&1" | crontab -
```

## 🔐 تنظیمات امنیتی

### Firewall Setup:
```bash
# فعال‌سازی UFW
sudo ufw enable

# اجازه دسترسی به پورت‌های ضروری
sudo ufw allow 22    # SSH
sudo ufw allow 80    # HTTP
sudo ufw allow 443   # HTTPS

# محدود کردن SSH (اختیاری)
sudo ufw limit 22
```

### Fail2Ban Setup:
```bash
# نصب Fail2Ban
sudo apt install -y fail2ban

# پیکربندی
sudo nano /etc/fail2ban/jail.local
```

محتوای فایل:
```ini
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[nginx-http-auth]
enabled = true

[nginx-limit-req]
enabled = true

[php-url-fopen]
enabled = true
```

## 🔄 اسکریپت‌های مدیریتی

### اسکریپت Backup:

```bash
cat > /var/www/psygstore.com/scripts/backup.sh << 'EOL'
#!/bin/bash

BACKUP_DIR="/var/backups/psygstore"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME="xsblbatq_psygstore"
DB_USER="xsblbatq_psygstore"
DB_PASS="Sample@369963"

# ایجاد پوشه backup
mkdir -p $BACKUP_DIR

# Backup دیتابیس
mysqldump -u $DB_USER -p$DB_PASS $DB_NAME > $BACKUP_DIR/db_$DATE.sql

# Backup فایل‌ها
tar -czf $BACKUP_DIR/files_$DATE.tar.gz /var/www/psygstore.com --exclude=/var/www/psygstore.com/node_modules

# حذف backup های قدیمی (بیش از 7 روز)
find $BACKUP_DIR -mtime +7 -type f -delete

echo "Backup completed: $DATE"
EOL

chmod +x /var/www/psygstore.com/scripts/backup.sh
```

### اسکریپت Deploy:

```bash
cat > /var/www/psygstore.com/scripts/deploy.sh << 'EOL'
#!/bin/bash

echo "🚀 Starting deployment..."

# Pull latest changes (if using git)
# git pull origin main

# Install/update dependencies
npm install

# Build frontend
npm run build

# Restart services
sudo systemctl reload nginx
sudo systemctl reload php8.0-fpm

# Update prices
php /var/www/psygstore.com/scripts/price-updater.php

echo "✅ Deployment completed!"
EOL

chmod +x /var/www/psygstore.com/scripts/deploy.sh
```

## 📈 تست و تأیید

### 1. تست اتصال دیتابیس:
```bash
curl https://psygstore.com/api/test-db.php
```

### 2. تست درگاه‌های پرداخت:
```bash
# تست ZarinPal
curl -X POST https://psygstore.com/api/payment/zarinpal.php \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"amount": 1000, "description": "تست"}'

# تست قیمت‌های Nobitex
curl https://psygstore.com/api/prices/nobitex.php
```

### 3. تست پنل ادمین:
```bash
curl https://psygstore.com/api/admin/dashboard.php \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

## 🔧 عیب‌یابی

### مشکلات رایج:

#### 1. خطای 500 Internal Server Error
```bash
# بررسی لاگ‌های PHP
sudo tail -f /var/log/php8.0-fpm.log

# بررسی لاگ‌های Nginx
sudo tail -f /var/log/nginx/error.log
```

#### 2. خطای اتصال دیتابیس
```bash
# تست اتصال MySQL
mysql -u xsblbatq_psygstore -p -h localhost xsblbatq_psygstore

# بررسی وضعیت MySQL
sudo systemctl status mysql
```

#### 3. مشکل SSL
```bash
# بررسی وضعیت SSL
sudo certbot certificates

# تمدید دستی SSL
sudo certbot renew
```

## 📞 پشتیبانی

در صورت بروز مشکل:
- تلگرام: @Psygsupport
- ایمیل: support@psygstore.com

## ✅ Checklist نهایی

- [ ] VPS آماده و به‌روزرسانی شده
- [ ] MySQL نصب و دیتابیس ایجاد شده
- [ ] Schema اجرا شده
- [ ] PHP و افزونه‌ها نصب شدند
- [ ] Nginx پیکربندی شده
- [ ] SSL Certificate نصب شده
- [ ] فایل‌های پروژه آپلود شدند
- [ ] مجوزهای فایل‌ها تنظیم شدند
- [ ] Cron jobs تنظیم شدند
- [ ] تست‌های اتصال OK هستند
- [ ] Backup اتوماتیک فعال است
- [ ] مانیتورینگ تنظیم شده

---

**نکته مهم**: پس از تکمیل تمام مراحل، سایت شما در آدرس `https://psygstore.com` آماده استفاده خواهد بود.