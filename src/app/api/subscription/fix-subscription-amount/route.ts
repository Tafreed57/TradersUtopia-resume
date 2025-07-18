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

    console.log(`🔧 [FIX-AMOUNT] Starting amount fix for user: ${user.id}`);

    // Get user profile
    const profile = await db.profile.findFirst({
      where: { userId: user.id },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    if (!profile.stripeCustomerId || !profile.discountPercent) {
      return NextResponse.json(
        { error: 'Missing required subscription data' },
        { status: 400 }
      );
    }

    console.log(`👤 [FIX-AMOUNT] Current profile data:`, {
      email: profile.email,
      storedAmount: profile.subscriptionAmount,
      discountPercent: profile.discountPercent,
      calculatedOriginal:
        profile.subscriptionAmount && profile.discountPercent
          ? Math.round(
              profile.subscriptionAmount / (1 - profile.discountPercent / 100)
            )
          : profile.subscriptionAmount,
    });

    // Get the subscription from Stripe to see what's actually being charged
    const subscriptions = await stripe.subscriptions.list({
      customer: profile.stripeCustomerId,
      status: 'active',
      limit: 1,
      expand: ['data.items.data.price'],
    });

    if (subscriptions.data.length === 0) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 400 }
      );
    }

    const subscription = subscriptions.data[0];
    const price = subscription.items.data[0]?.price;

    if (!price) {
      return NextResponse.json(
        { error: 'No price information found' },
        { status: 400 }
      );
    }

    const originalPrice = price.unit_amount; // This is the price before discount
    const discountPercent = profile.discountPercent;

    if (!originalPrice || !discountPercent) {
      return NextResponse.json(
        {
          error: 'Missing price or discount information',
          originalPrice,
          discountPercent,
        },
        { status: 400 }
      );
    }

    // Calculate what the customer actually pays (post-discount)
    const actualChargedAmount = Math.round(
      originalPrice * (1 - discountPercent / 100)
    );

    console.log(`🎯 [FIX-AMOUNT] Pricing breakdown:`, {
      stripeOriginalPrice: `$${(originalPrice / 100).toFixed(2)}`,
      discountPercent: `${discountPercent}%`,
      calculatedChargedAmount: `$${(actualChargedAmount / 100).toFixed(2)}`,
      currentDatabaseAmount: profile.subscriptionAmount
        ? `$${(profile.subscriptionAmount / 100).toFixed(2)}`
        : 'null',
      needsUpdate: profile.subscriptionAmount !== actualChargedAmount,
    });

    // Check if we need to update the database
    if (profile.subscriptionAmount === actualChargedAmount) {
      return NextResponse.json({
        success: true,
        message: 'Subscription amount is already correct',
        noUpdateNeeded: true,
        currentData: {
          chargedAmount: actualChargedAmount,
          originalPrice: originalPrice,
          discountPercent: discountPercent,
        },
      });
    }

    // Update the database with the correct charged amount
    const updatedProfile = await db.profile.update({
      where: { id: profile.id },
      data: {
        subscriptionAmount: actualChargedAmount, // Store the actual charged amount
        lastWebhookUpdate: new Date(),
        updatedAt: new Date(),
      },
    });

    console.log(
      `✅ [FIX-AMOUNT] Updated subscription amount for user: ${profile.email}`
    );
    console.log(`📊 [FIX-AMOUNT] Changes made:`, {
      oldAmount: profile.subscriptionAmount
        ? `$${(profile.subscriptionAmount / 100).toFixed(2)}`
        : 'null',
      newAmount: `$${(actualChargedAmount / 100).toFixed(2)}`,
      originalPrice: `$${(originalPrice / 100).toFixed(2)}`,
      discountPercent: `${discountPercent}%`,
    });

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
      },
    });
  } catch (error) {
    console.error('❌ [FIX-AMOUNT] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fix subscription amount',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
