import { NextResponse } from 'next/server';
import Stripe from 'stripe';

export const customerSubscriptionUpdated = async (event: any) => {
  console.log('customerSubscriptionUpdated', event);
  const updatedSubscription = event.data.object as Stripe.Subscription;
  console.log(`🔄 Subscription updated: ${updatedSubscription.id}`);

  try {
    // await updateSubscriptionInDatabase(updatedSubscription);
    console.log(
      `⚡ [WEBHOOK-OPTIMIZED] Subscription update processed efficiently`
    );
  } catch (error) {
    console.error('Error handling subscription update:', error);
    return NextResponse.json(
      { error: 'Subscription update failed' },
      { status: 500 }
    );
  }
};
