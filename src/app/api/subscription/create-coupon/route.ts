import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { z } from 'zod';
import Stripe from 'stripe';
import { db } from '@/lib/db';
import { createNotification } from '@/lib/notifications';
import { strictCSRFValidation } from '@/lib/csrf';
import {
  rateLimitSubscription,
  trackSuspiciousActivity,
} from '@/lib/rate-limit';

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
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  console.log('🎯 [CREATE-COUPON] Starting coupon creation process...');

  try {
    // ✅ SECURITY FIX: Add CSRF protection
    const csrfValid = await strictCSRFValidation(request);
    if (!csrfValid) {
      trackSuspiciousActivity(request, 'COUPON_CSRF_VALIDATION_FAILED');
      return NextResponse.json(
        {
          error: 'CSRF validation failed',
          message: 'Invalid security token. Please refresh and try again.',
        },
        { status: 403 }
      );
    }

    // ✅ SECURITY FIX: Add rate limiting
    const rateLimitResult = await rateLimitSubscription()(request);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(request, 'COUPON_RATE_LIMIT_EXCEEDED');
      return rateLimitResult.error;
    }

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
      customerId,
    } = validatedData;

    // ✅ ENHANCED: Ensure we have at least one identifier to work with
    if (!subscriptionId && !customerId) {
      console.error('❌ [CREATE-COUPON] Missing subscription identifiers:', {
        subscriptionId,
        customerId,
        body,
      });
      return NextResponse.json(
        {
          error: 'Insufficient subscription data',
          message:
            'Unable to identify subscription. Please refresh and try again.',
        },
        { status: 400 }
      );
    }

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

    // 🚀 WEBHOOK-OPTIMIZED: Try webhook-cached subscription data first
    let activeSubscription = null;
    let cachedSubscription = null;

    try {
      cachedSubscription = await db.profile.findFirst({
        where: {
          stripeCustomerId: profile.stripeCustomerId,
          subscriptionStatus: 'ACTIVE',
        },
        orderBy: { createdAt: 'desc' },
      });

      if (cachedSubscription) {
        console.log(
          '⚡ [CREATE-COUPON-OPTIMIZED] Found webhook-cached active subscription'
        );
        console.log(
          `🔍 [CREATE-COUPON-DEBUG] Cached subscription ID: ${cachedSubscription.stripeSubscriptionId}`
        );

        // Check if webhook data is fresh (within last 5 minutes)
        const cacheAge = Date.now() - cachedSubscription.updatedAt.getTime();
        const isFresh = cacheAge < 5 * 60 * 1000; // 5 minutes

        if (isFresh && cachedSubscription.stripeSubscriptionId) {
          console.log(
            '⚡ [CREATE-COUPON-OPTIMIZED] Using fresh webhook data, skipping subscription lookup'
          );

          // Create a minimal subscription object for compatibility
          activeSubscription = {
            id: cachedSubscription.stripeSubscriptionId,
            status: 'active',
            customer: profile.stripeCustomerId,
            current_period_start: Math.floor(
              cachedSubscription.subscriptionStart!.getTime() / 1000
            ),
            current_period_end: Math.floor(
              cachedSubscription.subscriptionEnd!.getTime() / 1000
            ),
            items: {
              data: [
                {
                  price: {
                    unit_amount: Math.round(
                      parseFloat(
                        cachedSubscription.subscriptionAmount?.toString() || '0'
                      ) * 100
                    ),
                    currency: cachedSubscription.subscriptionCurrency || 'usd',
                    product: cachedSubscription.stripeProductId,
                  },
                },
              ],
            },
          };
        } else if (!cachedSubscription.stripeSubscriptionId) {
          console.log(
            '⚠️ [CREATE-COUPON-DEBUG] Cached subscription missing ID, falling back to Stripe API'
          );
        } else {
          console.log(
            '⚠️ [CREATE-COUPON-DEBUG] Cached data is stale, falling back to Stripe API'
          );
        }
      }
    } catch (cacheError) {
      console.warn(
        '⚠️ [CREATE-COUPON] Cache lookup failed, falling back to Stripe API:',
        cacheError
      );
    }

    // 🔄 FALLBACK: Get the user's active subscription from Stripe if no fresh cache
    if (!activeSubscription) {
      console.log(
        '📡 [CREATE-COUPON] Cache miss or stale - fetching from Stripe API...'
      );
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
        console.log(
          '✅ [CREATE-COUPON] Retrieved subscription from Stripe API'
        );
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
        currency: 'usd', // ✅ Explicitly set currency to match subscription
        name: `${actualPercentOff}% Permanent Discount`, // ✅ Add descriptive name
        metadata: {
          customer_id: profile.stripeCustomerId,
          user_id: user.id,
          original_price: basePrice.toString(),
          current_price: currentPrice.toString(),
          negotiated_price: newMonthlyPrice.toString(),
          created_by: 'cancellation_negotiation',
          created_at: new Date().toISOString(),
          optimization_source: cachedSubscription
            ? 'webhook_cache'
            : 'stripe_api',
        },
      });

      // ✅ DEBUG: Log coupon details
      console.log(`🏷️ [CREATE-COUPON] Coupon details:`, {
        id: coupon.id,
        percent_off: coupon.percent_off,
        duration: coupon.duration,
        currency: coupon.currency,
        valid: coupon.valid,
        name: coupon.name,
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
      // ✅ FIXED: Ensure we have a valid subscription ID
      if (!activeSubscription.id) {
        throw new Error(
          'No valid subscription ID found for coupon application'
        );
      }

      console.log(
        `🔧 [CREATE-COUPON] Applying coupon to subscription: ${activeSubscription.id}`
      );

      // ✅ STRIPE API FIX: Use correct coupon application methods
      try {
        // Method 1: Direct subscription discount (most reliable for existing subscriptions)
        console.log(
          `🔧 [CREATE-COUPON] Applying coupon directly to subscription...`
        );

        updatedSubscription = await stripe.subscriptions.update(
          activeSubscription.id,
          {
            discounts: [{ coupon: coupon.id }],
            proration_behavior: 'create_prorations', // ✅ Standard proration handling
          }
        );

        console.log(
          `✅ [CREATE-COUPON] Direct subscription coupon application successful`
        );
      } catch (subscriptionError) {
        console.log(
          `⚠️ [CREATE-COUPON] Direct subscription coupon failed, trying customer-level:`,
          subscriptionError
        );

        // Method 2: Customer-level discount with correct Stripe API format
        try {
          await stripe.customers.update(profile.stripeCustomerId, {
            coupon: coupon.id,
          } as any);

          console.log(
            `🔍 [CREATE-COUPON] Applied coupon to customer: ${profile.stripeCustomerId}`
          );

          // Retrieve updated subscription to reflect customer discount
          updatedSubscription = await stripe.subscriptions.retrieve(
            activeSubscription.id,
            { expand: ['discount.coupon'] }
          );
        } catch (customerError) {
          console.error(
            `❌ [CREATE-COUPON] Both subscription and customer coupon methods failed:`,
            {
              subscriptionError:
                subscriptionError instanceof Error
                  ? subscriptionError.message
                  : String(subscriptionError),
              customerError:
                customerError instanceof Error
                  ? customerError.message
                  : String(customerError),
            }
          );
          throw customerError;
        }
      }

      console.log(
        `✅ [CREATE-COUPON] Coupon applied to subscription: ${activeSubscription.id}`
      );

      // ✅ DEBUG: Verify the coupon was actually applied
      const primaryDiscount = updatedSubscription.discounts?.[0];
      const discountObj =
        typeof primaryDiscount === 'string' ? null : primaryDiscount;
      console.log(`🔍 [CREATE-COUPON] Updated subscription discount info:`, {
        hasDiscount: !!primaryDiscount,
        discountId:
          discountObj?.id ||
          (typeof primaryDiscount === 'string' ? primaryDiscount : null),
        couponId: discountObj?.coupon?.id,
        couponPercentOff: discountObj?.coupon?.percent_off,
        couponValid: discountObj?.coupon?.valid,
        subscriptionStatus: updatedSubscription.status,
      });

      // ✅ VERIFICATION: Wait a moment and verify discount persists
      console.log(
        `🔍 [CREATE-COUPON] Waiting 2 seconds to verify discount persistence...`
      );
      await new Promise(resolve => setTimeout(resolve, 2000));

      const verificationSubscription = await stripe.subscriptions.retrieve(
        activeSubscription.id,
        { expand: ['discounts.coupon'] }
      );

      const verificationDiscount = verificationSubscription.discounts?.[0];
      const verificationDiscountObj =
        typeof verificationDiscount === 'string' ? null : verificationDiscount;
      console.log(`🔍 [CREATE-COUPON] Verification check:`, {
        hasDiscount: !!verificationDiscount,
        discountId:
          verificationDiscountObj?.id ||
          (typeof verificationDiscount === 'string'
            ? verificationDiscount
            : null),
        couponId: verificationDiscountObj?.coupon?.id,
        couponPercentOff: verificationDiscountObj?.coupon?.percent_off,
        isPersistent:
          !!verificationDiscount &&
          verificationDiscountObj?.coupon?.id === coupon.id,
      });

      if (
        !verificationDiscount ||
        verificationDiscountObj?.coupon?.id !== coupon.id
      ) {
        // ✅ ENHANCED ERROR: Provide detailed debugging info
        const errorDetails = {
          expectedCouponId: coupon.id,
          actualCouponId: verificationDiscountObj?.coupon?.id,
          hasAnyDiscount: !!verificationDiscount,
          subscriptionStatus: verificationSubscription.status,
          subscriptionId: verificationSubscription.id,
          customerId: verificationSubscription.customer,
        };

        console.error(
          `❌ [CREATE-COUPON] Coupon verification failed:`,
          errorDetails
        );

        throw new Error(
          `Discount verification failed. Expected coupon ${coupon.id} but found ${verificationDiscountObj?.coupon?.id || 'none'}. Details: ${JSON.stringify(errorDetails)}`
        );
      }
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

    if (cachedSubscription) {
      console.log(
        '⚡ [CREATE-COUPON-OPTIMIZED] Used webhook-cached data for faster processing'
      );
    }

    return NextResponse.json({
      success: true,
      message: `Permanent discount of ${actualPercentOff}% applied successfully`,
      optimized: !!cachedSubscription,
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
