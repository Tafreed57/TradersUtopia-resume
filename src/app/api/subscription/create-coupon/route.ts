import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { createNotification } from '@/lib/notifications';
import { getStripeInstance } from '@/lib/stripe';

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
  console.log('🎯 [CREATE-COUPON] Starting coupon creation process...');

  try {
    const user = await currentUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const stripe = getStripeInstance();
    if (!stripe) {
      return NextResponse.json(
        {
          error: 'Payment service not configured',
          message: 'Stripe is not properly configured. Cannot create coupon.',
        },
        { status: 503 }
      );
    }

    const body = await request.json();
    const validatedData = createCouponSchema.parse(body);

    const {
      percentOff,
      newMonthlyPrice,
      currentPrice,
      originalPrice,
      customerId,
      subscriptionId,
    } = validatedData;

    console.log('📊 [CREATE-COUPON] Validated request data:', {
      percentOff,
      newMonthlyPrice,
      currentPrice,
      originalPrice,
      hasCustomerId: !!customerId,
      hasSubscriptionId: !!subscriptionId,
    });

    // Get user profile
    const profile = await db.profile.findFirst({
      where: { userId: user.id },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Calculate the discount details
    const discountAmount = currentPrice - newMonthlyPrice;
    const actualPercentOff = Math.round((discountAmount / currentPrice) * 100);

    console.log('💰 [CREATE-COUPON] Discount calculation:', {
      currentPrice,
      newMonthlyPrice,
      discountAmount,
      requestedPercentOff: percentOff,
      actualPercentOff,
    });

    // Create the coupon in Stripe
    const couponId = `user-${user.id}-${Date.now()}`;
    const coupon = await stripe.coupons.create({
      id: couponId,
      percent_off: actualPercentOff,
      duration: 'forever',
      name: `Custom Discount - ${actualPercentOff}% off`,
      metadata: {
        userId: user.id,
        userEmail: profile.email,
        originalPrice: originalPrice?.toString() || currentPrice.toString(),
        newPrice: newMonthlyPrice.toString(),
        createdAt: new Date().toISOString(),
        type: 'user_requested_discount',
      },
    });

    console.log('🎫 [CREATE-COUPON] Created Stripe coupon:', {
      id: coupon.id,
      percentOff: coupon.percent_off,
      duration: coupon.duration,
    });

    // If we have subscription info, we could apply it immediately
    let subscriptionUpdate = null;
    if (subscriptionId && customerId) {
      try {
        // Get the subscription
        const subscription =
          await stripe.subscriptions.retrieve(subscriptionId);

        if (subscription.customer === customerId) {
          // Apply the coupon to the subscription
          const updatedSubscription = await stripe.subscriptions.update(
            subscriptionId,
            {
              coupon: coupon.id,
            } as any
          );

          subscriptionUpdate = {
            id: updatedSubscription.id,
            status: updatedSubscription.status,
            couponApplied: true,
            discount: (updatedSubscription as any).discount,
          };

          console.log(
            '✅ [CREATE-COUPON] Applied coupon to subscription:',
            subscriptionId
          );
        } else {
          console.warn(
            '⚠️ [CREATE-COUPON] Customer ID mismatch for subscription'
          );
        }
      } catch (subscriptionError) {
        console.error(
          '❌ [CREATE-COUPON] Failed to apply coupon to subscription:',
          subscriptionError
        );
        // Don't fail the entire request, just log the error
      }
    }

    // Create notification for the user
    await createNotification({
      userId: user.id,
      type: 'SYSTEM',
      title: 'Custom Discount Created',
      message: `Your ${actualPercentOff}% discount coupon has been created! New monthly price: $${newMonthlyPrice}`,
      actionUrl: '/pricing',
    });

    console.log(
      '✅ [CREATE-COUPON] Successfully created coupon and notification'
    );

    return NextResponse.json({
      success: true,
      coupon: {
        id: coupon.id,
        percentOff: coupon.percent_off,
        discountAmount: discountAmount,
        newMonthlyPrice: newMonthlyPrice,
        originalPrice: currentPrice,
        duration: coupon.duration,
        valid: coupon.valid,
      },
      subscription: subscriptionUpdate,
      message: `Custom ${actualPercentOff}% discount coupon created successfully!`,
    });
  } catch (error) {
    console.error('❌ [CREATE-COUPON] Error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    // Check if it's a Stripe error
    if (error && typeof error === 'object' && 'type' in error) {
      const stripeError = error as any;
      console.error(
        '🚨 [CREATE-COUPON] Stripe error:',
        stripeError.type,
        stripeError.message
      );

      return NextResponse.json(
        {
          error: 'Failed to create discount',
          message:
            'Unable to create your custom discount. Please try again later.',
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Unable to process your request. Please try again later.',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Create Custom Coupon Endpoint',
    description: 'Create a custom discount coupon for subscription pricing',
    usage: {
      method: 'POST',
      authentication: 'Required',
      body: {
        percentOff: 'number (1-99) - Percentage discount',
        newMonthlyPrice: 'number - New monthly price after discount',
        currentPrice: 'number - Current monthly price',
        originalPrice:
          'number (optional) - Original price before any discounts',
        customerId: 'string (optional) - Stripe customer ID',
        subscriptionId:
          'string (optional) - Stripe subscription ID to apply coupon to',
      },
    },
    example: {
      percentOff: 20,
      newMonthlyPrice: 39.99,
      currentPrice: 49.99,
      originalPrice: 59.99,
    },
  });
}
