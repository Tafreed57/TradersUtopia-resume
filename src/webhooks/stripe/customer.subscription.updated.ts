import { SubscriptionSyncService } from '@/services/subscription-sync-service';
import Stripe from 'stripe';

export async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription
) {
  const subscriptionSyncService = new SubscriptionSyncService();

  try {
    // Use the new unified sync method that leverages the data extraction service
    await subscriptionSyncService.syncFromStripeObject(subscription);
    await subscriptionSyncService.updateUserAccess(
      subscription.customer as string
    );
  } catch (error) {
    throw error;
  }
}
