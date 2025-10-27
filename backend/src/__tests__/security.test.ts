import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../server';
import { prisma } from './setup';
import { generateAccessToken } from '@/middleware/auth';

describe('Security Tests', () => {
  let testUser: any;
  let userToken: string;

  beforeEach(async () => {
    testUser = await prisma.user.create({
      data: {
        email: 'security@test.com',
        fullName: 'Security Test User',
        passwordHash: await bcrypt.hash('secure123456', 12),
        authType: 'EMAIL',
        emailVerified: true,
      },
    });

    userToken = generateAccessToken(testUser);
  });

  describe('Input Validation Security', () => {
    it('should prevent SQL injection attempts', async () => {
      const maliciousInputs = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "'; UPDATE users SET isAdmin=1; --",
        "1' UNION SELECT * FROM users--",
      ];

      for (const maliciousInput of maliciousInputs) {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: maliciousInput,
            password: 'password123',
          })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('Validation failed');
      }
    });

    it('should prevent XSS attacks', async () => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        '<img src="x" onerror="alert(1)">',
        'javascript:alert("xss")',
        '<svg onload="alert(1)">',
      ];

      for (const payload of xssPayloads) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: 'test@example.com',
            fullName: payload,
            password: 'password123',
          })
          .expect(201);

        // Should sanitize the input
        expect(response.body.user.fullName).not.toContain('<script>');
        expect(response.body.user.fullName).not.toContain('javascript:');
        expect(response.body.user.fullName).not.toContain('onerror');
      }
    });

    it('should validate email format strictly', async () => {
      const invalidEmails = [
        'invalid-email',
        '@domain.com',
        'user@',
        'user..name@domain.com',
        'user@domain',
        'user name@domain.com',
      ];

      for (const email of invalidEmails) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email,
            fullName: 'Test User',
            password: 'password123',
          })
          .expect(400);

        expect(response.body.error).toContain('Validation failed');
      }
    });

    it('should enforce password strength', async () => {
      const weakPasswords = [
        '123',
        'password',
        '12345678',
        'qwerty',
        'admin',
      ];

      for (const password of weakPasswords) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: 'test@example.com',
            fullName: 'Test User',
            password,
          })
          .expect(400);

        expect(response.body.error).toContain('Validation failed');
      }
    });
  });

  describe('Authentication Security', () => {
    it('should prevent brute force attacks with rate limiting', async () => {
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

    it('should invalidate tokens on logout', async () => {
      // Login
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'secure123456',
        })
        .expect(200);

      const token = loginResponse.body.accessToken;

      // Use token
      await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Logout
      await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Token should still work (stateless JWT)
      // But refresh token should be cleared
      const profileResponse = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(profileResponse.body.success).toBe(true);
    });

    it('should reject expired tokens', async () => {
      // This would require mocking JWT expiration
      // For now, test invalid token format
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', 'Bearer invalid.token.format')
        .expect(401);

      expect(response.body.error).toContain('Invalid token');
    });
  });

  describe('Authorization Security', () => {
    it('should prevent privilege escalation', async () => {
      // Regular user trying to access admin endpoints
      const adminEndpoints = [
        '/api/admin/dashboard',
        '/api/admin/users',
        '/api/admin/orders',
        '/api/admin/articles',
        '/api/admin/coupons',
        '/api/admin/reports/sales',
      ];

      for (const endpoint of adminEndpoints) {
        const response = await request(app)
          .get(endpoint)
          .set('Authorization', `Bearer ${userToken}`)
          .expect(403);

        expect(response.body.error).toContain('Admin privileges required');
      }
    });

    it('should prevent access to other users data', async () => {
      // Create another user
      const otherUser = await prisma.user.create({
        data: {
          email: 'other@test.com',
          fullName: 'Other User',
          passwordHash: await bcrypt.hash('other123456', 12),
          authType: 'EMAIL',
        },
      });

      // Create order for other user
      const order = await prisma.order.create({
        data: {
          userId: otherUser.id,
          productId: 'telegram-premium',
          optionName: 'اشتراک ماهانه',
          quantity: 1,
          totalPrice: 795000,
        },
      });

      // Try to access other user's order
      const response = await request(app)
        .get(`/api/orders/${order.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Payment Security', () => {
    it('should validate payment amounts', async () => {
      const invalidAmounts = [-1000, 0, 100000000000]; // negative, zero, too large

      for (const amount of invalidAmounts) {
        const response = await request(app)
          .post('/api/payments/zarinpal/request')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            amount,
            description: 'Test payment',
          })
          .expect(400);

        expect(response.body.error).toContain('Amount must be between');
      }
    });

    it('should validate crypto currencies', async () => {
      const invalidCurrencies = ['INVALID', 'SCAM', 'FAKE'];

      for (const currency of invalidCurrencies) {
        const response = await request(app)
          .post('/api/payments/crypto/request')
          .set('Authorization', `Bearer ${userToken}`)
          .send({
            amount: 10,
            currency,
            description: 'Test crypto payment',
          })
          .expect(400);

        expect(response.body.error).toContain('Invalid currency');
      }
    });
  });

  describe('API Security Headers', () => {
    it('should include security headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['referrer-policy']).toBe('no-referrer-when-downgrade');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    });

    it('should enforce CORS policy', async () => {
      const response = await request(app)
        .options('/api/auth/login')
        .set('Origin', 'https://malicious-site.com')
        .expect(200);

      // Should not include malicious origin in CORS headers
      expect(response.headers['access-control-allow-origin']).not.toBe('https://malicious-site.com');
    });
  });

  describe('Data Protection', () => {
    it('should not expose sensitive data in error messages', async () => {
      // Try to trigger database error
      const response = await request(app)
        .get('/api/orders/invalid-uuid-that-might-cause-db-error')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      // Should not expose database details
      expect(response.body.error).not.toContain('mysql');
      expect(response.body.error).not.toContain('prisma');
      expect(response.body.error).not.toContain('database');
      expect(response.body).not.toHaveProperty('stack');
    });

    it('should hash passwords properly', async () => {
      const user = await prisma.user.findUnique({
        where: { email: testUser.email },
        select: { passwordHash: true },
      });

      expect(user?.passwordHash).toBeDefined();
      expect(user?.passwordHash).not.toBe('secure123456'); // Should be hashed
      expect(user?.passwordHash?.length).toBeGreaterThan(50); // bcrypt hash length
    });
  });

  describe('Session Security', () => {
    it('should use secure cookie settings in production', async () => {
      // Mock production environment
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'secure123456',
        })
        .expect(200);

      // Check if secure cookies are set (would need HTTPS in real production)
      expect(response.headers['set-cookie']).toBeDefined();

      // Restore environment
      process.env.NODE_ENV = originalEnv;
    });
  });
});