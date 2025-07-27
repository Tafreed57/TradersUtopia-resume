import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { apiLogger } from '@/lib/enhanced-logger';

export const customerSubscriptionDeleted = async (event: any) => {
  const cancelledSubscription = event.data.object as Stripe.Subscription;
  const cancelledCustomerId = cancelledSubscription.customer as string;

  apiLogger.subscriptionEvent('subscription_cancelled', {
    subscriptionId: cancelledSubscription.id,
    customerId: cancelledCustomerId,
  });

  try {
    const cancelledSubscriptionWithPeriods = cancelledSubscription as any;
    await db.profile.updateMany({
      where: { stripeCustomerId: cancelledCustomerId },
      data: {
        subscriptionStatus: 'CANCELLED',
        subscriptionEnd: new Date(
          cancelledSubscriptionWithPeriods.current_period_end * 1000
        ),
      },
    });

    apiLogger.databaseOperation('subscription_cancellation', true, {
      subscriptionId: cancelledSubscription.id,
      customerId: cancelledCustomerId,
    });
  } catch (error) {
    apiLogger.databaseOperation('subscription_cancellation', false, {
      subscriptionId: cancelledSubscription.id,
      customerId: cancelledCustomerId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json({ error: 'Cancellation failed' }, { status: 500 });
  }
};
