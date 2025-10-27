import { Request, Response } from 'express';
import { prisma } from '@/config/database';
import { logger } from '@/utils/logger';
import { AppError } from '@/utils/AppError';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    fullName: string;
    isAdmin: boolean;
    authType: string;
  };
}

export class SubscriptionController {
  /**
   * List user subscriptions
   */
  static async list(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError('User not authenticated', 401);
      }

      const subscriptions = await prisma.subscription.findMany({
        where: { userId },
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

      logger.info('User subscriptions retrieved', { userId, count: subscriptions.length });
      res.json({
        success: true,
        data: subscriptions,
      });
    } catch (error) {
      logger.error('Failed to list subscriptions:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
        });
      }
    }
  }

  /**
   * Create new subscription
   */
  static async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new AppError('User not authenticated', 401);
      }

      const { type, duration } = req.body;

      if (!type || !duration) {
        throw new AppError('Type and duration are required', 400);
      }

      // Validate subscription type
      const validTypes = ['basic', 'premium', 'enterprise'];
      if (!validTypes.includes(type)) {
        throw new AppError('Invalid subscription type', 400);
      }

      // Validate duration (in days)
      if (typeof duration !== 'number' || duration < 1 || duration > 365) {
        throw new AppError('Duration must be between 1 and 365 days', 400);
      }

      const startAt = new Date();
      const endAt = new Date(startAt.getTime() + duration * 24 * 60 * 60 * 1000);

      const subscription = await prisma.subscription.create({
        data: {
          userId,
          type,
          status: 'active',
          startAt,
          endAt,
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

      logger.info('Subscription created', { userId, subscriptionId: subscription.id, type });
      res.status(201).json({
        success: true,
        data: subscription,
      });
    } catch (error) {
      logger.error('Failed to create subscription:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
        });
      }
    }
  }

  /**
   * Renew subscription
   */
  static async renew(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { id } = req.params;
      const { duration } = req.body;

      if (!userId) {
        throw new AppError('User not authenticated', 401);
      }

      if (!duration || typeof duration !== 'number' || duration < 1 || duration > 365) {
        throw new AppError('Duration must be between 1 and 365 days', 400);
      }

      const subscription = await prisma.subscription.findFirst({
        where: { id, userId },
      });

      if (!subscription) {
        throw new AppError('Subscription not found', 404);
      }

      if (subscription.status === 'cancelled') {
        throw new AppError('Cannot renew cancelled subscription', 400);
      }

      const newEndAt = new Date(subscription.endAt.getTime() + duration * 24 * 60 * 60 * 1000);

      const updatedSubscription = await prisma.subscription.update({
        where: { id },
        data: {
          endAt: newEndAt,
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

      logger.info('Subscription renewed', { userId, subscriptionId: id, duration });
      res.json({
        success: true,
        data: updatedSubscription,
      });
    } catch (error) {
      logger.error('Failed to renew subscription:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
        });
      }
    }
  }

  /**
   * Cancel subscription
   */
  static async cancel(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { id } = req.params;

      if (!userId) {
        throw new AppError('User not authenticated', 401);
      }

      const subscription = await prisma.subscription.findFirst({
        where: { id, userId },
      });

      if (!subscription) {
        throw new AppError('Subscription not found', 404);
      }

      if (subscription.status === 'cancelled') {
        throw new AppError('Subscription is already cancelled', 400);
      }

      const updatedSubscription = await prisma.subscription.update({
        where: { id },
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

      logger.info('Subscription cancelled', { userId, subscriptionId: id });
      res.json({
        success: true,
        data: updatedSubscription,
      });
    } catch (error) {
      logger.error('Failed to cancel subscription:', error);
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
        });
      }
    }
  }
}
