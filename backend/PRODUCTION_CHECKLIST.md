# 🚀 PSYGStore Production Deployment Checklist

## ✅ Pre-Deployment Checklist

### 🔐 Security
- [ ] تمام رمزهای پیش‌فرض تغییر یافته‌اند
- [ ] JWT secrets قوی و منحصربه‌فرد تنظیم شده‌اند
- [ ] 2FA برای ادمین فعال شده
- [ ] CORS فقط برای دامنه‌های مجاز تنظیم شده
- [ ] Rate limiting برای تمام endpoints فعال است
- [ ] Input validation و sanitization تست شده
- [ ] SSL certificate نصب و معتبر است
- [ ] Firewall تنظیم شده (فقط پورت‌های ضروری باز)

### 🗄️ Database
- [ ] MySQL نصب و امن‌سازی شده
- [ ] Database و user ایجاد شده‌اند
- [ ] Prisma schema اعمال شده
- [ ] Initial data seed انجام شده
- [ ] Database backup تنظیم شده
- [ ] Connection pooling بهینه‌سازی شده

### 🌐 Infrastructure
- [ ] Node.js 18+ نصب شده
- [ ] PM2 نصب و تنظیم شده
- [ ] Nginx reverse proxy پیکربندی شده
- [ ] Log rotation تنظیم شده
- [ ] Monitoring scripts فعال شده‌اند
- [ ] Cron jobs تنظیم شده‌اند

### 📊 Services
- [ ] Price update service تست شده
- [ ] ZarinPal integration تست شده
- [ ] Payment4 integration تست شده
- [ ] Email service تنظیم شده
- [ ] Logging system فعال است

## 🧪 Testing Checklist

### 🔑 Authentication Tests
- [ ] User registration کار می‌کند
- [ ] User login کار می‌کند
- [ ] Web3 wallet login کار می‌کند
- [ ] JWT token refresh کار می‌کند
- [ ] Admin 2FA کار می‌کند
- [ ] Password reset کار می‌کند

### 💳 Payment Tests
- [ ] ZarinPal payment request ایجاد می‌شود
- [ ] ZarinPal callback صحیح کار می‌کند
- [ ] Crypto payment request ایجاد می‌شود
- [ ] Price updates از Nobitex کار می‌کند
- [ ] Wallet balance صحیح به‌روزرسانی می‌شود

### 🛒 Business Logic Tests
- [ ] Order creation کار می‌کند
- [ ] Coupon validation کار می‌کند
- [ ] Wallet deduction صحیح است
- [ ] Order status updates کار می‌کند
- [ ] Refund process کار می‌کند

### 👨‍💼 Admin Panel Tests
- [ ] Admin login کار می‌کند
- [ ] Dashboard stats نمایش داده می‌شود
- [ ] Article CRUD کار می‌کند
- [ ] User management کار می‌کند
- [ ] Order management کار می‌کند
- [ ] Reports generation کار می‌کند
- [ ] Manual price update کار می‌کند

### 🔒 Security Tests
- [ ] Rate limiting کار می‌کند
- [ ] Input validation کار می‌کند
- [ ] XSS protection کار می‌کند
- [ ] SQL injection prevention کار می‌کند
- [ ] Unauthorized access blocked می‌شود
- [ ] Admin-only routes محافظت شده‌اند

## 📈 Performance Checklist

### ⚡ Response Times
- [ ] API health check < 1 second
- [ ] User login < 2 seconds
- [ ] Order creation < 3 seconds
- [ ] Admin dashboard < 5 seconds
- [ ] Price updates < 10 seconds

### 💾 Resource Usage
- [ ] Memory usage < 80% در شرایط عادی
- [ ] CPU usage < 70% در شرایط عادی
- [ ] Disk space > 20% free
- [ ] Database connections < 80% of max

### 📊 Monitoring
- [ ] Health check script کار می‌کند
- [ ] Log rotation فعال است
- [ ] Error alerting تنظیم شده
- [ ] Performance metrics جمع‌آوری می‌شود
- [ ] Alert thresholds تنظیم شده‌اند
- [ ] Telegram bot برای alerts پیکربندی شده
- [ ] Email alerts تست شده‌اند
- [ ] SSL expiry monitoring فعال است
- [ ] Database performance monitoring کار می‌کند

## 🚨 Emergency Procedures

### 🔥 Critical Issues
1. **API Down**: 
   - Check PM2 status: `pm2 status`
   - Restart: `pm2 restart psygstore-backend`
   - Check logs: `pm2 logs psygstore-backend`

2. **Database Issues**:
   - Check MySQL status: `sudo systemctl status mysql`
   - Check connections: `mysql -u root -p -e "SHOW PROCESSLIST;"`
   - Restart if needed: `sudo systemctl restart mysql`

3. **High Resource Usage**:
   - Check processes: `top` or `htop`
   - Check disk space: `df -h`
   - Clean logs if needed: `find /var/log -name "*.log" -mtime +7 -delete`

4. **Payment Issues**:
   - Check external API status
   - Verify webhook endpoints
   - Check payment logs: `tail -f logs/payments-*.log`

### 📞 Contact Information
- **Primary**: @Psygsupport (Telegram)
- **Email**: support@psygstore.com
- **Emergency**: [شماره تماس اضطراری]

## 📝 Post-Deployment Tasks

### Day 1
- [ ] Monitor all systems for 24 hours
- [ ] Test all critical user flows
- [ ] Verify payment processing
- [ ] Check log files for errors
- [ ] Confirm backup systems working

### Week 1
- [ ] Review performance metrics
- [ ] Analyze user behavior
- [ ] Check security logs
- [ ] Optimize slow queries
- [ ] Update documentation

### Month 1
- [ ] Security audit
- [ ] Performance optimization
- [ ] Backup verification
- [ ] Disaster recovery test
- [ ] Capacity planning review

---

**⚠️ نکته مهم**: این checklist باید قبل از هر deployment بررسی شود و تمام موارد تأیید شوند.