import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../server';
import { prisma } from './setup';
import { generateAccessToken } from '@/middleware/auth';
import { AlertService } from '@/services/AlertService';

describe('End-to-End Tests', () => {
  let adminUser: any;
  let regularUser: any;
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    // Disable alerts during testing
    process.env.ALERT_EMAIL_ENABLED = 'false';
    process.env.TELEGRAM_BOT_TOKEN = '';
    
    // Create admin user
    adminUser = await prisma.user.create({
      data: {
        email: 'admin@psygstore.com',
        fullName: 'Admin User',
        passwordHash: await bcrypt.hash('admin123456', 12),
        authType: 'EMAIL',
        isAdmin: true,
        emailVerified: true,
      },
    });

    adminToken = generateAccessToken(adminUser);

    // Create regular user
    regularUser = await prisma.user.create({
      data: {
        email: 'user@example.com',
        fullName: 'Test User',
        passwordHash: await bcrypt.hash('user123456', 12),
        authType: 'EMAIL',
        walletBalanceRial: 5000000, // 5M Toman
        emailVerified: true,
      },
    });

    userToken = generateAccessToken(regularUser);

    // Set up initial crypto prices
    await prisma.cryptoPrice.createMany({
      data: [
        { currency: 'USDT', priceIrt: 65000 },
        { currency: 'BTC', priceIrt: 2600000000 },
        { currency: 'ETH', priceIrt: 160000000 },
        { currency: 'TON', priceIrt: 300000 },
      ],
    });
  });

  describe('Complete User Journey', () => {
    it('should complete full user registration and authentication flow', async () => {
      // 1. Register new user
      const newUserData = {
        email: 'newuser@example.com',
        fullName: 'New User',
        password: 'newuser123',
      };

      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(newUserData)
        .expect(201);

      expect(registerResponse.body.success).toBe(true);
      expect(registerResponse.body.user.email).toBe(newUserData.email);
      expect(registerResponse.body.accessToken).toBeDefined();

      // 2. Login with new user
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: newUserData.email,
          password: newUserData.password,
        })
        .expect(200);

      expect(loginResponse.body.success).toBe(true);
      expect(loginResponse.body.accessToken).toBeDefined();

      const newUserToken = loginResponse.body.accessToken;

      // 3. Get user profile
      const profileResponse = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${newUserToken}`)
        .expect(200);

      expect(profileResponse.body.success).toBe(true);
      expect(profileResponse.body.user.email).toBe(newUserData.email);
    });

    it('should complete full payment and order flow', async () => {
      // 1. Check current prices
      const pricesResponse = await request(app)
        .get('/api/payments/prices/current')
        .expect(200);

      expect(pricesResponse.body.success).toBe(true);
      expect(pricesResponse.body.prices.USDT).toBeDefined();

      // 2. Create ZarinPal payment (mock)
      const paymentData = {
        amount: 1000000, // 1M Toman
        description: 'شارژ کیف پول تست',
      };

      // Mock ZarinPal service for testing
      jest.doMock('@/services/ZarinpalService', () => ({
        ZarinpalService: jest.fn().mockImplementation(() => ({
          createPayment: jest.fn().mockResolvedValue({
            success: true,
            authority: 'A00000000000000000000000000000000000',
            paymentUrl: 'https://sandbox.zarinpal.com/pg/StartPay/A00000000000000000000000000000000000',
          }),
          verifyPayment: jest.fn().mockResolvedValue({
            success: true,
            refId: '123456789',
          }),
        })),
      }));

      const paymentResponse = await request(app)
        .post('/api/payments/zarinpal/request')
        .set('Authorization', `Bearer ${userToken}`)
        .send(paymentData)
        .expect(200);

      expect(paymentResponse.body.success).toBe(true);
      expect(paymentResponse.body.authority).toBeDefined();

      // 3. Simulate payment verification (would normally come from ZarinPal)
      const verifyResponse = await request(app)
        .get(`/api/payments/zarinpal/verify?Authority=${paymentResponse.body.authority}&Status=OK`)
        .expect(200);

      expect(verifyResponse.body.success).toBe(true);

      // 4. Check updated wallet balance
      const walletResponse = await request(app)
        .get('/api/wallet')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(walletResponse.body.wallet.balanceRial).toBeGreaterThan(5000000);

      // 5. Create order
      const orderData = {
        productId: 'telegram-premium',
        optionName: 'اشتراک ماهانه',
        quantity: 1,
        totalPrice: 795000,
        telegramId: '@testuser',
      };

      const orderResponse = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send(orderData)
        .expect(201);

      expect(orderResponse.body.success).toBe(true);
      expect(orderResponse.body.order.productId).toBe(orderData.productId);
      expect(orderResponse.body.order.status).toBe('PENDING');

      // 6. Get user orders
      const ordersResponse = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(ordersResponse.body.success).toBe(true);
      expect(ordersResponse.body.orders).toHaveLength(1);
    });

    it('should complete crypto payment flow', async () => {
      // Mock Payment4 service
      jest.doMock('@/services/Payment4Service', () => ({
        Payment4Service: jest.fn().mockImplementation(() => ({
          createPayment: jest.fn().mockResolvedValue({
            success: true,
            paymentId: 'payment_123456',
            paymentUrl: 'https://payment4.io/pay/payment_123456',
            walletAddress: '0x925FE9Df719925C3864c4C17bf7F3FeE8047C938',
          }),
          verifyPayment: jest.fn().mockResolvedValue({
            success: true,
            status: 'completed',
            transactionHash: '0x1234567890abcdef',
          }),
        })),
      }));

      // 1. Create crypto payment request
      const cryptoPaymentData = {
        amount: 15.38, // USDT amount
        currency: 'USDT',
        description: 'شارژ کیف پول با USDT',
      };

      const cryptoPaymentResponse = await request(app)
        .post('/api/payments/crypto/request')
        .set('Authorization', `Bearer ${userToken}`)
        .send(cryptoPaymentData)
        .expect(200);

      expect(cryptoPaymentResponse.body.success).toBe(true);
      expect(cryptoPaymentResponse.body.paymentId).toBeDefined();
      expect(cryptoPaymentResponse.body.currency).toBe('USDT');

      // 2. Verify crypto payment
      const verifyResponse = await request(app)
        .get(`/api/payments/crypto/verify/${cryptoPaymentResponse.body.paymentId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(verifyResponse.body.success).toBe(true);
      expect(verifyResponse.body.status).toBe('completed');
    });
  });

  describe('Admin Panel Complete Flow', () => {
    it('should complete full admin workflow', async () => {
      // 1. Admin dashboard
      const dashboardResponse = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(dashboardResponse.body.success).toBe(true);
      expect(dashboardResponse.body.data.stats).toBeDefined();

      // 2. Create article
      const articleData = {
        title: 'مقاله تست ادمین',
        slug: 'test-admin-article',
        excerpt: 'این یک مقاله تست است',
        content: 'محتوای کامل مقاله تست که باید حداقل 100 کاراکتر باشد تا validation را پاس کند و در سیستم ذخیره شود.',
        category: 'تست',
        readTime: 5,
        keywords: ['تست', 'ادمین'],
        metaDescription: 'مقاله تست برای آزمایش سیستم',
        isPublished: true,
      };

      const createArticleResponse = await request(app)
        .post('/api/admin/articles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(articleData)
        .expect(201);

      expect(createArticleResponse.body.success).toBe(true);
      expect(createArticleResponse.body.article.title).toBe(articleData.title);

      const articleId = createArticleResponse.body.article.id;

      // 3. Update article
      const updateData = {
        title: 'مقاله تست ادمین - ویرایش شده',
        readTime: 7,
      };

      const updateArticleResponse = await request(app)
        .put(`/api/admin/articles/${articleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updateData)
        .expect(200);

      expect(updateArticleResponse.body.success).toBe(true);

      // 4. Create coupon
      const couponData = {
        code: 'TESTADMIN',
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
      expect(createCouponResponse.body.coupon.code).toBe(couponData.code);

      // 5. Get sales report
      const salesReportResponse = await request(app)
        .get('/api/admin/reports/sales')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(salesReportResponse.body.success).toBe(true);
      expect(salesReportResponse.body.report.type).toBe('sales');

      // 6. Manual price update
      const priceUpdateResponse = await request(app)
        .post('/api/admin/prices/update')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(priceUpdateResponse.body.success).toBe(true);

      // 7. Get user list
      const usersResponse = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(usersResponse.body.success).toBe(true);
      expect(usersResponse.body.users.length).toBeGreaterThan(0);
    });

    it('should prevent non-admin access to admin endpoints', async () => {
      // Try to access admin dashboard with regular user token
      const response = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body.error).toContain('Admin privileges required');
    });
  });

  describe('Security Tests', () => {
    it('should enforce rate limiting', async () => {
      // Make multiple rapid requests to trigger rate limiting
      const requests = Array(10).fill(null).map(() =>
        request(app)
          .post('/api/auth/login')
          .send({
            email: 'nonexistent@example.com',
            password: 'wrongpassword',
          })
      );

      const responses = await Promise.all(requests);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should validate input properly', async () => {
      // Test SQL injection attempt
      const maliciousData = {
        email: "'; DROP TABLE users; --",
        password: 'password123',
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(maliciousData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Validation failed');
    });

    it('should handle XSS attempts', async () => {
      const xssData = {
        fullName: '<script>alert("xss")</script>',
        email: 'test@example.com',
        password: 'password123',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(xssData)
        .expect(201);

      // Check that script tags were sanitized
      expect(response.body.user.fullName).not.toContain('<script>');
    });

    it('should require authentication for protected routes', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .expect(401);

      expect(response.body.error).toContain('Authorization token required');
    });

    it('should validate JWT tokens properly', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.error).toContain('Invalid token');
    });
  });

  describe('Payment Integration Tests', () => {
    it('should handle ZarinPal payment flow', async () => {
      // Mock successful ZarinPal responses
      const mockZarinpalService = require('@/services/ZarinpalService').ZarinpalService;
      mockZarinpalService.prototype.createPayment = jest.fn().mockResolvedValue({
        success: true,
        authority: 'A00000000000000000000000000000000000',
        paymentUrl: 'https://sandbox.zarinpal.com/pg/StartPay/A00000000000000000000000000000000000',
      });

      mockZarinpalService.prototype.verifyPayment = jest.fn().mockResolvedValue({
        success: true,
        refId: '123456789',
      });

      // Create payment
      const paymentResponse = await request(app)
        .post('/api/payments/zarinpal/request')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          amount: 500000,
          description: 'تست پرداخت',
        })
        .expect(200);

      expect(paymentResponse.body.success).toBe(true);

      // Verify payment
      const verifyResponse = await request(app)
        .get(`/api/payments/zarinpal/verify?Authority=${paymentResponse.body.authority}&Status=OK`)
        .expect(200);

      expect(verifyResponse.body.success).toBe(true);
    });

    it('should handle crypto payment flow', async () => {
      // Mock Payment4 service
      const mockPayment4Service = require('@/services/Payment4Service').Payment4Service;
      mockPayment4Service.prototype.createPayment = jest.fn().mockResolvedValue({
        success: true,
        paymentId: 'payment_test_123',
        paymentUrl: 'https://payment4.io/pay/payment_test_123',
        walletAddress: '0x925FE9Df719925C3864c4C17bf7F3FeE8047C938',
      });

      mockPayment4Service.prototype.verifyPayment = jest.fn().mockResolvedValue({
        success: true,
        status: 'completed',
        transactionHash: '0xabcdef123456',
      });

      // Create crypto payment
      const cryptoPaymentResponse = await request(app)
        .post('/api/payments/crypto/request')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          amount: 10,
          currency: 'USDT',
          description: 'تست پرداخت کریپتو',
        })
        .expect(200);

      expect(cryptoPaymentResponse.body.success).toBe(true);
      expect(cryptoPaymentResponse.body.currency).toBe('USDT');

      // Verify crypto payment
      const verifyResponse = await request(app)
        .get(`/api/payments/crypto/verify/${cryptoPaymentResponse.body.paymentId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(verifyResponse.body.success).toBe(true);
    });
  });

  describe('Article Management Tests', () => {
    it('should complete article CRUD operations', async () => {
      // 1. Create article
      const articleData = {
        title: 'مقاله تست کامل',
        slug: 'complete-test-article',
        excerpt: 'خلاصه مقاله تست',
        content: 'محتوای کامل مقاله تست که باید حداقل 100 کاراکتر باشد تا validation را پاس کند و در سیستم به درستی ذخیره شود.',
        category: 'تست',
        readTime: 8,
        keywords: ['تست', 'مقاله', 'CRUD'],
        metaDescription: 'مقاله تست برای آزمایش عملیات CRUD',
        isPublished: false,
      };

      const createResponse = await request(app)
        .post('/api/admin/articles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(articleData)
        .expect(201);

      expect(createResponse.body.success).toBe(true);
      const articleId = createResponse.body.article.id;

      // 2. Get article
      const getResponse = await request(app)
        .get(`/api/admin/articles/${articleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(getResponse.body.success).toBe(true);
      expect(getResponse.body.article.title).toBe(articleData.title);

      // 3. Update article
      const updateResponse = await request(app)
        .put(`/api/admin/articles/${articleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'مقاله تست کامل - ویرایش شده',
          isPublished: true,
        })
        .expect(200);

      expect(updateResponse.body.success).toBe(true);

      // 4. Publish article
      const publishResponse = await request(app)
        .post(`/api/admin/articles/${articleId}/publish`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(publishResponse.body.success).toBe(true);

      // 5. Check if article is visible in public API
      const publicResponse = await request(app)
        .get(`/api/articles/${articleData.slug}`)
        .expect(200);

      expect(publicResponse.body.success).toBe(true);
      expect(publicResponse.body.article.slug).toBe(articleData.slug);

      // 6. Delete article
      const deleteResponse = await request(app)
        .delete(`/api/admin/articles/${articleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(deleteResponse.body.success).toBe(true);
    });
  });

  describe('Coupon System Tests', () => {
    it('should validate and apply coupons correctly', async () => {
      // 1. Create coupon
      const couponData = {
        code: 'TESTCOUPON20',
        type: 'PERCENTAGE',
        value: 20,
        minAmount: 500000,
        usageLimit: 5,
      };

      const createCouponResponse = await request(app)
        .post('/api/admin/coupons')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(couponData)
        .expect(201);

      expect(createCouponResponse.body.success).toBe(true);

      // 2. Validate coupon
      const validateResponse = await request(app)
        .post('/api/coupons/validate')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          code: 'TESTCOUPON20',
          orderAmount: 1000000,
        })
        .expect(200);

      expect(validateResponse.body.success).toBe(true);
      expect(validateResponse.body.coupon.discountAmount).toBe(200000); // 20% of 1M

      // 3. Use coupon in order
      const orderWithCouponResponse = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          productId: 'spotify',
          optionName: 'اشتراک ماهانه',
          quantity: 1,
          totalPrice: 510000,
          couponCode: 'TESTCOUPON20',
        })
        .expect(201);

      expect(orderWithCouponResponse.body.success).toBe(true);
      expect(orderWithCouponResponse.body.order.discountAmount).toBe(102000); // 20% of 510K

      // 4. Try to use same coupon again (should fail)
      const duplicateUseResponse = await request(app)
        .post('/api/coupons/validate')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          code: 'TESTCOUPON20',
          orderAmount: 1000000,
        })
        .expect(400);

      expect(duplicateUseResponse.body.success).toBe(false);
      expect(duplicateUseResponse.body.error).toContain('قبلاً از این کد تخفیف استفاده');
    });
  });

  describe('Price Update Service Tests', () => {
    it('should update prices from Nobitex API', async () => {
      // Mock Nobitex API response
      const mockAxios = require('axios');
      mockAxios.get = jest.fn().mockResolvedValue({
        data: {
          status: 'ok',
          stats: {
            'usdt-irt': { latest: '66000' },
            'btc-irt': { latest: '2700000000' },
            'eth-irt': { latest: '165000000' },
          },
        },
      });

      // Trigger manual price update
      const updateResponse = await request(app)
        .post('/api/admin/prices/update')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(updateResponse.body.success).toBe(true);
      expect(updateResponse.body.prices).toBeDefined();

      // Check if prices were updated in database
      const pricesResponse = await request(app)
        .get('/api/payments/prices/current')
        .expect(200);

      expect(pricesResponse.body.success).toBe(true);
      expect(pricesResponse.body.prices.USDT).toBe(66000);
    });
  });
});