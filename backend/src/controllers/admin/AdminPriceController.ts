import { Response } from 'express';
import { AuthenticatedRequest } from '@/middleware/auth';
import { logger, logAdminAction } from '@/utils/logger';
import { AppError } from '@/utils/AppError';
import { PriceUpdateService } from '@/services/PriceUpdateService';

export class AdminPriceController {
  private priceUpdateService = new PriceUpdateService();

  /**
   * Get current prices
   */
  public getCurrentPrices = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const adminId = req.user!.id;

    try {
      const prices = await this.priceUpdateService.getCurrentPrices();
      const serviceStatus = this.priceUpdateService.getStatus();

      logAdminAction(adminId, 'view_current_prices', {
        ip: req.ip,
      });

      res.json({
        success: true,
        prices,
        serviceStatus,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error getting current prices for admin', {
        adminId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new AppError('Failed to get current prices', 503);
    }
  };

  /**
   * Manual price update
   */
  public updatePrices = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const adminId = req.user!.id;

    try {
      logger.info('Manual price update requested by admin', { adminId });

      const result = await this.priceUpdateService.manualUpdate();

      logAdminAction(adminId, 'manual_price_update', {
        success: result.success,
        prices: result.prices,
        error: result.error,
        ip: req.ip,
      });

      if (result.success) {
        res.json({
          success: true,
          message: 'Prices updated successfully',
          prices: result.prices,
          timestamp: new Date().toISOString(),
        });
      } else {
        res.status(503).json({
          success: false,
          message: 'Failed to update prices',
          error: result.error,
        });
      }
    } catch (error) {
      logger.error('Manual price update failed', {
        adminId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new AppError('Failed to update prices', 503);
    }
  };

  /**
   * Get price history
   */
  public getPriceHistory = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const adminId = req.user!.id;
    const { currency } = req.params;
    const { days = 7 } = req.query;

    const validCurrencies = ['USDT', 'BTC', 'ETH', 'TON'];
    if (!validCurrencies.includes(currency.toUpperCase())) {
      throw new AppError('Invalid currency', 400);
    }

    try {
      const history = await this.priceUpdateService.getPriceHistory(
        currency.toUpperCase(),
        Number(days)
      );

      logAdminAction(adminId, 'view_price_history', {
        currency: currency.toUpperCase(),
        days: Number(days),
        ip: req.ip,
      });

      res.json({
        success: true,
        currency: currency.toUpperCase(),
        history,
        period: {
          days: Number(days),
          from: new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000),
          to: new Date(),
        },
      });
    } catch (error) {
      logger.error(`Error getting price history for ${currency}`, {
        adminId,
        currency,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new AppError('Failed to get price history', 503);
    }
  };

  /**
   * Get price update service status
   */
  public getServiceStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const adminId = req.user!.id;

    try {
      const status = this.priceUpdateService.getStatus();

      logAdminAction(adminId, 'view_price_service_status', {
        ip: req.ip,
      });

      res.json({
        success: true,
        serviceStatus: status,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error getting price service status', {
        adminId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  };

  /**
   * Restart price update service
   */
  public restartService = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const adminId = req.user!.id;

    try {
      // Reset failure count
      this.priceUpdateService.resetFailures();

      // Restart service
      this.priceUpdateService.stop();
      this.priceUpdateService.start();

      logAdminAction(adminId, 'restart_price_service', {
        ip: req.ip,
      });

      logger.info('Price update service restarted by admin', { adminId });

      res.json({
        success: true,
        message: 'Price update service restarted successfully',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error restarting price service', {
        adminId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new AppError('Failed to restart price service', 503);
    }
  };
}