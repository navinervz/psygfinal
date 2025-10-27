import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../server';
import { prisma } from './setup';
import { generateAccessToken } from '@/middleware/auth';

describe('Admin Panel', () => {
  let admin: any;
  let adminToken: string;
  let regularUser: any;
  let userToken: string;

  beforeEach(async () => {
    // Create admin user
    admin = await prisma.user.create({
      data: {
        email: 'admin@psygstore.com',
        fullName: 'Admin User',
        passwordHash: await bcrypt.hash('admin123', 12),
        authType: 'EMAIL',
        isAdmin: true,
        emailVerified: true,
      },
    });

    adminToken = generateAccessToken(admin);

    // Create regular user
    regularUser = await prisma.user.create({
      data: {
        email: 'user@example.com',
        fullName: 'Regular User',
        passwordHash: await bcrypt.hash('user123', 12),
        authType: 'EMAIL',
        emailVerified: true,
      },
    });

    userToken = generateAccessToken(regularUser);
  });

  describe('GET /api/admin/dashboard', () => {
    it('should get dashboard stats for admin', async () => {
      const response = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.stats).toBeDefined();
      expect(response.body.data.stats.totalUsers).toBeDefined();
    });

    it('should deny access to regular user', async () => {
      const response = await request(app)
        .get('/api/admin/dashboard')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body.error).toContain('Admin privileges required');
    });
  });

  describe('POST /api/admin/articles', () => {
    it('should create article as admin', async () => {
      const articleData = {
        title: 'Test Article',
        slug: 'test-article',
        excerpt: 'This is a test article',
        content: 'This is the content of the test article. It should be at least 100 characters long to pass validation.',
        category: 'Test',
        readTime: 5,
        keywords: ['test', 'article'],
        metaDescription: 'Test article meta description',
        isPublished: true,
      };

      const response = await request(app)
        .post('/api/admin/articles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(articleData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.article.title).toBe(articleData.title);
      expect(response.body.article.slug).toBe(articleData.slug);

      // Check if article was created
      const article = await prisma.article.findUnique({
        where: { slug: articleData.slug },
      });
      expect(article).toBeTruthy();
    });

    it('should not allow duplicate slug', async () => {
      // Create article first
      await prisma.article.create({
        data: {
          title: 'Existing Article',
          slug: 'test-article',
          content: 'Existing content that is long enough for validation',
          authorId: admin.id,
        },
      });

      const articleData = {
        title: 'New Article',
        slug: 'test-article', // Same slug
        content: 'New content that is also long enough for validation',
      };

      const response = await request(app)
        .post('/api/admin/articles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(articleData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('slug already exists');
    });
  });

  describe('POST /api/admin/coupons', () => {
    it('should create coupon as admin', async () => {
      const couponData = {
        code: 'TESTCOUPON',
        type: 'PERCENTAGE',
        value: 15,
        minAmount: 100000,
        usageLimit: 50,
      };

      const response = await request(app)
        .post('/api/admin/coupons')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(couponData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.coupon.code).toBe(couponData.code);
      expect(response.body.coupon.type).toBe(couponData.type);

      // Check if coupon was created
      const coupon = await prisma.coupon.findUnique({
        where: { code: couponData.code },
      });
      expect(coupon).toBeTruthy();
    });

    it('should validate percentage value', async () => {
      const response = await request(app)
        .post('/api/admin/coupons')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          code: 'INVALID',
          type: 'PERCENTAGE',
          value: 150, // Invalid percentage
          minAmount: 100000,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('between 1 and 100');
    });
  });

  describe('GET /api/admin/reports/sales', () => {
    beforeEach(async () => {
      // Create test orders
      await prisma.order.createMany({
        data: [
          {
            userId: regularUser.id,
            productId: 'telegram-premium',
            optionName: 'اشتراک ماهانه',
            quantity: 1,
            totalPrice: 795000,
            status: 'COMPLETED',
          },
          {
            userId: regularUser.id,
            productId: 'spotify',
            optionName: 'اشتراک ماهانه',
            quantity: 1,
            totalPrice: 510000,
            status: 'COMPLETED',
          },
        ],
      });
    });

    it('should get sales report', async () => {
      const response = await request(app)
        .get('/api/admin/reports/sales')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.report.type).toBe('sales');
      expect(response.body.report.summary.totalOrders).toBe(2);
      expect(response.body.report.summary.totalRevenue).toBe(1305000);
    });

    it('should filter sales report by date', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const response = await request(app)
        .get(`/api/admin/reports/sales?startDate=${tomorrow.toISOString().split('T')[0]}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.report.summary.totalOrders).toBe(0);
    });
  });
});