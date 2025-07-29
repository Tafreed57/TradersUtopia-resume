import { SubscriptionSyncService } from '@/services/subscription-sync-service';
import Stripe from 'stripe';

export async function processSubscriptionChange(
  subscription: Stripe.Subscription
) {
  const subscriptionSyncService = new SubscriptionSyncService();

  try {
    await subscriptionSyncService.createOrUpdateSubscription(subscription);
    await subscriptionSyncService.updateUserAccess(
      subscription.customer as string
    );
  } catch (error) {
    throw error;
  }
}
