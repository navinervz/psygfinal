#!/bin/bash

# PSYGStore Alert System Setup Script
# This script helps configure Telegram and Email alerts

set -e

echo "🔔 PSYGStore Alert System Setup"
echo "================================"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if .env file exists
if [ ! -f ".env" ]; then
    print_error ".env file not found. Please create it first."
    exit 1
fi

echo "این اسکریپت به شما کمک می‌کند سیستم هشدار را تنظیم کنید."
echo ""

# Telegram Bot Setup
print_step "تنظیم ربات تلگرام"
echo "برای دریافت هشدارها در تلگرام:"
echo "1. به @BotFather در تلگرام پیام دهید"
echo "2. دستور /newbot را ارسال کنید"
echo "3. نام و username برای ربات انتخاب کنید"
echo "4. Token ربات را کپی کنید"
echo ""

read -p "آیا می‌خواهید ربات تلگرام تنظیم کنید؟ (y/n): " setup_telegram

if [ "$setup_telegram" = "y" ] || [ "$setup_telegram" = "Y" ]; then
    read -p "Token ربات تلگرام را وارد کنید: " telegram_token
    
    if [ -n "$telegram_token" ]; then
        # Test bot token
        if curl -s "https://api.telegram.org/bot$telegram_token/getMe" | grep -q '"ok":true'; then
            print_success "Token ربات معتبر است"
            
            echo ""
            echo "حالا باید Chat ID خود را پیدا کنید:"
            echo "1. به ربات خود پیام دهید (هر پیامی)"
            echo "2. به لینک زیر بروید:"
            echo "   https://api.telegram.org/bot$telegram_token/getUpdates"
            echo "3. در پاسخ، مقدار chat.id را پیدا کنید"
            echo ""
            
            read -p "Chat ID خود را وارد کنید: " chat_id
            
            if [ -n "$chat_id" ]; then
                # Test sending message
                if curl -s -X POST "https://api.telegram.org/bot$telegram_token/sendMessage" \
                   -d "chat_id=$chat_id" \
                   -d "text=🎉 PSYGStore Alert System تنظیم شد!" | grep -q '"ok":true'; then
                    
                    print_success "پیام تست با موفقیت ارسال شد!"
                    
                    # Update .env file
                    if grep -q "TELEGRAM_BOT_TOKEN=" .env; then
                        sed -i "s/TELEGRAM_BOT_TOKEN=.*/TELEGRAM_BOT_TOKEN=$telegram_token/" .env
                    else
                        echo "TELEGRAM_BOT_TOKEN=$telegram_token" >> .env
                    fi
                    
                    if grep -q "TELEGRAM_CHAT_ID=" .env; then
                        sed -i "s/TELEGRAM_CHAT_ID=.*/TELEGRAM_CHAT_ID=$chat_id/" .env
                    else
                        echo "TELEGRAM_CHAT_ID=$chat_id" >> .env
                    fi
                    
                    print_success "تنظیمات تلگرام در .env ذخیره شد"
                else
                    print_error "خطا در ارسال پیام تست. Chat ID را بررسی کنید."
                fi
            fi
        else
            print_error "Token ربات نامعتبر است"
        fi
    fi
fi

echo ""

# Email Setup
print_step "تنظیم هشدارهای ایمیل"
read -p "آیا می‌خواهید هشدارهای ایمیل فعال کنید؟ (y/n): " setup_email

if [ "$setup_email" = "y" ] || [ "$setup_email" = "Y" ]; then
    read -p "ایمیل‌های دریافت هشدار (با کاما جدا کنید): " email_recipients
    
    if [ -n "$email_recipients" ]; then
        # Update .env file
        if grep -q "ALERT_EMAIL_ENABLED=" .env; then
            sed -i "s/ALERT_EMAIL_ENABLED=.*/ALERT_EMAIL_ENABLED=true/" .env
        else
            echo "ALERT_EMAIL_ENABLED=true" >> .env
        fi
        
        if grep -q "ALERT_EMAIL_RECIPIENTS=" .env; then
            sed -i "s/ALERT_EMAIL_RECIPIENTS=.*/ALERT_EMAIL_RECIPIENTS=$email_recipients/" .env
        else
            echo "ALERT_EMAIL_RECIPIENTS=$email_recipients" >> .env
        fi
        
        print_success "تنظیمات ایمیل در .env ذخیره شد"
    fi
