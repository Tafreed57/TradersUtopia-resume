import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { apiLogger } from '@/lib/enhanced-logger';
import { SubscriptionSyncService } from '@/services/subscription-sync-service';

export const customerSubscriptionDeleted = async (event: any) => {
  const cancelledSubscription = event.data.object as Stripe.Subscription;
  const cancelledCustomerId = cancelledSubscription.customer as string;

  apiLogger.subscriptionEvent('subscription_cancelled', {
    subscriptionId: cancelledSubscription.id,
    customerId: cancelledCustomerId,
  });

  try {
    // Initialize subscription sync service
    const subscriptionSyncService = new SubscriptionSyncService();

    // Handle subscription cancellation using centralized service
    await subscriptionSyncService.handleSubscriptionCancellation(
      cancelledSubscription
    );

    // Update user access to revoke premium permissions
    await subscriptionSyncService.revokeUserAccess(cancelledCustomerId);

    apiLogger.databaseOperation('subscription_cancellation', true, {
      subscriptionId: cancelledSubscription.id,
      customerId: cancelledCustomerId,
    });

    console.log(
      `✅ [WEBHOOK-OPTIMIZED] Subscription cancelled for customer: ${cancelledCustomerId}`
    );
    console.log(
      `⚡ [PERFORMANCE] Using centralized services for subscription cancellation`
    );
  } catch (error) {
    apiLogger.databaseOperation('subscription_cancellation', false, {
      subscriptionId: cancelledSubscription.id,
      customerId: cancelledCustomerId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    console.error('Error handling subscription cancellation:', error);
    return NextResponse.json({ error: 'Cancellation failed' }, { status: 500 });
  }

  return NextResponse.json({ message: 'Subscription cancelled successfully' });
};
