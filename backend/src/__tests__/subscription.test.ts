import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { SubscriptionController } from '../controllers/SubscriptionController';
import { prisma } from '../config/database';
import { AppError } from '../utils/AppError';

// Mock Prisma
jest.mock('../config/database', () => ({
  prisma: {
    subscription: {
      findMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
}));

// Mock logger
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('SubscriptionController', () => {
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  beforeEach(() => {
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    
        mockRequest = {
      user: {
        id: 'user-123',
        email: undefined,
        fullName: 'Test User',
        isAdmin: false,
        authType: 'EMAIL',
      },
      body: {},
      params: {},
    };
    
    mockResponse = {
      json: mockJson,
      status: mockStatus,
    };

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('list', () => {
    it('should return user subscriptions successfully', async () => {
      const mockSubscriptions = [
        {
          id: 'sub-1',
          type: 'basic',
          status: 'active',
          startAt: new Date(),
          endAt: new Date(),
          createdAt: new Date(),
        },
      ];

      (prisma.subscription.findMany as jest.Mock).mockResolvedValue(mockSubscriptions);

      await SubscriptionController.list(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(prisma.subscription.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          type: true,
          status: true,
          startAt: true,
          endAt: true,
          createdAt: true,
        },
      });

      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: mockSubscriptions,
      });
    });

    it('should throw error when user is not authenticated', async () => {
      mockRequest.user = undefined;

      await SubscriptionController.list(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(401);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: 'User not authenticated',
      });
    });

    it('should handle database errors', async () => {
      (prisma.subscription.findMany as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      await SubscriptionController.list(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: 'Internal server error',
      });
    });
  });

  describe('create', () => {
    it('should create subscription successfully', async () => {
      const mockSubscription = {
        id: 'sub-1',
        type: 'basic',
        status: 'active',
        startAt: new Date(),
        endAt: new Date(),
        createdAt: new Date(),
      };

      mockRequest.body = {
        type: 'basic',
        duration: 30,
      };

      (prisma.subscription.create as jest.Mock).mockResolvedValue(mockSubscription);

      await SubscriptionController.create(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(prisma.subscription.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-123',
          type: 'basic',
          status: 'active',
          startAt: expect.any(Date),
          endAt: expect.any(Date),
        },
        select: {
          id: true,
          type: true,
          status: true,
          startAt: true,
          endAt: true,
          createdAt: true,
        },
      });

      expect(mockStatus).toHaveBeenCalledWith(201);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: mockSubscription,
      });
    });

    it('should validate required fields', async () => {
      mockRequest.body = {};

      await SubscriptionController.create(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: 'Type and duration are required',
      });
    });

    it('should validate subscription type', async () => {
      mockRequest.body = {
        type: 'invalid',
        duration: 30,
      };

      await SubscriptionController.create(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid subscription type',
      });
    });

    it('should validate duration range', async () => {
      mockRequest.body = {
        type: 'basic',
        duration: 400, // Invalid duration
      };

      await SubscriptionController.create(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: 'Duration must be between 1 and 365 days',
      });
    });
  });

  describe('renew', () => {
    it('should renew subscription successfully', async () => {
      const mockSubscription = {
        id: 'sub-1',
        userId: 'user-123',
        status: 'active',
        endAt: new Date(),
      };

      const mockUpdatedSubscription = {
        id: 'sub-1',
        type: 'basic',
        status: 'active',
        startAt: new Date(),
        endAt: new Date(),
        createdAt: new Date(),
      };

      mockRequest.params = { id: 'sub-1' };
      mockRequest.body = { duration: 30 };

      (prisma.subscription.findFirst as jest.Mock).mockResolvedValue(mockSubscription);
      (prisma.subscription.update as jest.Mock).mockResolvedValue(mockUpdatedSubscription);

      await SubscriptionController.renew(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(prisma.subscription.findFirst).toHaveBeenCalledWith({
        where: { id: 'sub-1', userId: 'user-123' },
      });

      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
        data: {
          endAt: expect.any(Date),
          status: 'active',
        },
        select: {
          id: true,
          type: true,
          status: true,
          startAt: true,
          endAt: true,
          createdAt: true,
        },
      });

      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: mockUpdatedSubscription,
      });
    });

    it('should handle subscription not found', async () => {
      mockRequest.params = { id: 'sub-1' };
      mockRequest.body = { duration: 30 };

      (prisma.subscription.findFirst as jest.Mock).mockResolvedValue(null);

      await SubscriptionController.renew(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: 'Subscription not found',
      });
    });

    it('should handle cancelled subscription', async () => {
      const mockSubscription = {
        id: 'sub-1',
        userId: 'user-123',
        status: 'cancelled',
        endAt: new Date(),
      };

      mockRequest.params = { id: 'sub-1' };
      mockRequest.body = { duration: 30 };

      (prisma.subscription.findFirst as jest.Mock).mockResolvedValue(mockSubscription);

      await SubscriptionController.renew(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: 'Cannot renew cancelled subscription',
      });
    });
  });

  describe('cancel', () => {
    it('should cancel subscription successfully', async () => {
      const mockSubscription = {
        id: 'sub-1',
        userId: 'user-123',
        status: 'active',
      };

      const mockUpdatedSubscription = {
        id: 'sub-1',
        type: 'basic',
        status: 'cancelled',
        startAt: new Date(),
        endAt: new Date(),
        createdAt: new Date(),
      };

      mockRequest.params = { id: 'sub-1' };

      (prisma.subscription.findFirst as jest.Mock).mockResolvedValue(mockSubscription);
      (prisma.subscription.update as jest.Mock).mockResolvedValue(mockUpdatedSubscription);

      await SubscriptionController.cancel(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(prisma.subscription.findFirst).toHaveBeenCalledWith({
        where: { id: 'sub-1', userId: 'user-123' },
      });

      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
        data: {
          status: 'cancelled',
        },
        select: {
          id: true,
          type: true,
          status: true,
          startAt: true,
          endAt: true,
          createdAt: true,
        },
      });

      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        data: mockUpdatedSubscription,
      });
    });

    it('should handle already cancelled subscription', async () => {
      const mockSubscription = {
        id: 'sub-1',
        userId: 'user-123',
        status: 'cancelled',
      };

      mockRequest.params = { id: 'sub-1' };

      (prisma.subscription.findFirst as jest.Mock).mockResolvedValue(mockSubscription);

      await SubscriptionController.cancel(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        success: false,
        error: 'Subscription is already cancelled',
      });
    });
  });
});



