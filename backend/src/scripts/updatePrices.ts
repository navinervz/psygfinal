#!/usr/bin/env ts-node

import { PriceUpdateService } from '@/services/PriceUpdateService';
import { logger } from '@/utils/logger';
import { connectDatabase, disconnectDatabase } from '@/config/database';

/**
 * Standalone script to update crypto prices
 * Can be run via cron job or manually
 */
async function updatePrices() {
  try {
    console.log('🚀 Starting price update...');
    
    // Connect to database
    await connectDatabase();
    
    // Create price update service
    const priceUpdateService = new PriceUpdateService();
    
    // Perform manual update
    const result = await priceUpdateService.manualUpdate();
    
    if (result.success) {
      console.log('✅ Prices updated successfully:', result.prices);
      logger.info('Scheduled price update completed', result.prices);
    } else {
      console.error('❌ Price update failed:', result.error);
      logger.error('Scheduled price update failed', { error: result.error });
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Fatal error during price update:', error);
    logger.error('Fatal error during scheduled price update', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    process.exit(1);
  } finally {
    // Disconnect from database
    await disconnectDatabase();
  }
}

// Run if called directly
if (require.main === module) {
  updatePrices();
}

export { updatePrices };