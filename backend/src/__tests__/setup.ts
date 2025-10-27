import type { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import { join } from 'path';

let prisma: PrismaClient | null = null;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'mysql://test:test@localhost:3306/psygstore_test';

  const { PrismaClient } = await import('@prisma/client');
  prisma = new PrismaClient();

  try {
    execSync('npx prisma db push --force-reset', {
      cwd: join(__dirname, '../../'),
      stdio: 'inherit',
      env: { ...process.env },
    });
  } catch (error) {
    console.error('Failed to reset test database:', error);
    throw error;
  }
});

afterAll(async () => {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
});

beforeEach(async () => {
  if (!prisma) {
    const { PrismaClient } = await import('@prisma/client');
    prisma = new PrismaClient();
  }

  await prisma.adminLog.deleteMany();
  await prisma.couponUsage.deleteMany();
  await prisma.coupon.deleteMany();
  await prisma.cryptoPaymentRequest.deleteMany();
  await prisma.paymentRequest.deleteMany();
  await prisma.order.deleteMany();
  await prisma.article.deleteMany();
  await prisma.user.deleteMany();
  await prisma.cryptoPrice.deleteMany();
  await prisma.priceHistory.deleteMany();
});

export { prisma };
