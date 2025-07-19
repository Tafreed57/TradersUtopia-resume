import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

export const customerSubscriptionDeleted = async (event: any) => {
  console.log('customerSubscriptionDeleted', event);
  // Handle subscription deletion
  const cancelledSubscription = event.data.object as Stripe.Subscription;
  const cancelledCustomerId = cancelledSubscription.customer as string;

  console.log(`❌ Subscription cancelled: ${cancelledSubscription.id}`);

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

    console.log(
      `✅ Successfully cancelled subscription for customer: ${cancelledCustomerId}`
    );
    console.log(`⚡ [WEBHOOK-OPTIMIZED] Cancellation processed efficiently`);
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    return NextResponse.json({ error: 'Cancellation failed' }, { status: 500 });
  }
};
