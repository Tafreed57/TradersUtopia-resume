import { NextRequest, NextResponse } from 'next/server';
import { withAuth, authHelpers } from '@/middleware/auth-middleware';
import { UserService } from '@/services/database/user-service';
import { CustomerService } from '@/services/stripe/customer-service';
import { CouponService } from '@/services/stripe/coupon-service';
import { SubscriptionService } from '@/services/stripe/subscription-service';
import { apiLogger } from '@/lib/enhanced-logger';
import { ValidationError } from '@/lib/error-handling';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const createCouponSchema = z.object({
  percentOff: z.number().min(1).max(99),
  newMonthlyPrice: z.number().min(2000), // Expected in cents (min $20.00)
  currentPrice: z.number().min(1), // Expected in cents (min $0.01)
  originalPrice: z.number().min(1).optional(), // Expected in cents (min $0.01)
});

/**
 * Create Discount Coupon
 * Admin-only operation for creating permanent discount coupons
 */
export const POST = withAuth(async (req: NextRequest, { user, isAdmin }) => {
  // Step 1: Input validation
  const body = await req.json();
  const validationResult = createCouponSchema.safeParse(body);
  if (!validationResult.success) {
    throw new ValidationError(
      'Invalid coupon data: ' +
        validationResult.error.issues.map(i => i.message).join(', ')
    );
  }

  const { percentOff, newMonthlyPrice, currentPrice, originalPrice } =
    validationResult.data;
  const basePriceCents = originalPrice || currentPrice; // All prices now in cents

  // Verify percentage calculation (all in cents)
  const actualPercentOff = Math.round(
    ((basePriceCents - newMonthlyPrice) / basePriceCents) * 100
  );
  if (Math.abs(actualPercentOff - percentOff) > 1) {
    throw new ValidationError(
      `Percentage mismatch: expected ${percentOff}%, calculated ${actualPercentOff}%`
    );
  }

  const userService = new UserService();
  const customerService = new CustomerService();
  const couponService = new CouponService();
  const subscriptionService = new SubscriptionService();

  // Step 2: Get user profile using service layer
  const profile = await userService.findByUserIdOrEmail(user.id);
  if (!profile || !profile.email) {
    throw new ValidationError('User profile or email not found');
  }

  // Step 3: Find Stripe customer using service layer
  const stripeCustomer = await customerService.findCustomerByEmail(
    profile.email
  );
  if (!stripeCustomer) {
    throw new ValidationError('Stripe customer not found');
  }

  // Step 4: Check for active subscription
  const activeSubscriptions =
    await subscriptionService.getStripeSubscriptionsByCustomerId(
      stripeCustomer.id,
      { status: 'active', limit: 1 }
    );

  if (activeSubscriptions.length === 0) {
    throw new ValidationError(
      'No active subscription found to apply coupon to'
    );
  }

  const subscription = activeSubscriptions[0];

  // Step 5: Create coupon using service layer
  try {
    const coupon = await couponService.createCoupon({
      percentOff: actualPercentOff,
      currency: 'usd',
      name: `${actualPercentOff}% Permanent Discount`,
      duration: 'forever',
    });

    // Step 6: Apply coupon to the user's active subscription
    const updatedSubscription =
      await subscriptionService.applyCouponToSubscription(
        subscription.id,
        coupon.id
      );

    apiLogger.databaseOperation('stripe_coupon_created_and_applied', true, {
      adminId: user.id.substring(0, 8) + '***',
      customerId: stripeCustomer.id.substring(0, 8) + '***',
      subscriptionId: subscription.id.substring(0, 8) + '***',
      couponId: coupon.id,
      percentOff: actualPercentOff,
      originalPrice: basePriceCents,
      newPrice: newMonthlyPrice,
    });

    return NextResponse.json({
      success: true,
      message: `${actualPercentOff}% discount coupon created and applied successfully`,
      coupon: {
        id: coupon.id,
        percent_off: coupon.percent_off,
        duration: coupon.duration,
        currency: coupon.currency,
        name: coupon.name,
        valid: coupon.valid,
      },
      subscription: {
        id: updatedSubscription.id,
        status: updatedSubscription.status,
        discountApplied: !!(
          updatedSubscription.discounts &&
          updatedSubscription.discounts.length > 0
        ),
        discountPercent:
          updatedSubscription.discounts?.[0] &&
          typeof updatedSubscription.discounts[0] === 'object'
            ? updatedSubscription.discounts[0].coupon?.percent_off
            : undefined,
      },
      pricing: {
        original: basePriceCents,
        current: currentPrice,
        new: newMonthlyPrice,
        savings: basePriceCents - newMonthlyPrice,
      },
    });
  } catch (serviceError) {
    apiLogger.databaseOperation('stripe_coupon_operation_failed', false, {
      adminId: user.id.substring(0, 8) + '***',
      customerId: stripeCustomer.id.substring(0, 8) + '***',
      subscriptionId: subscription.id.substring(0, 8) + '***',
      error:
        serviceError instanceof Error ? serviceError.message : 'Unknown error',
    });

    throw new ValidationError(
      'Failed to create and apply discount coupon: ' +
        (serviceError instanceof Error ? serviceError.message : 'Unknown error')
    );
  }
}, authHelpers.subscriberOnly('CREATE_DISCOUNT_COUPON'));
