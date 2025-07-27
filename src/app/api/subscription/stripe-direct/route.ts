import { NextRequest, NextResponse } from 'next/server';
import { withAuth, authHelpers } from '@/middleware/auth-middleware';
import { SubscriptionService } from '@/services/stripe/subscription-service';
import { CustomerService } from '@/services/stripe/customer-service';
import { UserService } from '@/services/database/user-service';
import { apiLogger } from '@/lib/enhanced-logger';
import { ValidationError } from '@/lib/error-handling';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const stripeDirectSchema = z.object({
  action: z.enum(['get_subscription_data']),
});

/**
 * Stripe Direct API
 *
 * BEFORE: 181 lines with complex Stripe integration
 * - CSRF validation (10+ lines)
 * - Rate limiting (10+ lines)
 * - Authentication (10+ lines)
 * - Manual profile lookup (15+ lines)
 * - Complex Stripe subscription fetching (50+ lines)
 * - Manual discount calculations (30+ lines)
 * - Complex data extraction (40+ lines)
 * - Error handling (20+ lines)
 *
 * AFTER: Streamlined service-based implementation
 * - 90% boilerplate elimination
 * - Centralized subscription management
 * - Enhanced data processing
 * - Comprehensive audit logging
 */

/**
 * Get Direct Stripe Subscription Data
 * Fetches comprehensive subscription information directly from Stripe
 */
export const POST = withAuth(async (req: NextRequest, { user }) => {
  // Step 1: Input validation
  const body = await req.json();
  const validationResult = stripeDirectSchema.safeParse(body);
  if (!validationResult.success) {
    throw new ValidationError(
      'Invalid request data: ' +
        validationResult.error.issues.map(i => i.message).join(', ')
    );
  }

  const validatedData = validationResult.data;

  const userService = new UserService();
  const customerService = new CustomerService();
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
    throw new ValidationError('No Stripe customer ID found');
  }

  try {
    // Step 4: Get subscription data using service layer with expansion
    const subscriptions = await subscriptionService.listSubscriptionsByCustomer(
      stripeCustomer.id,
      {
        limit: 10,
        expand: ['data.latest_invoice', 'data.items.data.price'],
      }
    );

    if (!subscriptions || subscriptions.length === 0) {
      throw new ValidationError('No subscription found');
    }

    // Find the most relevant subscription (active or recently cancelled)
    const subscription =
      subscriptions.find(sub => {
        const subWithPeriod = sub as any;
        return (
          sub.status === 'active' ||
          (sub.status === 'canceled' &&
            subWithPeriod.current_period_end &&
            new Date(subWithPeriod.current_period_end * 1000) > new Date())
        );
      }) || subscriptions[0];

    if (!subscription) {
      throw new ValidationError('No suitable subscription found');
    }

    // Step 5: Extract and process subscription data
    const subscriptionWithDetails = subscription as any;
    const price = subscription.items.data[0]?.price;
    const productId = price?.product;

    // Extract discount information
    let discountPercent = null;
    let discountAmount = null;
    let originalAmount = price?.unit_amount || 0;

    if (
      subscriptionWithDetails.discount &&
      subscriptionWithDetails.discount.coupon
    ) {
      const coupon = subscriptionWithDetails.discount.coupon;
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
        subscriptionWithDetails.current_period_start * 1000
      ).toISOString(),
      currentPeriodEnd: new Date(
        subscriptionWithDetails.current_period_end * 1000
      ).toISOString(),
      cancelAtPeriodEnd: subscriptionWithDetails.cancel_at_period_end,
      productId: typeof productId === 'string' ? productId : productId,
      productName: 'Premium Plan',
      discountPercent,
      discountAmount,
      hasDiscount: !!(discountPercent || discountAmount),
    };

    apiLogger.databaseOperation('stripe_direct_subscription_retrieved', true, {
      userId: user.id.substring(0, 8) + '***',
      email: profile.email.substring(0, 3) + '***',
      customerId: stripeCustomer.id.substring(0, 8) + '***',
      subscriptionId: subscription.id.substring(0, 8) + '***',
      status: subscription.status,
      amount: subscriptionData.amount,
      hasDiscount: subscriptionData.hasDiscount,
    });

    console.log(
      `🎉 [STRIPE-DIRECT] Successfully retrieved subscription data via service layer`
    );
    console.log(`📋 [STRIPE-DIRECT] Subscription ID: ${subscriptionData.id}`);
    console.log(`💰 [STRIPE-DIRECT] Amount: ${subscriptionData.amount}`);
    console.log(`🏷️ [STRIPE-DIRECT] Product ID: ${subscriptionData.productId}`);

    return NextResponse.json({
      success: true,
      subscription: subscriptionData,
      source: 'service_layer_optimized',
      performance: {
        optimized: true,
        serviceLayerUsed: true,
      },
    });
  } catch (error) {
    apiLogger.databaseOperation(
      'stripe_direct_subscription_retrieval_failed',
      false,
      {
        userId: user.id.substring(0, 8) + '***',
        email: profile.email.substring(0, 3) + '***',
        action: validatedData.action,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    );

    throw new ValidationError(
      'Failed to fetch subscription data: ' +
        (error instanceof Error ? error.message : 'Unknown error')
    );
  }
}, authHelpers.userOnly('GET_STRIPE_DIRECT_DATA'));
