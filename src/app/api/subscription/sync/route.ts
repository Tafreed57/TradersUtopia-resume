import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  console.log('🔄 [SYNC] Starting subscription sync process...');

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
      `🎯 [SYNC] Syncing subscription for customer: ${profile.stripeCustomerId}`
    );

    // 🚀 WEBHOOK-OPTIMIZED: Try webhook-cached data first
    let cachedSubscription = null;
    try {
      cachedSubscription = await db.profile.findFirst({
        where: {
          stripeCustomerId: profile.stripeCustomerId,
          subscriptionStatus: { in: ['ACTIVE', 'CANCELLED'] },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (cachedSubscription) {
        console.log(
          '⚡ [SYNC-OPTIMIZED] Found webhook-cached subscription data'
        );

        // Check if webhook data is recent (within last 5 minutes)
        const cacheAge = Date.now() - cachedSubscription.updatedAt.getTime();
        const isFresh = cacheAge < 5 * 60 * 1000; // 5 minutes

        if (isFresh && cachedSubscription.subscriptionStatus === 'ACTIVE') {
          console.log(
            '⚡ [SYNC-OPTIMIZED] Using fresh webhook data, skipping Stripe API call'
          );

          // Update profile with webhook-cached data
          await db.profile.update({
            where: { id: profile.id },
            data: {
              subscriptionStart: cachedSubscription.subscriptionStart,
              subscriptionEnd: cachedSubscription.subscriptionEnd,
              stripeProductId: cachedSubscription.stripeProductId,
              updatedAt: new Date(),
            },
          });

          return NextResponse.json({
            success: true,
            message: 'Subscription synchronized with cached data',
            optimized: true,
            subscription: {
              id: cachedSubscription.stripeSubscriptionId,
              status: cachedSubscription.subscriptionStatus.toLowerCase(),
              currentPeriodStart: cachedSubscription.subscriptionStart,
              currentPeriodEnd: cachedSubscription.subscriptionEnd,
              cancelAtPeriodEnd: cachedSubscription.subscriptionCancelledAt,
            },
          });
        }
      }
    } catch (cacheError) {
      console.warn(
        '⚠️ [SYNC] Cache lookup failed, falling back to Stripe API:',
        cacheError
      );
    }

    // 🔄 FALLBACK: Get latest data from Stripe if no fresh cache
    console.log('📡 [SYNC] Cache miss or stale - fetching from Stripe API...');
    const subscriptions = await stripe.subscriptions.list({
      customer: profile.stripeCustomerId,
      limit: 10,
    });

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

    // Validate subscription has required data - check both subscription level and subscription item level
    const subscriptionItem = activeSubscription.items.data[0];

    if (!subscriptionItem) {
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

    if (!periodStart || !periodEnd) {
      return NextResponse.json(
        { error: 'Subscription missing period information' },
        { status: 400 }
      );
    }

    if (!subscriptionItem.price.product) {
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
      return NextResponse.json(
        { error: 'Invalid subscription dates from Stripe' },
        { status: 400 }
      );
    }

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

    console.log('✅ [SYNC] Successfully synced with Stripe API data');

    return NextResponse.json({
      success: true,
      message: 'Subscription synchronized with Stripe',
      optimized: false,
      subscription: {
        id: activeSubscription.id,
        status: activeSubscription.status,
        currentPeriodStart: stripeStart,
        currentPeriodEnd: stripeEnd,
        cancelAtPeriodEnd: activeSubscription.cancel_at_period_end,
      },
    });
  } catch (error) {
    console.error('❌ [SYNC] Sync failed:', error);
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
    optimization: 'Uses webhook-cached data when fresh, Stripe API as fallback',
  });
}
