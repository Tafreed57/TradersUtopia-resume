import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { updateSubscriptionInDatabase } from '../utils';
import { apiLogger } from '@/lib/enhanced-logger';

export const customerSubscriptionUpdated = async (event: any) => {
  const updatedSubscription = event.data.object as Stripe.Subscription;

  apiLogger.subscriptionEvent('subscription_updated', {
    subscriptionId: updatedSubscription.id,
    customerId: updatedSubscription.customer as string,
    status: updatedSubscription.status,
  });

  try {
    await updateSubscriptionInDatabase(updatedSubscription);
    apiLogger.databaseOperation('subscription_update', true, {
      subscriptionId: updatedSubscription.id,
      customerId: updatedSubscription.customer as string,
    });
    return NextResponse.json({ received: true });
  } catch (error) {
    apiLogger.databaseOperation('subscription_update', false, {
      subscriptionId: updatedSubscription.id,
      customerId: updatedSubscription.customer as string,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: 'Subscription update failed' },
      { status: 500 }
    );
  }
};
