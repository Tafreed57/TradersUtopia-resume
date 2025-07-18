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
      `🔄 [FORCE-SYNC-DISCOUNT] Starting discount sync for user: ${user.id}`
    );

    // Get user profile
    const profile = await db.profile.findFirst({
      where: { userId: user.id },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    if (!profile.stripeCustomerId) {
      return NextResponse.json(
        { error: 'No Stripe customer found' },
        { status: 400 }
      );
    }

    console.log(
      `🔍 [FORCE-SYNC-DISCOUNT] Found profile for ${profile.email}, Stripe customer: ${profile.stripeCustomerId}`
    );

    // Get current subscriptions from Stripe with expanded data
    const subscriptions = await stripe.subscriptions.list({
      customer: profile.stripeCustomerId,
      status: 'all',
      limit: 10,
      expand: ['data.discounts', 'data.discounts.coupon'], // Expand discount data
    });

    console.log(
      `📊 [FORCE-SYNC-DISCOUNT] Found ${subscriptions.data.length} total subscriptions`
    );

    if (subscriptions.data.length === 0) {
      return NextResponse.json(
        { error: 'No subscriptions found in Stripe' },
        { status: 400 }
      );
    }

    // Log detailed subscription and discount information
    subscriptions.data.forEach((sub, index) => {
      console.log(`🔍 [FORCE-SYNC-DISCOUNT] Subscription ${index + 1}:`, {
        id: sub.id,
        status: sub.status,
        created: new Date(sub.created * 1000).toISOString(),
        hasDiscount: !!(sub.discounts && sub.discounts.length > 0),
        discounts: sub.discounts,
        discountCount: sub.discounts?.length || 0,
      });
    });

    // Find the best subscription (active first, then by stripeSubscriptionId match, then most recent)
    let targetSubscription = null;

    // First try: Active subscription matching our stored stripeSubscriptionId
    if (profile.stripeSubscriptionId) {
      targetSubscription = subscriptions.data.find(
        sub =>
          sub.id === profile.stripeSubscriptionId &&
          ['active', 'trialing'].includes(sub.status)
      );
    }

    // Second try: Any active subscription
    if (!targetSubscription) {
      targetSubscription = subscriptions.data.find(sub =>
        ['active', 'trialing'].includes(sub.status)
      );
    }

    // Third try: Subscription matching our stored stripeSubscriptionId (any status)
    if (!targetSubscription && profile.stripeSubscriptionId) {
      targetSubscription = subscriptions.data.find(
        sub => sub.id === profile.stripeSubscriptionId
      );
    }

    // Final try: Most recent subscription
    if (!targetSubscription) {
      targetSubscription = subscriptions.data[0];
    }

    if (!targetSubscription) {
      return NextResponse.json(
        { error: 'No suitable subscription found' },
        { status: 400 }
      );
    }

    console.log(
      `🎯 [FORCE-SYNC-DISCOUNT] Selected subscription: ${targetSubscription.id} (status: ${targetSubscription.status})`
    );

    // Extract discount information with comprehensive debugging
    let discountPercent = null;
    let discountName = null;
    let discountSource = 'none';

    // Check new discounts array format first
    if (
      targetSubscription.discounts &&
      targetSubscription.discounts.length > 0
    ) {
      const activeDiscount = targetSubscription.discounts[0];
      // Type guard: check if activeDiscount is a Discount object and not a string
      if (typeof activeDiscount === 'object' && activeDiscount?.coupon) {
        discountPercent = activeDiscount.coupon.percent_off;
        discountName = activeDiscount.coupon.name;
        discountSource = 'discounts_array';
        console.log(
          `✅ [FORCE-SYNC-DISCOUNT] Found discount in discounts array:`,
          {
            discountId: activeDiscount.id,
            couponId: activeDiscount.coupon.id,
            percentOff: activeDiscount.coupon.percent_off,
            name: activeDiscount.coupon.name,
            duration: activeDiscount.coupon.duration,
            valid: activeDiscount.coupon.valid,
          }
        );
      }
    }

    // Check legacy discount format
    if (!discountPercent && (targetSubscription as any).discount?.coupon) {
      const legacyDiscount = (targetSubscription as any).discount;
      discountPercent = legacyDiscount.coupon.percent_off;
      discountName = legacyDiscount.coupon.name;
      discountSource = 'legacy_discount';
      console.log(`✅ [FORCE-SYNC-DISCOUNT] Found discount in legacy format:`, {
        discountId: legacyDiscount.id,
        couponId: legacyDiscount.coupon.id,
        percentOff: legacyDiscount.coupon.percent_off,
        name: legacyDiscount.coupon.name,
        duration: legacyDiscount.coupon.duration,
        valid: legacyDiscount.coupon.valid,
      });
    }

    if (!discountPercent) {
      console.log(
        `⚠️ [FORCE-SYNC-DISCOUNT] No discount found on subscription ${targetSubscription.id}`
      );
      console.log(`📋 [FORCE-SYNC-DISCOUNT] Raw discount data:`, {
        discounts: targetSubscription.discounts,
        discount: (targetSubscription as any).discount,
        hasDiscounts: !!(
          targetSubscription.discounts &&
          targetSubscription.discounts.length > 0
        ),
        hasLegacyDiscount: !!(targetSubscription as any).discount,
      });

      return NextResponse.json({
        success: true,
        message: 'No active discount found on subscription',
        debugInfo: {
          subscriptionId: targetSubscription.id,
          subscriptionStatus: targetSubscription.status,
          hasDiscounts: !!(
            targetSubscription.discounts &&
            targetSubscription.discounts.length > 0
          ),
          hasLegacyDiscount: !!(targetSubscription as any).discount,
          discountsData: targetSubscription.discounts,
          legacyDiscountData: (targetSubscription as any).discount,
          allSubscriptions: subscriptions.data.map(sub => ({
            id: sub.id,
            status: sub.status,
            hasDiscounts: !!(sub.discounts && sub.discounts.length > 0),
            hasLegacyDiscount: !!(sub as any).discount,
          })),
        },
      });
    }

    // Update the database with discount information
    const updatedProfile = await db.profile.update({
      where: { id: profile.id },
      data: {
        discountPercent,
        discountName,
        lastWebhookUpdate: new Date(),
        updatedAt: new Date(),
      },
    });

    console.log(
      `✅ [FORCE-SYNC-DISCOUNT] Updated database with discount info for user: ${profile.email}`
    );

    return NextResponse.json({
      success: true,
      message: 'Discount data synced successfully',
      syncedData: {
        subscriptionId: targetSubscription.id,
        discountPercent,
        discountName,
        discountSource,
        hasDiscount: !!discountPercent,
        dataSource: 'stripe_force_sync',
      },
    });
  } catch (error) {
    console.error('❌ [FORCE-SYNC-DISCOUNT] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to sync discount data',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
