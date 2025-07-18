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
      trackSuspiciousActivity(request, 'FIX_AMOUNT_RATE_LIMIT_EXCEEDED');
      return rateLimitResult.error;
    }

    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(
      `⚡ [FIX-AMOUNT-OPTIMIZED] Processing amount fix for user: ${user.id}`
    );

    // Get user profile with webhook-cached data
    const profile = await db.profile.findFirst({
      where: { userId: user.id },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // ✅ OPTIMIZED: Validate webhook data completeness first
    if (!profile.discountPercent || !profile.originalAmount) {
      console.log(
        `⚠️ [FIX-AMOUNT-OPTIMIZED] Missing webhook data, may need Stripe fallback`
      );
    }

    // ✅ OPTIMIZED: Calculate expected amount using webhook data if available
    if (
      profile.originalAmount &&
      profile.discountPercent &&
      profile.discountPercent > 0
    ) {
      const calculatedActualAmount = Math.round(
        profile.originalAmount * (1 - profile.discountPercent / 100)
      );

      console.log(`💰 [FIX-AMOUNT-OPTIMIZED] Calculated from webhook data:`, {
        originalAmount: `$${(profile.originalAmount / 100).toFixed(2)}`,
        discountPercent: `${profile.discountPercent}%`,
        calculatedAmount: `$${(calculatedActualAmount / 100).toFixed(2)}`,
        currentStoredAmount: profile.subscriptionAmount
          ? `$${(profile.subscriptionAmount / 100).toFixed(2)}`
          : 'null',
        needsUpdate: profile.subscriptionAmount !== calculatedActualAmount,
      });

      // Check if amount is already correct
      if (profile.subscriptionAmount === calculatedActualAmount) {
        return NextResponse.json({
          success: true,
          message: 'Subscription amount is already correct',
          noUpdateNeeded: true,
          currentData: {
            chargedAmount: calculatedActualAmount,
            originalPrice: profile.originalAmount,
            discountPercent: profile.discountPercent,
            dataSource: 'webhook_cached',
          },
          performance: {
            optimized: true,
            stripeApiCalls: 0,
            usedWebhookCache: true,
          },
        });
      }

      // ✅ OPTIMIZED: Update with webhook-calculated amount
      try {
        await db.profile.update({
          where: { id: profile.id },
          data: {
            subscriptionAmount: calculatedActualAmount,
            lastWebhookUpdate: new Date(),
            updatedAt: new Date(),
          },
        });

        console.log(
          `✅ [FIX-AMOUNT-OPTIMIZED] Fixed amount using webhook data`
        );

        return NextResponse.json({
          success: true,
          message: 'Subscription amount fixed using cached data',
          fixedData: {
            oldAmount: profile.subscriptionAmount,
            newAmount: calculatedActualAmount,
            originalPrice: profile.originalAmount,
            discountPercent: profile.discountPercent,
            actualChargedDisplay: `$${(calculatedActualAmount / 100).toFixed(2)}`,
            originalPriceDisplay: `$${(profile.originalAmount / 100).toFixed(2)}`,
            discountSavings: `$${((profile.originalAmount - calculatedActualAmount) / 100).toFixed(2)}`,
            dataSource: 'webhook_cached',
          },
          performance: {
            optimized: true,
            stripeApiCalls: 0,
            usedWebhookCache: true,
          },
        });
      } catch (dbError) {
        console.error(
          '❌ [FIX-AMOUNT-OPTIMIZED] Database update failed:',
          dbError
        );
        return NextResponse.json(
          { error: 'Failed to update subscription amount' },
          { status: 500 }
        );
      }
    }

    // ✅ FALLBACK: Use Stripe API only if webhook data is insufficient
    if (!profile.stripeSubscriptionId) {
      console.log('❌ [FIX-AMOUNT-OPTIMIZED] No cached subscription ID found');
      return NextResponse.json(
        { error: 'No subscription found in system' },
        { status: 400 }
      );
    }

    console.log(
      `🔄 [FIX-AMOUNT-OPTIMIZED] Webhook data insufficient, fetching pricing from Stripe`
    );

    // ✅ OPTIMIZED: Direct subscription lookup using cached ID with minimal data expansion
    let subscription;
    try {
      subscription = await stripe.subscriptions.retrieve(
        profile.stripeSubscriptionId,
        {
          expand: ['items.data.price'], // Only expand pricing data we need
        }
      );
    } catch (stripeError) {
      console.error(
        '❌ [FIX-AMOUNT-OPTIMIZED] Stripe lookup failed:',
        stripeError
      );
      return NextResponse.json(
        { error: 'Failed to access subscription data' },
        { status: 503 }
      );
    }

    const price = subscription.items.data[0]?.price;
    if (!price?.unit_amount) {
      return NextResponse.json(
        { error: 'No price information found' },
        { status: 400 }
      );
    }

    const originalPrice = price.unit_amount;
    const discountPercent = profile.discountPercent || 0;

    // Calculate what the customer actually pays (post-discount)
    const actualChargedAmount =
      discountPercent > 0
        ? Math.round(originalPrice * (1 - discountPercent / 100))
        : originalPrice;

    console.log(`🎯 [FIX-AMOUNT-OPTIMIZED] Stripe pricing breakdown:`, {
      stripeOriginalPrice: `$${(originalPrice / 100).toFixed(2)}`,
      discountPercent: `${discountPercent}%`,
      calculatedChargedAmount: `$${(actualChargedAmount / 100).toFixed(2)}`,
      currentDatabaseAmount: profile.subscriptionAmount
        ? `$${(profile.subscriptionAmount / 100).toFixed(2)}`
        : 'null',
      needsUpdate: profile.subscriptionAmount !== actualChargedAmount,
    });

    // Check if amount is already correct
    if (profile.subscriptionAmount === actualChargedAmount) {
      return NextResponse.json({
        success: true,
        message: 'Subscription amount is already correct',
        noUpdateNeeded: true,
        currentData: {
          chargedAmount: actualChargedAmount,
          originalPrice: originalPrice,
          discountPercent: discountPercent,
          dataSource: 'stripe_direct_lookup',
        },
        performance: {
          optimized: true,
          stripeApiCalls: 1, // Down from 2+ calls
          fallbackRequired: true,
        },
      });
    }

    // Update the database with the correct charged amount
    try {
      await db.profile.update({
        where: { id: profile.id },
        data: {
          subscriptionAmount: actualChargedAmount,
          originalAmount: originalPrice, // Store for future webhook optimization
          lastWebhookUpdate: new Date(),
          updatedAt: new Date(),
        },
      });

      console.log(
        `✅ [FIX-AMOUNT-OPTIMIZED] Updated subscription amount from Stripe data`
      );

      return NextResponse.json({
        success: true,
        message: 'Subscription amount fixed successfully',
        fixedData: {
          oldAmount: profile.subscriptionAmount,
          newAmount: actualChargedAmount,
          originalPrice: originalPrice,
          discountPercent: discountPercent,
          actualChargedDisplay: `$${(actualChargedAmount / 100).toFixed(2)}`,
          originalPriceDisplay: `$${(originalPrice / 100).toFixed(2)}`,
          discountSavings: `$${((originalPrice - actualChargedAmount) / 100).toFixed(2)}`,
          dataSource: 'stripe_direct_lookup',
        },
        performance: {
          optimized: true,
          stripeApiCalls: 1, // Down from 2+ calls
          cacheUpdated: true,
        },
      });
    } catch (dbError) {
      console.error(
        '❌ [FIX-AMOUNT-OPTIMIZED] Database update failed:',
        dbError
      );
      return NextResponse.json(
        { error: 'Failed to update subscription amount' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('❌ [FIX-AMOUNT-OPTIMIZED] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fix subscription amount',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
