import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { z } from 'zod';
import Stripe from 'stripe';
import { db } from '@/lib/db';
import { strictCSRFValidation } from '@/lib/csrf';
import { rateLimitSubscription } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const stripeDirectSchema = z.object({
  action: z.enum(['get_subscription_data']),
});

export async function POST(request: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  console.log('🔄 [STRIPE-DIRECT] Starting direct Stripe API call...');

  try {
    // ✅ SECURITY: Add CSRF protection
    const csrfValid = await strictCSRFValidation(request);
    if (!csrfValid) {
      return NextResponse.json(
        { error: 'CSRF validation failed' },
        { status: 403 }
      );
    }

    // ✅ SECURITY: Add rate limiting
    const rateLimitResult = await rateLimitSubscription()(request);
    if (!rateLimitResult.success) {
      return rateLimitResult.error;
    }

    // Get authenticated user
    const user = await currentUser();
    if (!user) {
      console.log('❌ [STRIPE-DIRECT] No authenticated user');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = stripeDirectSchema.parse(body);

    // Get user profile to get Stripe customer ID
    const profile = await db.profile.findFirst({
      where: { userId: user.id },
    });

    if (!profile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    if (!profile.stripeCustomerId) {
      return NextResponse.json(
        { error: 'No Stripe customer ID found' },
        { status: 400 }
      );
    }

    console.log(
      `🔍 [STRIPE-DIRECT] Fetching subscription for customer: ${profile.stripeCustomerId}`
    );

    // Fetch active subscriptions directly from Stripe
    const subscriptions = await stripe.subscriptions.list({
      customer: profile.stripeCustomerId,
      status: 'active',
      limit: 1,
      expand: ['data.latest_invoice', 'data.items.data.price'],
    });

    if (subscriptions.data.length === 0) {
      console.log('❌ [STRIPE-DIRECT] No active subscription found');
      return NextResponse.json({
        success: false,
        error: 'No active subscription found',
      });
    }

    const subscription = subscriptions.data[0];
    const price = subscription.items.data[0]?.price;
    const productId = price?.product;

    console.log(`✅ [STRIPE-DIRECT] Found subscription: ${subscription.id}`);
    console.log(
      `💰 [STRIPE-DIRECT] Price: ${price?.unit_amount} ${price?.currency}`
    );

    // Extract discount information
    let discountPercent = null;
    let discountAmount = null;
    let originalAmount = price?.unit_amount || 0;

    if (subscription.discount && subscription.discount.coupon) {
      const coupon = subscription.discount.coupon;
      if (coupon.percent_off) {
        discountPercent = coupon.percent_off;
        originalAmount = Math.round(
          originalAmount / (1 - coupon.percent_off / 100)
        );
      } else if (coupon.amount_off) {
        discountAmount = coupon.amount_off;
        originalAmount = originalAmount + coupon.amount_off;
      }
    }

    const subscriptionData = {
      id: subscription.id,
      status: subscription.status,
      customerId: subscription.customer,
      amount: price?.unit_amount || 0,
      originalAmount: originalAmount,
      currency: price?.currency || 'usd',
      interval: price?.recurring?.interval || 'month',
      currentPeriodStart: new Date(
        subscription.current_period_start * 1000
      ).toISOString(),
      currentPeriodEnd: new Date(
        subscription.current_period_end * 1000
      ).toISOString(),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      productId: typeof productId === 'string' ? productId : productId,
      productName: 'Premium Plan', // We'll use a default since we can't expand to product details
      discountPercent,
      discountAmount,
      hasDiscount: !!(discountPercent || discountAmount),
    };

    console.log(`🎉 [STRIPE-DIRECT] Successfully retrieved subscription data:`);
    console.log(`📋 [STRIPE-DIRECT] Subscription ID: ${subscriptionData.id}`);
    console.log(`💰 [STRIPE-DIRECT] Amount: ${subscriptionData.amount}`);
    console.log(`🏷️ [STRIPE-DIRECT] Product ID: ${subscriptionData.productId}`);

    return NextResponse.json({
      success: true,
      subscription: subscriptionData,
      source: 'stripe_api_direct',
    });
  } catch (error) {
    console.error('❌ [STRIPE-DIRECT] Error:', error);

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    // Handle Stripe errors
    if (error instanceof Stripe.errors.StripeError) {
      console.error('❌ [STRIPE-DIRECT] Stripe error:', error.message);
      return NextResponse.json(
        { error: 'Failed to fetch subscription from Stripe' },
        { status: 503 }
      );
    }

    // Generic error response
    return NextResponse.json(
      { error: 'Failed to fetch subscription data' },
      { status: 500 }
    );
  }
}
