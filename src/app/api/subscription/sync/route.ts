import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import Stripe from 'stripe';

export async function POST(request: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-05-28.basil',
  });
  try {
    const user = await currentUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const profile = await db.profile.findFirst({
      where: { userId: user.id },
    });

    if (!profile || !profile.stripeCustomerId) {
      return NextResponse.json(
        { error: 'No Stripe customer found' },
        { status: 400 }
      );
    }

    console.log(
      `🔄 [SYNC] Syncing subscription for: ${profile.stripeCustomerId}`
    );

    // Get latest data from Stripe
    const subscriptions = await stripe.subscriptions.list({
      customer: profile.stripeCustomerId,
      limit: 10,
    });

    console.log(
      `📊 [SYNC] Found ${subscriptions.data.length} subscription(s) for customer`
    );

    const activeSubscription =
      subscriptions.data.find(
        (sub: any) =>
          sub.status === 'active' ||
          (sub.status === 'canceled' &&
            sub.current_period_end &&
            new Date(sub.current_period_end * 1000) > new Date())
      ) || subscriptions.data[0];

    if (!activeSubscription) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 404 }
      );
    }

    const activeSubscriptionWithPeriods = activeSubscription as any;
    console.log(
      `🎯 [SYNC] Using subscription: ${activeSubscription.id} (${activeSubscription.status})`
    );
    console.log(
      `🔍 [SYNC] Period start: ${activeSubscriptionWithPeriods.current_period_start} (type: ${typeof activeSubscriptionWithPeriods.current_period_start})`
    );
    console.log(
      `🔍 [SYNC] Period end: ${activeSubscriptionWithPeriods.current_period_end} (type: ${typeof activeSubscriptionWithPeriods.current_period_end})`
    );
    console.log(
      `🔍 [SYNC] Items count: ${activeSubscription.items.data.length}`
    );
    console.log(
      `🔍 [SYNC] First item product: ${activeSubscription.items.data[0]?.price.product}`
    );

    // Validate subscription has required data - check both subscription level and subscription item level
    const subscriptionItem = activeSubscription.items.data[0];

    if (!subscriptionItem) {
      console.error(
        '❌ [SYNC] No subscription items found:',
        activeSubscription.id
      );
      return NextResponse.json(
        { error: 'Subscription has no items' },
        { status: 400 }
      );
    }

    // Get period data from subscription item (this is where Stripe stores it for subscription lists)
    const subscriptionItemWithPeriods = subscriptionItem as any;
    const periodStart =
      activeSubscriptionWithPeriods.current_period_start ||
      subscriptionItemWithPeriods.current_period_start;
    const periodEnd =
      activeSubscriptionWithPeriods.current_period_end ||
      subscriptionItemWithPeriods.current_period_end;

    console.log(
      `🔍 [SYNC] Subscription level periods: start=${activeSubscriptionWithPeriods.current_period_start}, end=${activeSubscriptionWithPeriods.current_period_end}`
    );
    console.log(
      `🔍 [SYNC] Item level periods: start=${subscriptionItemWithPeriods.current_period_start}, end=${subscriptionItemWithPeriods.current_period_end}`
    );
    console.log(
      `🔍 [SYNC] Using periods: start=${periodStart}, end=${periodEnd}`
    );

    if (!periodStart || !periodEnd) {
      console.error(
        '❌ [SYNC] Subscription missing period data at both levels:',
        activeSubscription.id
      );
      return NextResponse.json(
        { error: 'Subscription missing period information' },
        { status: 400 }
      );
    }

    if (!subscriptionItem.price.product) {
      console.error(
        '❌ [SYNC] Subscription missing product data:',
        activeSubscription.id
      );
      return NextResponse.json(
        { error: 'Subscription missing product information' },
        { status: 400 }
      );
    }

    // Extract accurate dates from Stripe (using item-level data as fallback)
    const stripeStart = new Date(periodStart * 1000);
    const stripeEnd = new Date(periodEnd * 1000);
    const stripeProductId = activeSubscription.items.data[0]?.price
      .product as string;

    // Validate Stripe dates
    if (isNaN(stripeStart.getTime()) || isNaN(stripeEnd.getTime())) {
      console.error('❌ [SYNC] Invalid dates from Stripe subscription');
      return NextResponse.json(
        { error: 'Invalid subscription dates from Stripe' },
        { status: 400 }
      );
    }

    console.log(
      `📅 [SYNC] Stripe dates: ${stripeStart.toISOString()} to ${stripeEnd.toISOString()}`
    );
    console.log(
      `📅 [SYNC] Database dates: ${profile.subscriptionStart ? profile.subscriptionStart.toISOString() : 'null'} to ${profile.subscriptionEnd ? profile.subscriptionEnd.toISOString() : 'null'}`
    );

    // Update database with Stripe's accurate data
    await db.profile.update({
      where: { id: profile.id },
      data: {
        subscriptionStart: stripeStart,
        subscriptionEnd: stripeEnd,
        stripeProductId: stripeProductId,
        updatedAt: new Date(),
      },
    });

    console.log(`✅ [SYNC] Successfully synchronized subscription data`);

    return NextResponse.json({
      success: true,
      message: 'Subscription synchronized with Stripe',
      subscription: {
        id: activeSubscription.id,
        status: activeSubscription.status,
        currentPeriodStart: stripeStart,
        currentPeriodEnd: stripeEnd,
        cancelAtPeriodEnd: activeSubscription.cancel_at_period_end,
      },
    });
  } catch (error) {
    console.error('❌ [SYNC] Error:', error);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Subscription Sync Endpoint',
    description: 'Use POST to sync your subscription data with Stripe',
    usage: {
      method: 'POST',
      authentication: 'Required',
      purpose: 'Synchronize database subscription data with Stripe',
    },
  });
}
