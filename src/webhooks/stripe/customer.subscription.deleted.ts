import { SubscriptionSyncService } from '@/services/subscription-sync-service';
import Stripe from 'stripe';

export async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
) {
  const subscriptionSyncService = new SubscriptionSyncService();

  try {
    await subscriptionSyncService.handleSubscriptionCancellation(subscription);
  } catch (error) {
    throw error;
  }
}