fi

echo ""

# Monitoring Thresholds
print_step "تنظیم آستانه‌های مانیتورینگ"
echo "آستانه‌های فعلی:"
echo "- حداکثر زمان پاسخ API: ${MAX_RESPONSE_TIME:-5000}ms"
echo "- حداقل فضای آزاد دیسک: ${MIN_FREE_DISK:-10}%"
echo "- حداقل حافظه آزاد: ${MIN_FREE_MEMORY:-10}%"
echo "- حداکثر اندازه فایل لاگ: ${MAX_LOG_SIZE:-500}MB"
echo ""

read -p "آیا می‌خواهید این مقادیر را تغییر دهید؟ (y/n): " change_thresholds

if [ "$change_thresholds" = "y" ] || [ "$change_thresholds" = "Y" ]; then
    read -p "حداکثر زمان پاسخ API (میلی‌ثانیه) [5000]: " max_response_time
    read -p "حداقل فضای آزاد دیسک (درصد) [10]: " min_free_disk
    read -p "حداقل حافظه آزاد (درصد) [10]: " min_free_memory
    read -p "حداکثر اندازه فایل لاگ (مگابایت) [500]: " max_log_size
    
    # Set defaults if empty
    max_response_time=${max_response_time:-5000}
    min_free_disk=${min_free_disk:-10}
    min_free_memory=${min_free_memory:-10}
    max_log_size=${max_log_size:-500}
    
    # Update .env file
    for var in "MAX_RESPONSE_TIME=$max_response_time" \
               "MIN_FREE_DISK=$min_free_disk" \
               "MIN_FREE_MEMORY=$min_free_memory" \
               "MAX_LOG_SIZE=$max_log_size"; do
        
        var_name=$(echo $var | cut -d= -f1)
        var_value=$(echo $var | cut -d= -f2)
        
        if grep -q "$var_name=" .env; then
            sed -i "s/$var_name=.*/$var/" .env
        else
            echo "$var" >> .env
        fi
    done
    
    print_success "آستانه‌های مانیتورینگ به‌روزرسانی شد"
fi

echo ""

# Test Alert System
print_step "تست سیستم هشدار"
read -p "آیا می‌خواهید سیستم هشدار را تست کنید؟ (y/n): " test_alerts

if [ "$test_alerts" = "y" ] || [ "$test_alerts" = "Y" ]; then
    if [ -f "dist/server.js" ]; then
        print_warning "در حال تست سیستم هشدار..."
        
        # Start server temporarily if not running
        if ! curl -s http://localhost:3000/health > /dev/null 2>&1; then
            print_warning "سرور در حال اجرا نیست. شروع موقت..."
            npm run build > /dev/null 2>&1
            node dist/server.js &
            SERVER_PID=$!
            sleep 5
        fi
        
        # Test alerts via API
        if curl -s http://localhost:3000/health > /dev/null 2>&1; then
            curl -s -X POST http://localhost:3000/api/admin/alerts/test \
                 -H "Content-Type: application/json" \
                 -H "Authorization: Bearer test-token" > /dev/null 2>&1 || true
            
            print_success "تست هشدار ارسال شد (در صورت تنظیم صحیح)"
        fi
        
        # Kill temporary server if we started it
        if [ -n "$SERVER_PID" ]; then
            kill $SERVER_PID 2>/dev/null || true
        fi
    else
        print_warning "سرور build نشده. ابتدا npm run build اجرا کنید"
    fi
fi

echo ""
print_success "تنظیم سیستم هشدار تکمیل شد!"
echo ""
echo "📋 مراحل بعدی:"
echo "1. سرور را restart کنید: pm2 restart psygstore-backend"
echo "2. Health check را اجرا کنید: ./scripts/health-check.sh"
echo "3. Monitoring را فعال کنید: ./scripts/monitoring.sh"
echo ""
echo "📞 در صورت بروز مشکل:"
echo "- تلگرام: @Psygsupport"
echo "- ایمیل: support@psygstore.com"