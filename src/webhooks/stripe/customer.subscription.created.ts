import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { updateSubscriptionInDatabase } from '../utils';

export const customerSubscriptionCreated = async (event: any) => {
  console.log('customerSubscriptionCreated', event);
  // Handle new subscription creation
  const newSubscription = event.data.object as Stripe.Subscription;
  console.log(`🆕 New subscription created: ${newSubscription.id}`);

  try {
    await updateSubscriptionInDatabase(newSubscription);
    console.log(
      `⚡ [WEBHOOK-OPTIMIZED] Subscription creation processed efficiently`
    );
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error handling subscription creation:', error);
    return NextResponse.json(
      { error: 'Subscription creation failed' },
      { status: 500 }
    );
  }
};
