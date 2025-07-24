import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import Stripe from 'stripe';
import { db } from '@/lib/db';
import { rateLimitGeneral } from '@/lib/rate-limit';
import { trackSuspiciousActivity } from '@/lib/rate-limit';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: NextRequest) {
  try {
    // ✅ SECURITY: Add rate limiting
    const rateLimitResult = await rateLimitGeneral()(request);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(
        request,
        'FORCE_SYNC_DISCOUNT_RATE_LIMIT_EXCEEDED'
      );
      return rateLimitResult.error;
    }

    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(
      `⚡ [FORCE-SYNC-DISCOUNT-OPTIMIZED] Processing discount sync for user: ${user.id}`
    );

    // Get user profile with webhook-cached data
    const profile = await db.profile.findFirst({
      where: { userId: user.id },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // ✅ OPTIMIZED: Check if webhook data already has discount information
    if (profile.discountPercent && profile.discountPercent > 0) {
      console.log(
        `✅ [FORCE-SYNC-DISCOUNT-OPTIMIZED] Discount already synced from webhook: ${profile.discountPercent}%`
      );

      return NextResponse.json({
        success: true,
        message: 'Discount information already synchronized',
        syncedData: {
          hasDiscount: true,
          discountPercent: profile.discountPercent,
          discountName: profile.discountName || 'Applied Discount',
          dataSource: 'webhook_cached',
        },
        performance: {
          optimized: true,
          stripeApiCalls: 0,
          usedWebhookCache: true,
        },
      });
    }

    // ✅ FALLBACK: Only fetch from Stripe if webhook data is missing discount info
    if (!profile.stripeSubscriptionId) {
      console.log(
        '❌ [FORCE-SYNC-DISCOUNT-OPTIMIZED] No cached subscription ID found'
      );
      return NextResponse.json(
        { error: 'No subscription found in system' },
        { status: 400 }
      );
    }

    console.log(
      `🔄 [FORCE-SYNC-DISCOUNT-OPTIMIZED] Webhook data missing discount info, fetching from Stripe for subscription: ${profile.stripeSubscriptionId}`
    );

    // ✅ OPTIMIZED: Direct subscription lookup using cached ID instead of customer search
    let targetSubscription;
    try {
      targetSubscription = await stripe.subscriptions.retrieve(
        profile.stripeSubscriptionId,
        {
          expand: ['discounts', 'discounts.coupon'], // Only expand what we need
        }
      );

      console.log(
        `⚡ [FORCE-SYNC-DISCOUNT-OPTIMIZED] Retrieved subscription directly using cached ID`
      );
    } catch (stripeError) {
      console.error(
        '❌ [FORCE-SYNC-DISCOUNT-OPTIMIZED] Failed to retrieve subscription:',
        stripeError
      );
      return NextResponse.json(
        { error: 'Failed to access subscription data' },
        { status: 503 }
      );
    }

    // Extract discount information
    let discountPercent = null;
    let discountName = null;

    // Handle both new discounts array format and legacy discount format
    const activeDiscount =
      targetSubscription.discounts && targetSubscription.discounts.length > 0
        ? targetSubscription.discounts[0] // New format
        : (targetSubscription as any).discount; // Legacy format

    if (activeDiscount?.coupon) {
      discountPercent = activeDiscount.coupon.percent_off;
      discountName = activeDiscount.coupon.name || `${discountPercent}% Off`;

      console.log(
        `💰 [FORCE-SYNC-DISCOUNT-OPTIMIZED] Found discount: ${discountPercent}% (${discountName})`
      );
    }

    if (!discountPercent) {
      console.log(
        `⚠️ [FORCE-SYNC-DISCOUNT-OPTIMIZED] No discount found on subscription ${targetSubscription.id}`
      );

      return NextResponse.json({
        success: true,
        message: 'No active discount found on subscription',
        syncedData: {
          hasDiscount: false,
          subscriptionId: targetSubscription.id,
          subscriptionStatus: targetSubscription.status,
          dataSource: 'stripe_direct_lookup',
        },
        performance: {
          optimized: true,
          stripeApiCalls: 1, // Down from 2+ calls
          fallbackRequired: true,
        },
      });
    }

    // ✅ OPTIMIZED: Update database cache with discount information
    try {
      await db.profile.update({
        where: { id: profile.id },
        data: {
          discountPercent,
          discountName,

          updatedAt: new Date(),
        },
      });

      console.log(
        `✅ [FORCE-SYNC-DISCOUNT-OPTIMIZED] Updated database cache with discount info: ${discountPercent}%`
      );
    } catch (dbError) {
      console.error(
        '⚠️ [FORCE-SYNC-DISCOUNT-OPTIMIZED] Failed to update database cache:',
        dbError
      );
      // Don't fail the request if cache update fails
    }

    console.log(
      `✅ [FORCE-SYNC-DISCOUNT-OPTIMIZED] Discount sync completed successfully`
    );

    return NextResponse.json({
      success: true,
      message: `Discount synchronized: ${discountPercent}% off`,
      syncedData: {
        hasDiscount: true,
        discountPercent,
        discountName,
        subscriptionId: targetSubscription.id,
        dataSource: 'stripe_direct_lookup',
        cachedForFuture: true,
      },
      performance: {
        optimized: true,
        stripeApiCalls: 1, // Down from 2+ calls
        updatedCache: true,
      },
    });
  } catch (error) {
    console.error('❌ [FORCE-SYNC-DISCOUNT-OPTIMIZED] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to sync discount data',
        message:
          'Unable to synchronize discount information. Please try again later.',
      },
      { status: 500 }
    );
  }
}
