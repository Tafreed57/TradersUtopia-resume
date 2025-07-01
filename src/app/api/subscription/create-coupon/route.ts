import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { z } from 'zod';
import Stripe from 'stripe';
import { db } from '@/lib/db';
import { createNotification } from '@/lib/notifications';

export const dynamic = 'force-dynamic';
// Validation schema
const createCouponSchema = z.object({
  percentOff: z.number().min(1).max(99),
  newMonthlyPrice: z.number().min(0.01),
  currentPrice: z.number().min(0.01),
  originalPrice: z.number().min(0.01).optional(),
  customerId: z.string().optional(),
  subscriptionId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-05-28.basil',
  });
  console.log('🎯 [CREATE-COUPON] Starting coupon creation process...');

  try {
    // Get authenticated user
    const user = await currentUser();
    if (!user) {
      console.log('❌ [CREATE-COUPON] No authenticated user');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = createCouponSchema.parse(body);
    const {
      percentOff,
      newMonthlyPrice,
      currentPrice,
      originalPrice,
      subscriptionId,
    } = validatedData;

    // Use originalPrice if provided, otherwise fallback to currentPrice
    const basePrice = originalPrice || currentPrice;

    console.log(
      `🎯 [CREATE-COUPON] Creating ${percentOff}% off coupon for user: ${user.id}`
    );
    console.log(
      `📊 [CREATE-COUPON] Original: $${basePrice}, Current: $${currentPrice}, Target: $${newMonthlyPrice}`
    );

    // Get user profile to verify they have an active subscription
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

    // Get the user's active subscription from Stripe
    let activeSubscription;
    try {
      const subscriptions = await stripe.subscriptions.list({
        customer: profile.stripeCustomerId,
        status: 'active',
        limit: 1,
      });

      if (subscriptions.data.length === 0) {
        return NextResponse.json(
          { error: 'No active subscription found' },
          { status: 400 }
        );
      }

      activeSubscription = subscriptions.data[0];
    } catch (stripeError) {
      console.error('❌ [CREATE-COUPON] Stripe API error:', stripeError);
      return NextResponse.json(
        {
          error: 'Failed to retrieve subscription data',
          message: 'Service temporarily unavailable',
        },
        { status: 503 }
      );
    }

    // Recalculate the percentage based on the base price to ensure accuracy
    const actualPercentOff = Math.round(
      ((basePrice - newMonthlyPrice) / basePrice) * 100
    );

    console.log(
      `🔍 [CREATE-COUPON] Verification: Base: $${basePrice}, Target: $${newMonthlyPrice}`
    );
    console.log(
      `🔍 [CREATE-COUPON] Percentage: Frontend: ${percentOff}%, Calculated: ${actualPercentOff}%`
    );

    // Create the coupon in Stripe
    let coupon;
    try {
      coupon = await stripe.coupons.create({
        percent_off: actualPercentOff,
        duration: 'forever', // Permanent discount as requested
        metadata: {
          customer_id: profile.stripeCustomerId,
          user_id: user.id,
          original_price: basePrice.toString(),
          current_price: currentPrice.toString(),
          negotiated_price: newMonthlyPrice.toString(),
          created_by: 'cancellation_negotiation',
          created_at: new Date().toISOString(),
        },
      });

      console.log(
        `✅ [CREATE-COUPON] Coupon created: ${coupon.id} with ${actualPercentOff}% discount`
      );
    } catch (stripeError) {
      console.error('❌ [CREATE-COUPON] Failed to create coupon:', stripeError);
      return NextResponse.json(
        {
          error: 'Failed to create discount coupon',
          message: 'Could not process discount request',
        },
        { status: 500 }
      );
    }

    // Apply the coupon to the customer's subscription
    let updatedSubscription;
    try {
      updatedSubscription = await stripe.subscriptions.update(
        activeSubscription.id,
        {
          discounts: [{ coupon: coupon.id }],
          proration_behavior: 'create_prorations', // Handle mid-cycle changes
        }
      );

      console.log(
        `✅ [CREATE-COUPON] Coupon applied to subscription: ${activeSubscription.id}`
      );
    } catch (stripeError) {
      console.error(
        '❌ [CREATE-COUPON] Failed to apply coupon to subscription:',
        stripeError
      );

      // If we can't apply the coupon, delete it to avoid orphaned coupons
      try {
        await stripe.coupons.del(coupon.id);
        console.log(
          `🧹 [CREATE-COUPON] Cleaned up unused coupon: ${coupon.id}`
        );
      } catch (cleanupError) {
        console.error(
          '❌ [CREATE-COUPON] Failed to cleanup coupon:',
          cleanupError
        );
      }

      return NextResponse.json(
        {
          error: 'Failed to apply discount to subscription',
          message: 'Could not update subscription pricing',
        },
        { status: 500 }
      );
    }

    // Create notification for the user
    await createNotification({
      userId: user.id,
      type: 'PAYMENT',
      title: 'Permanent Discount Applied! 🎉',
      message: `Great news! Your negotiated rate of $${newMonthlyPrice}/month (${percentOff}% off) has been permanently applied to your subscription. This discount will continue for the lifetime of your subscription.`,
    });

    // Calculate actual new amount after discount
    const originalAmount =
      updatedSubscription.items.data[0]?.price?.unit_amount || 0;
    const discountedAmount = Math.round(
      originalAmount * (1 - actualPercentOff / 100)
    );

    // Log successful operation
    console.log(
      `🎉 [CREATE-COUPON] Success! User: ${profile.email || user.id}`
    );
    console.log(
      `📊 [CREATE-COUPON] Discount: ${actualPercentOff}% off permanently`
    );
    console.log(
      `💰 [CREATE-COUPON] New amount: $${discountedAmount / 100}/month`
    );
    console.log(`🔗 [CREATE-COUPON] Coupon ID: ${coupon.id}`);
    console.log(
      `📅 [CREATE-COUPON] Applied to subscription: ${updatedSubscription.id}`
    );

    return NextResponse.json({
      success: true,
      message: `Permanent discount of ${actualPercentOff}% applied successfully`,
      coupon: {
        id: coupon.id,
        percentOff: actualPercentOff,
        newMonthlyPrice: newMonthlyPrice,
        duration: 'forever',
      },
      subscription: {
        id: updatedSubscription.id,
        newAmount: discountedAmount,
        currency: updatedSubscription.items.data[0]?.price?.currency || 'usd',
      },
    });
  } catch (error) {
    console.error('❌ [CREATE-COUPON] Unexpected error:', error);

    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid request data',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    // Generic error response
    return NextResponse.json(
      {
        error: 'Failed to create and apply discount',
        message: 'An internal error occurred. Please try again later.',
      },
      { status: 500 }
    );
  }
}
