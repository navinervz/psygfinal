import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../server';
import { prisma } from './setup';

describe('Authentication', () => {
  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        fullName: 'Test User',
        password: 'password123',
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.user.fullName).toBe(userData.fullName);
      expect(response.body.accessToken).toBeDefined();

      // Check if user was created in database
      const user = await prisma.user.findUnique({
        where: { email: userData.email },
      });
      expect(user).toBeTruthy();
      expect(user?.email).toBe(userData.email);
    });

    it('should not register user with existing email', async () => {
      const userData = {
        email: 'test@example.com',
        fullName: 'Test User',
        password: 'password123',
      };

      // Create user first
      await prisma.user.create({
        data: {
          email: userData.email,
          fullName: userData.fullName,
          passwordHash: await bcrypt.hash(userData.password, 12),
          authType: 'EMAIL',
        },
      });

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('already exists');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          fullName: '',
          password: '123', // Too short
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Validation failed');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Create test user
      await prisma.user.create({
        data: {
          email: 'test@example.com',
          fullName: 'Test User',
          passwordHash: await bcrypt.hash('password123', 12),
          authType: 'EMAIL',
          emailVerified: true,
        },
      });
    });

    it('should login user with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.user.email).toBe('test@example.com');
      expect(response.body.accessToken).toBeDefined();
    });

    it('should not login with invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid credentials');
    });

    it('should not login inactive user', async () => {
      // Deactivate user
      await prisma.user.update({
        where: { email: 'test@example.com' },
        data: { isActive: false },
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123',
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('deactivated');
    });
  });

  describe('POST /api/auth/web3-login', () => {
    it('should create new user for valid wallet address', async () => {
      const walletAddress = '0x742d35Cc6634C0532925a3b8D4C2C4e0C8b83265';

      const response = await request(app)
        .post('/api/auth/web3-login')
        .send({ walletAddress })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.user.walletAddress).toBe(walletAddress);
      expect(response.body.user.authType).toBe('WEB3');
      expect(response.body.accessToken).toBeDefined();

      // Check if user was created
      const user = await prisma.user.findUnique({
        where: { walletAddress },
      });
      expect(user).toBeTruthy();
    });

    it('should login existing Web3 user', async () => {
      const walletAddress = '0x742d35Cc6634C0532925a3b8D4C2C4e0C8b83265';

      // Create user first
      await prisma.user.create({
        data: {
          fullName: 'Web3 User',
          walletAddress,
          authType: 'WEB3',
        },
      });

      const response = await request(app)
        .post('/api/auth/web3-login')
        .send({ walletAddress })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.user.walletAddress).toBe(walletAddress);
    });

    it('should reject invalid wallet address', async () => {
      const response = await request(app)
        .post('/api/auth/web3-login')
        .send({ walletAddress: 'invalid-address' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid wallet address');
    });
  });
});



