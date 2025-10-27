import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../server';
import { prisma } from './setup';
import { generateAccessToken } from '@/middleware/auth';

describe('Integration Tests - Complete User Flows', () => {
  let testUser: any;
  let adminUser: any;
  let userToken: string;
  let adminToken: string;

  beforeAll(async () => {
    // Create test users
    testUser = await prisma.user.create({
      data: {
        email: 'integration@test.com',
        fullName: 'Integration Test User',
        passwordHash: await bcrypt.hash('test123456', 12),
        authType: 'EMAIL',
        walletBalanceRial: 10000000, // 10M Toman
        emailVerified: true,
      },
    });

    adminUser = await prisma.user.create({
      data: {
        email: 'admin@integration.test',
        fullName: 'Integration Admin',
        passwordHash: await bcrypt.hash('admin123456', 12),
        authType: 'EMAIL',
        isAdmin: true,
        emailVerified: true,
      },
    });

    userToken = generateAccessToken(testUser);
    adminToken = generateAccessToken(adminUser);

    // Setup test data
    await prisma.cryptoPrice.createMany({
      data: [
        { currency: 'USDT', priceIrt: 65000 },
        { currency: 'BTC', priceIrt: 2600000000 },
        { currency: 'ETH', priceIrt: 160000000 },
      ],
    });
  });

  describe('Complete E-commerce Flow', () => {
    it('should complete full purchase flow with coupon', async () => {
      // 1. Admin creates a coupon
      const couponData = {
        code: 'INTEGRATION20',
        type: 'PERCENTAGE',
        value: 20,
        minAmount: 500000,
        usageLimit: 10,
      };

      const createCouponResponse = await request(app)
        .post('/api/admin/coupons')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(couponData)
        .expect(201);

      expect(createCouponResponse.body.success).toBe(true);

      // 2. User validates coupon
      const validateCouponResponse = await request(app)
        .post('/api/coupons/validate')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          code: 'INTEGRATION20',
          orderAmount: 1000000,
        })
        .expect(200);

      expect(validateCouponResponse.body.success).toBe(true);
      expect(validateCouponResponse.body.coupon.discountAmount).toBe(200000);

      // 3. User creates order with coupon
      const orderData = {
        productId: 'telegram-premium',
        optionName: 'اشتراک ماهانه',
        quantity: 1,
        totalPrice: 795000,
        telegramId: '@integrationtest',
        couponCode: 'INTEGRATION20',
      };

      const createOrderResponse = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send(orderData)
        .expect(201);

      expect(createOrderResponse.body.success).toBe(true);
      expect(createOrderResponse.body.order.discountAmount).toBe(159000); // 20% of 795000
      expect(createOrderResponse.body.order.totalPrice).toBe(636000); // 795000 - 159000

      const orderId = createOrderResponse.body.order.id;

      // 4. Admin views and processes order
      const getOrderResponse = await request(app)
        .get(`/api/admin/orders/${orderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(getOrderResponse.body.success).toBe(true);
      expect(getOrderResponse.body.order.status).toBe('PENDING');

      // 5. Admin updates order status
      const updateOrderResponse = await request(app)
        .put(`/api/admin/orders/${orderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'COMPLETED',
          adminNotes: 'Integration test - order completed',
        })
        .expect(200);

      expect(updateOrderResponse.body.success).toBe(true);

      // 6. Verify coupon usage was recorded
      const couponUsageResponse = await request(app)
        .get(`/api/admin/coupons/${createCouponResponse.body.coupon.id}/usage`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(couponUsageResponse.body.usages).toHaveLength(1);
      expect(couponUsageResponse.body.usages[0].discountAmount).toBe(159000);
    });

    it('should handle payment flow with wallet top-up', async () => {
      // Mock ZarinPal service
      const mockZarinpalService = require('@/services/ZarinpalService').ZarinpalService;
      mockZarinpalService.prototype.createPayment = jest.fn().mockResolvedValue({
        success: true,
        authority: 'A00000000000000000000000000000000000',
        paymentUrl: 'https://sandbox.zarinpal.com/pg/StartPay/A00000000000000000000000000000000000',
      });

      mockZarinpalService.prototype.verifyPayment = jest.fn().mockResolvedValue({
        success: true,
        refId: '987654321',
      });

      // 1. Check initial wallet balance
      const initialWalletResponse = await request(app)
        .get('/api/wallet')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const initialBalance = initialWalletResponse.body.wallet.balanceRial;

      // 2. Create payment request
      const paymentData = {
        amount: 2000000, // 2M Toman
        description: 'شارژ کیف پول تست یکپارچه',
      };

      const paymentResponse = await request(app)
        .post('/api/payments/zarinpal/request')
        .set('Authorization', `Bearer ${userToken}`)
        .send(paymentData)
        .expect(200);

      expect(paymentResponse.body.success).toBe(true);
      expect(paymentResponse.body.authority).toBeDefined();

      // 3. Verify payment
      const verifyResponse = await request(app)
        .get(`/api/payments/zarinpal/verify?Authority=${paymentResponse.body.authority}&Status=OK`)
        .expect(200);

      expect(verifyResponse.body.success).toBe(true);
      expect(verifyResponse.body.refId).toBe('987654321');

      // 4. Check updated wallet balance
      const updatedWalletResponse = await request(app)
        .get('/api/wallet')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const newBalance = updatedWalletResponse.body.wallet.balanceRial;
      expect(newBalance).toBe(initialBalance + 2000000);

      // 5. Get wallet transactions
      const transactionsResponse = await request(app)
        .get('/api/wallet/transactions')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(transactionsResponse.body.success).toBe(true);
      expect(transactionsResponse.body.transactions.length).toBeGreaterThan(0);
    });

    it('should handle crypto payment flow', async () => {
      // Mock Payment4 service
      const mockPayment4Service = require('@/services/Payment4Service').Payment4Service;
      mockPayment4Service.prototype.createPayment = jest.fn().mockResolvedValue({
        success: true,
        paymentId: 'integration_payment_123',
        paymentUrl: 'https://payment4.io/pay/integration_payment_123',
        walletAddress: '0x925FE9Df719925C3864c4C17bf7F3FeE8047C938',
      });

      mockPayment4Service.prototype.verifyPayment = jest.fn().mockResolvedValue({
        success: true,
        status: 'completed',
        transactionHash: '0xintegrationtest123456',
      });

      // 1. Create crypto payment
      const cryptoPaymentData = {
        amount: 30.77, // USDT
        currency: 'USDT',
        description: 'شارژ کیف پول با USDT - تست یکپارچه',
      };

      const cryptoPaymentResponse = await request(app)
        .post('/api/payments/crypto/request')
        .set('Authorization', `Bearer ${userToken}`)
        .send(cryptoPaymentData)
        .expect(200);

      expect(cryptoPaymentResponse.body.success).toBe(true);
      expect(cryptoPaymentResponse.body.currency).toBe('USDT');
      expect(cryptoPaymentResponse.body.tomanEquivalent).toBe(2000050); // 30.77 * 65000

      // 2. Verify crypto payment
      const verifyResponse = await request(app)
        .get(`/api/payments/crypto/verify/${cryptoPaymentResponse.body.paymentId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(verifyResponse.body.success).toBe(true);
      expect(verifyResponse.body.status).toBe('completed');
      expect(verifyResponse.body.transactionHash).toBe('0xintegrationtest123456');
    });
  });

  describe('Admin Management Flow', () => {
    it('should complete article management lifecycle', async () => {
      // 1. Create article
      const articleData = {
        title: 'مقاله تست یکپارچه',
        slug: 'integration-test-article',
        excerpt: 'این مقاله برای تست یکپارچه سیستم ایجاد شده است',
        content: `# مقاله تست یکپارچه

این مقاله برای تست کامل سیستم مدیریت مقالات ایجاد شده است. محتوای این مقاله باید حداقل 100 کاراکتر باشد تا validation را پاس کند.

## بخش‌های مقاله
- مقدمه
- محتوای اصلی  
- نتیجه‌گیری

این مقاله شامل تمام المان‌های مورد نیاز برای تست سیستم است.`,
        imageUrl: 'https://example.com/test-image.jpg',
        category: 'تست',
        readTime: 5,
        keywords: ['تست', 'یکپارچه', 'مقاله'],
        metaDescription: 'مقاله تست برای بررسی سیستم مدیریت محتوا',
        isPublished: false,
      };

      const createResponse = await request(app)
        .post('/api/admin/articles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(articleData)
        .expect(201);

      expect(createResponse.body.success).toBe(true);
      const articleId = createResponse.body.article.id;

      // 2. Update article
      const updateResponse = await request(app)
        .put(`/api/admin/articles/${articleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'مقاله تست یکپارچه - ویرایش شده',
          readTime: 7,
        })
        .expect(200);

      expect(updateResponse.body.success).toBe(true);

      // 3. Publish article
      const publishResponse = await request(app)
        .post(`/api/admin/articles/${articleId}/publish`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(publishResponse.body.success).toBe(true);

      // 4. Verify article is visible in public API
      const publicResponse = await request(app)
        .get('/api/articles/integration-test-article')
        .expect(200);

      expect(publicResponse.body.success).toBe(true);
      expect(publicResponse.body.article.isPublished).toBe(true);

      // 5. Get articles list
      const articlesListResponse = await request(app)
        .get('/api/articles?category=تست')
        .expect(200);

      expect(articlesListResponse.body.success).toBe(true);
      expect(articlesListResponse.body.articles.length).toBeGreaterThan(0);

      // 6. Unpublish article
      const unpublishResponse = await request(app)
        .post(`/api/admin/articles/${articleId}/unpublish`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(unpublishResponse.body.success).toBe(true);

      // 7. Verify article is no longer visible
      await request(app)
        .get('/api/articles/integration-test-article')
        .expect(404);
    });

    it('should generate comprehensive reports', async () => {
      // Create test data for reports
      await prisma.order.createMany({
        data: [
          {
            userId: testUser.id,
            productId: 'telegram-premium',
            optionName: 'اشتراک ماهانه',
            quantity: 1,
            totalPrice: 795000,
            status: 'COMPLETED',
          },
          {
            userId: testUser.id,
            productId: 'spotify',
            optionName: 'اشتراک ماهانه',
            quantity: 2,
            totalPrice: 1020000,
            status: 'COMPLETED',
          },
        ],
      });

      // 1. Sales report
      const salesReportResponse = await request(app)
        .get('/api/admin/reports/sales')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(salesReportResponse.body.success).toBe(true);
      expect(salesReportResponse.body.report.type).toBe('sales');
      expect(salesReportResponse.body.report.summary.totalOrders).toBeGreaterThan(0);

      // 2. Revenue report
      const revenueReportResponse = await request(app)
        .get('/api/admin/reports/revenue')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(revenueReportResponse.body.success).toBe(true);
      expect(revenueReportResponse.body.report.type).toBe('revenue');

      // 3. Users report
      const usersReportResponse = await request(app)
        .get('/api/admin/reports/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(usersReportResponse.body.success).toBe(true);
      expect(usersReportResponse.body.report.type).toBe('users');

      // 4. Products report
      const productsReportResponse = await request(app)
        .get('/api/admin/reports/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(productsReportResponse.body.success).toBe(true);
      expect(productsReportResponse.body.report.type).toBe('products');
    });
  });

  describe('Price Update Integration', () => {
    it('should update prices from Nobitex API', async () => {
      // Mock Nobitex API
      const mockAxios = require('axios');
      mockAxios.get = jest.fn().mockResolvedValue({
        data: {
          status: 'ok',
          stats: {
            'usdt-irt': { latest: '67000' },
            'btc-irt': { latest: '2750000000' },
            'eth-irt': { latest: '170000000' },
          },
        },
      });

      // 1. Manual price update
      const updateResponse = await request(app)
        .post('/api/admin/prices/update')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(updateResponse.body.success).toBe(true);
      expect(updateResponse.body.prices.USDT).toBe(67000);

      // 2. Get current prices
      const pricesResponse = await request(app)
        .get('/api/payments/prices/current')
        .expect(200);

      expect(pricesResponse.body.success).toBe(true);
      expect(pricesResponse.body.prices.USDT).toBe(67000);

      // 3. Get price history
      const historyResponse = await request(app)
        .get('/api/payments/prices/history/USDT?days=1')
        .expect(200);

      expect(historyResponse.body.success).toBe(true);
      expect(historyResponse.body.currency).toBe('USDT');
      expect(historyResponse.body.history.length).toBeGreaterThan(0);
    });
  });

  describe('Security Integration Tests', () => {
    it('should enforce rate limiting across endpoints', async () => {
      // Test auth rate limiting
      const authRequests = Array(10).fill(null).map(() =>
        request(app)
          .post('/api/auth/login')
          .send({
            email: 'nonexistent@test.com',
            password: 'wrongpassword',
          })
      );

      const authResponses = await Promise.all(authRequests);
      const rateLimitedAuth = authResponses.filter(res => res.status === 429);
      expect(rateLimitedAuth.length).toBeGreaterThan(0);

      // Test payment rate limiting
      const paymentRequests = Array(15).fill(null).map(() =>
        request(app)
          .post('/api/payments/zarinpal/request')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            amount: 100000,
            description: 'تست rate limiting',
          })
      );

      const paymentResponses = await Promise.all(paymentRequests);
      const rateLimitedPayments = paymentResponses.filter(res => res.status === 429);
      expect(rateLimitedPayments.length).toBeGreaterThan(0);
    });

    it('should validate all inputs properly', async () => {
      // Test invalid email format
      const invalidEmailResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email-format',
          fullName: 'Test User',
          password: 'password123',
        })
        .expect(400);

      expect(invalidEmailResponse.body.error).toContain('Validation failed');

      // Test SQL injection attempt
      const sqlInjectionResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: "'; DROP TABLE users; --",
          password: 'password123',
        })
        .expect(400);

      expect(sqlInjectionResponse.body.error).toContain('Validation failed');

      // Test XSS attempt
      const xssResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          fullName: '<script>alert("xss")</script>',
          password: 'password123',
        })
        .expect(201);

      // Should sanitize the input
      expect(xssResponse.body.user.fullName).not.toContain('<script>');
    });

    it('should handle admin 2FA flow', async () => {
      // This would require actual 2FA implementation testing
      // For now, we test the setup endpoint
      const setup2FAResponse = await request(app)
        .post('/api/users/setup-2fa')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(setup2FAResponse.body.success).toBe(true);
      expect(setup2FAResponse.body.secret).toBeDefined();
      expect(setup2FAResponse.body.qrCode).toBeDefined();
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle database connection errors gracefully', async () => {
      // This would require mocking database failures
      // For now, test invalid queries
      const invalidOrderResponse = await request(app)
        .get('/api/orders/invalid-uuid-format')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(invalidOrderResponse.body.success).toBe(false);
    });

    it('should handle external API failures', async () => {
      // Mock failed Nobitex API
      const mockAxios = require('axios');
      mockAxios.get = jest.fn().mockRejectedValue(new Error('Network error'));

      const priceUpdateResponse = await request(app)
        .post('/api/admin/prices/update')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(503);

      expect(priceUpdateResponse.body.success).toBe(false);
      expect(priceUpdateResponse.body.error).toContain('Failed to update prices');
    });
  });

  describe('Performance Integration Tests', () => {
    it('should handle concurrent requests efficiently', async () => {
      // Create multiple concurrent requests
      const concurrentRequests = Array(20).fill(null).map((_, index) =>
        request(app)
          .get('/api/articles')
          .query({ page: Math.floor(index / 5) + 1 })
      );

      const startTime = Date.now();
      const responses = await Promise.all(concurrentRequests);
      const endTime = Date.now();

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // Should complete within reasonable time
      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(10000); // 10 seconds
    });

    it('should handle large dataset queries efficiently', async () => {
      // Create test data
      const testOrders = Array(100).fill(null).map((_, index) => ({
        userId: testUser.id,
        productId: 'telegram-premium',
        optionName: 'اشتراک ماهانه',
        quantity: 1,
        totalPrice: 795000,
        status: 'COMPLETED' as const,
      }));

      await prisma.order.createMany({ data: testOrders });

      // Test pagination performance
      const startTime = Date.now();
      const ordersResponse = await request(app)
        .get('/api/admin/orders?limit=50&page=1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const endTime = Date.now();

      expect(ordersResponse.body.success).toBe(true);
      expect(ordersResponse.body.orders.length).toBe(50);
      expect(ordersResponse.body.pagination.total).toBeGreaterThan(100);

      // Should be fast even with large dataset
      const queryTime = endTime - startTime;
      expect(queryTime).toBeLessThan(2000); // 2 seconds
    });
  });
});