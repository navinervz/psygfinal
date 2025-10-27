import { Router } from 'express';
import { SubscriptionController } from '../controllers/SubscriptionController';
import auth from '../middleware/auth';

const router = Router();

// Apply authentication middleware to all subscription routes
router.use(auth);

// Get user subscriptions
router.get('/', SubscriptionController.list);

// Create new subscription
router.post('/', SubscriptionController.create);

// Renew subscription
router.post('/:id/renew', SubscriptionController.renew);

// Cancel subscription
router.post('/:id/cancel', SubscriptionController.cancel);

export default router;
