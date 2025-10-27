import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../server';
import { prisma } from './setup';
import { generateAccessToken } from '@/middleware/auth';

// Mock external services
jest.mock('@/services/ZarinpalService');
jest.mock('@/services/Payment4Service');

describe('Payments', () => {
  let user: any;
  let accessToken: string;

  beforeEach(async () => {
    user = await prisma.user.create({
      data: {
        email: 'test@example.com',
        fullName: 'Test User',
        passwordHash: await bcrypt.hash('password123', 12),
        authType: 'EMAIL',
        walletBalanceRial: 1000000,
        emailVerified: true,
      },
    });

    accessToken = generateAccessToken(user);
  });

  describe('POST /api/payments/zarinpal/request', () => {
    it('should create ZarinPal payment request', async () => {
      const paymentData = {
        amount: 500000,
        description: 'شارژ کیف پول',
      };

      // Mock ZarinPal service
      const mockZarinpalService = require('@/services/ZarinpalService').ZarinpalService;
      mockZarinpalService.prototype.createPayment = jest.fn().mockResolvedValue({
        success: true,
        authority: 'A00000000000000000000000000000000000',
        paymentUrl: 'https://sandbox.zarinpal.com/pg/StartPay/A00000000000000000000000000000000000',
      });

      const response = await request(app)
        .post('/api/payments/zarinpal/request')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(paymentData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.authority).toBeDefined();
      expect(response.body.paymentUrl).toBeDefined();

      // Check if payment request was stored
      const paymentRequest = await prisma.paymentRequest.findUnique({
        where: { authority: response.body.authority },
      });
      expect(paymentRequest).toBeTruthy();
      expect(Number(paymentRequest?.amount)).toBe(paymentData.amount);
    });

    it('should validate payment amount', async () => {
      const response = await request(app)
        .post('/api/payments/zarinpal/request')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          amount: 500, // Too low
          description: 'Test payment',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('between 1,000 and 50,000,000');
    });
  });

  describe('POST /api/payments/crypto/request', () => {
    beforeEach(async () => {
      // Set initial crypto prices
      await prisma.cryptoPrice.createMany({
        data: [
          { currency: 'USDT', priceIrt: 65000 },
          { currency: 'BTC', priceIrt: 2600000000 },
          { currency: 'ETH', priceIrt: 160000000 },
        ],
      });
    });

    it('should create crypto payment request', async () => {
      const paymentData = {
        amount: 10, // 10 USDT
        currency: 'USDT',
        description: 'شارژ کیف پول با USDT',
      };

      // Mock Payment4 service
      const mockPayment4Service = require('@/services/Payment4Service').Payment4Service;
      mockPayment4Service.prototype.createPayment = jest.fn().mockResolvedValue({
        success: true,
        paymentId: 'payment_123456',
        paymentUrl: 'https://payment4.io/pay/payment_123456',
        walletAddress: '0x925FE9Df719925C3864c4C17bf7F3FeE8047C938',
      });

      const response = await request(app)
        .post('/api/payments/crypto/request')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(paymentData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.paymentId).toBeDefined();
      expect(response.body.currency).toBe('USDT');
      expect(response.body.tomanEquivalent).toBe(650000); // 10 * 65000

      // Check if crypto payment request was stored
      const cryptoPaymentRequest = await prisma.cryptoPaymentRequest.findUnique({
        where: { paymentId: response.body.paymentId },
      });
      expect(cryptoPaymentRequest).toBeTruthy();
      expect(cryptoPaymentRequest?.currency).toBe('USDT');
    });

    it('should validate currency', async () => {
      const response = await request(app)
        .post('/api/payments/crypto/request')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          amount: 10,
          currency: 'INVALID',
          description: 'Test payment',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid currency');
    });
  });

  describe('GET /api/payments/prices/current', () => {
    beforeEach(async () => {
      await prisma.cryptoPrice.createMany({
        data: [
          { currency: 'USDT', priceIrt: 65000 },
          { currency: 'BTC', priceIrt: 2600000000 },
          { currency: 'ETH', priceIrt: 160000000 },
          { currency: 'TON', priceIrt: 300000 },
        ],
      });
    });

    it('should get current prices', async () => {
      const response = await request(app)
        .get('/api/payments/prices/current')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.prices).toBeDefined();
      expect(response.body.prices.USDT).toBe(65000);
      expect(response.body.prices.BTC).toBe(2600000000);
      expect(response.body.prices.ETH).toBe(160000000);
      expect(response.body.prices.TON).toBe(300000);
    });
  });
});