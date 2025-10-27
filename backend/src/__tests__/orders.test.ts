import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../server';
import { prisma } from './setup';
import { generateAccessToken } from '@/middleware/auth';

describe('Orders', () => {
  let user: any;
  let accessToken: string;

  beforeEach(async () => {
    // Create test user
    user = await prisma.user.create({
      data: {
        email: 'test@example.com',
        fullName: 'Test User',
        passwordHash: await bcrypt.hash('password123', 12),
        authType: 'EMAIL',
        walletBalanceRial: 5000000, // 5M Toman
        emailVerified: true,
      },
    });

    accessToken = generateAccessToken(user);
  });

  describe('POST /api/orders', () => {
    it('should create order successfully', async () => {
      const orderData = {
        productId: 'telegram-premium',
        optionName: 'اشتراک ماهانه',
        quantity: 1,
        totalPrice: 795000,
        telegramId: '@testuser',
        notes: 'Test order',
      };

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(orderData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.order.productId).toBe(orderData.productId);
      expect(response.body.order.status).toBe('PENDING');

      // Check if wallet balance was deducted
      const updatedUser = await prisma.user.findUnique({
        where: { id: user.id },
      });
      expect(Number(updatedUser?.walletBalanceRial)).toBe(5000000 - 795000);
    });

    it('should not create order with insufficient balance', async () => {
      // Update user balance to insufficient amount
      await prisma.user.update({
        where: { id: user.id },
        data: { walletBalanceRial: 100000 }, // Only 100K
      });

      const orderData = {
        productId: 'spotify',
        optionName: 'اشتراک ماهانه',
        quantity: 1,
        totalPrice: 510000,
      };

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(orderData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Insufficient wallet balance');
    });

    it('should apply coupon discount', async () => {
      // Create test coupon
      const coupon = await prisma.coupon.create({
        data: {
          code: 'TEST10',
          type: 'PERCENTAGE',
          value: 10,
          minAmount: 500000,
          usageLimit: 100,
          createdBy: user.id,
        },
      });

      const orderData = {
        productId: 'telegram-premium',
        optionName: 'اشتراک ماهانه',
        quantity: 1,
        totalPrice: 795000,
        couponCode: 'TEST10',
      };

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(orderData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.order.discountAmount).toBe(79500); // 10% of 795000
      expect(response.body.order.totalPrice).toBe(715500); // 795000 - 79500

      // Check coupon usage
      const couponUsage = await prisma.couponUsage.findFirst({
        where: { couponId: coupon.id, userId: user.id },
      });
      expect(couponUsage).toBeTruthy();
    });

    it('should validate product ID', async () => {
      const orderData = {
        productId: 'invalid-product',
        optionName: 'اشتراک ماهانه',
        quantity: 1,
        totalPrice: 795000,
      };

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(orderData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid product ID');
    });
  });

  describe('GET /api/orders', () => {
    beforeEach(async () => {
      // Create test orders
      await prisma.order.createMany({
        data: [
          {
            userId: user.id,
            productId: 'telegram-premium',
            optionName: 'اشتراک ماهانه',
            quantity: 1,
            totalPrice: 795000,
            status: 'COMPLETED',
          },
          {
            userId: user.id,
            productId: 'spotify',
            optionName: 'اشتراک ماهانه',
            quantity: 1,
            totalPrice: 510000,
            status: 'PENDING',
          },
        ],
      });
    });

    it('should get user orders', async () => {
      const response = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.orders).toHaveLength(2);
      expect(response.body.orders[0].userId).toBe(user.id);
    });

    it('should filter orders by status', async () => {
      const response = await request(app)
        .get('/api/orders?status=COMPLETED')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.orders).toHaveLength(1);
      expect(response.body.orders[0].status).toBe('COMPLETED');
    });

    it('should paginate orders', async () => {
      const response = await request(app)
        .get('/api/orders?page=1&limit=1')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.orders).toHaveLength(1);
      expect(response.body.pagination.total).toBe(2);
      expect(response.body.pagination.pages).toBe(2);
    });
  });

  describe('PUT /api/orders/:id/cancel', () => {
    let order: any;

    beforeEach(async () => {
      order = await prisma.order.create({
        data: {
          userId: user.id,
          productId: 'telegram-premium',
          optionName: 'اشتراک ماهانه',
          quantity: 1,
          totalPrice: 795000,
          status: 'PENDING',
        },
      });

      // Deduct from wallet (simulate order creation)
      await prisma.user.update({
        where: { id: user.id },
        data: { walletBalanceRial: 5000000 - 795000 },
      });
    });

    it('should cancel pending order and refund wallet', async () => {
      const response = await request(app)
        .put(`/api/orders/${order.id}/cancel`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Check order status
      const updatedOrder = await prisma.order.findUnique({
        where: { id: order.id },
      });
      expect(updatedOrder?.status).toBe('CANCELLED');

      // Check wallet refund
      const updatedUser = await prisma.user.findUnique({
        where: { id: user.id },
      });
      expect(Number(updatedUser?.walletBalanceRial)).toBe(5000000); // Refunded
    });

    it('should not cancel completed order', async () => {
      // Update order to completed
      await prisma.order.update({
        where: { id: order.id },
        data: { status: 'COMPLETED' },
      });

      const response = await request(app)
        .put(`/api/orders/${order.id}/cancel`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });
});