#!/usr/bin/env ts-node
import axios from 'axios';
import { prisma } from '../backend/src/config/database';
import { PriceUpdateService } from '../backend/src/services/PriceUpdateService';
import '../backend/src/config/environment';

async function main() {
  const priceService = new PriceUpdateService();
  try {
    const prices = await priceService.getCurrentPrices();
    console.log('Current prices:', prices);
  } catch (error) {
    console.error('Failed to update prices', error);
    process.exit(1);
  } finally {
    await prisma.();
  }
}

main();

