import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middleware/auth-middleware';
import { SubscriptionService } from '@/services/stripe/subscription-service';
import { CustomerService } from '@/services/stripe/customer-service';
import { UserService } from '@/services/database/user-service';
import { apiLogger } from '@/lib/enhanced-logger';
import { z } from 'zod';
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';

/**
 * Subscription API
 *
 * @route GET /api/subscription - Fetches subscription pricing information
 * @route GET /api/subscription?status=true - Checks payment/subscription status
 * @route GET /api/subscription?comprehensive=true - Returns detailed subscription data
 * @description
 * Default: Returns minimal subscription information directly from Stripe:
 * - isActive: boolean - whether subscription is active or trialing
 * - total: number - exact amount being charged (after discounts)
 * - currency: string - currency code
 * - discounts: array - active coupons/discounts applied (always included)
 *
 * With ?status=true: Returns comprehensive subscription status:
 * - hasAccess: boolean - whether user has access
 * - subscriptionStatus: string - detailed status
 * - subscriptionEnd: date - when subscription ends
 * - reason: string - explanation of access status
 * - stripeSubscriptionId: string - Stripe subscription ID
 *
 * With ?comprehensive=true: Returns detailed subscription data (similar to stripe-direct):
 * - success: boolean - operation success
 * - subscription: object - comprehensive subscription details
 * @security Requires authentication with rate limiting
 */
export const GET = withAuth(
  async (req: NextRequest, { user, isAdmin }) => {
    const startTime = Date.now();
    const url = new URL(req.url);
    const checkStatus = url.searchParams.get('status') === 'true';
    const comprehensive = url.searchParams.get('comprehensive') === 'true';

    try {
      // Initialize services
      const userService = new UserService();
      const subscriptionService = new SubscriptionService();
      const customerService = new CustomerService();

      if (checkStatus) {
        apiLogger.databaseOperation('payment_status_check_started', true, {
          userId: user.id.substring(0, 8) + '***',
        });

        try {
          // Step 1: Get user's subscription status using the service layer
          const subscriptionStatus =
            await userService.getUserSubscriptionStatus(user.id);

          apiLogger.databaseOperation('payment_status_checked', true, {
            userId: user.id.substring(0, 8) + '***',
            hasAccess: subscriptionStatus.hasActiveSubscription,
            subscriptionStatus: subscriptionStatus.status,
            currentPeriodEnd: subscriptionStatus.currentPeriodEnd,
          });

          return NextResponse.json({
            hasAccess: subscriptionStatus.hasActiveSubscription,
            subscriptionStatus: subscriptionStatus.status,
            subscriptionEnd: subscriptionStatus.currentPeriodEnd,
            reason: subscriptionStatus.hasActiveSubscription
              ? 'Active subscription'
              : `No active subscription (${subscriptionStatus.status})`,
            stripeSubscriptionId: subscriptionStatus.stripeSubscriptionId,
          });
        } catch (error) {
          apiLogger.databaseOperation('payment_status_check_error', false, {
            userId: user.id.substring(0, 8) + '***',
            error: error instanceof Error ? error.message : 'Unknown error',
          });

          return NextResponse.json(
            {
              hasAccess: false,
              reason: 'Error checking subscription status',
              subscriptionStatus: 'ERROR',
              debug: {
                userId: user.id,
                error: error instanceof Error ? error.message : 'Unknown error',
              },
            },
            { status: 500 }
          );
        }
      }

      // Handle comprehensive subscription data request
      if (comprehensive) {
        apiLogger.databaseOperation(
          'comprehensive_subscription_fetch_started',
          true,
          {
            userId: user.id.substring(0, 8) + '***',
          }
        );

        try {
          // Step 1: Get user profile using service layer
          const profile = await userService.findByUserIdOrEmail(user.id);
          if (!profile || !profile.email) {
            return NextResponse.json(
              {
                success: false,
                error: 'User profile or email not found',
              },
              { status: 404 }
            );
          }

          // Step 2: Find Stripe customer using service layer
          const stripeCustomer = await customerService.findCustomerByEmail(
            profile.email
          );
          if (!stripeCustomer) {
            return NextResponse.json(
              {
                success: false,
                error: 'No Stripe customer ID found',
              },
              { status: 404 }
            );
          }

          // Step 3: Get active subscription using service layer
          const subscription =
            await subscriptionService.getSubscriptionByCustomerEmail(
              profile.email
            );
          if (!subscription) {
            return NextResponse.json(
              {
                success: false,
                error: 'No active subscription found',
              },
              { status: 404 }
            );
          }

          // Step 4: Get subscription details with pricing
          const subscriptionWithDetails =
            await subscriptionService.getSubscription(subscription.id);

          if (!subscriptionWithDetails?.items?.data?.[0]?.price) {
            return NextResponse.json(
              {
                success: false,
                error: 'Subscription price information not available',
              },
              { status: 404 }
            );
          }

          const price = subscriptionWithDetails.items.data[0].price;
          const productId = price.product;

          // Step 5: Calculate pricing with discounts
          let originalAmount = price.unit_amount || 0;
          let discountPercent = 0;
          let discountAmount = 0;

          // Handle subscription-level discount
          if (subscriptionWithDetails.discounts?.length > 0) {
            const discount = subscriptionWithDetails.discounts[0];
            if (typeof discount === 'object' && discount.coupon) {
              const coupon = discount.coupon;

              if (coupon.percent_off) {
                discountPercent = coupon.percent_off;
                discountAmount = Math.round(
                  (originalAmount * coupon.percent_off) / 100
                );
              } else if (coupon.amount_off) {
                discountAmount = coupon.amount_off;
                originalAmount = originalAmount + coupon.amount_off;
              }
            }
          }

          const subscriptionData = {
            id: subscription.id,
            amount: price?.unit_amount || 0,
            originalAmount: originalAmount,
            currency: price?.currency || 'usd',
            interval: price?.recurring?.interval || 'month',
            customerId: subscription.customer,
          };

          apiLogger.databaseOperation(
            'comprehensive_subscription_retrieved',
            true,
            {
              userId: user.id.substring(0, 8) + '***',
              email: profile.email.substring(0, 3) + '***',
              customerId: stripeCustomer.id.substring(0, 8) + '***',
              subscriptionId: subscription.id.substring(0, 8) + '***',
              status: subscription.status,
              amount: subscriptionData.amount,
              hasDiscount: !!(discountPercent || discountAmount),
            }
          );

          return NextResponse.json({
            success: true,
            subscription: subscriptionData,
            source: 'service_layer_optimized',
          });
        } catch (error) {
          apiLogger.databaseOperation(
            'comprehensive_subscription_retrieval_failed',
            false,
            {
              userId: user.id.substring(0, 8) + '***',
              error: error instanceof Error ? error.message : 'Unknown error',
            }
          );

          return NextResponse.json(
            {
              success: false,
              error:
                'Failed to fetch comprehensive subscription data: ' +
                (error instanceof Error ? error.message : 'Unknown error'),
            },
            { status: 500 }
          );
        }
      }

      // Handle pricing information request (existing functionality)
      apiLogger.databaseOperation('subscription_pricing_fetch_started', true, {
        userId: user.id.substring(0, 8) + '***',
      });

      // Step 1: Get user profile
      const profile = await userService.findByUserIdOrEmail(user.id);

      if (!profile) {
        return NextResponse.json(
          { error: 'User profile not found' },
          { status: 404 }
        );
      }

      // Step 2: Handle admin users
      if (isAdmin) {
        apiLogger.databaseOperation('subscription_pricing_admin_access', true, {
          userId: user.id.substring(0, 8) + '***',
        });

        return NextResponse.json({
          isActive: true,
          total: 0,
          currency: 'usd',
          discounts: [],
        });
      }

      // Step 3: Find customer by email
      if (!profile.email) {
        return NextResponse.json({
          isActive: false,
          total: 0,
          currency: 'usd',
          discounts: [],
        });
      }

      const customerDetails = await customerService.findCustomerByEmail(
        profile.email
      );

      if (!customerDetails) {
        return NextResponse.json({
          isActive: false,
          total: 0,
          currency: 'usd',
          discounts: [],
        });
      }

      // Step 4: Get subscription with detailed pricing information

      let subscriptions: Stripe.Subscription[] = [];
      try {
        subscriptions =
          await subscriptionService.getStripeSubscriptionsByCustomerId(
            customerDetails.id,
            {
              status: 'all',
              limit: 1,
            }
          );
      } catch (error) {
        console.error('Error fetching subscriptions:', error);
        return NextResponse.json({
          isActive: false,
          total: 0,
          currency: 'usd',
          discounts: [],
        });
      }

      if (subscriptions.length === 0) {
        return NextResponse.json({
          isActive: false,
          total: 0,
          currency: 'usd',
          discounts: [],
        });
      }

      const subscription = subscriptions[0];

      // Step 5: Calculate detailed pricing information
      const subscriptionItem = subscription.items.data[0];
      const price = subscriptionItem?.price;

      if (!price) {
        throw new Error('No pricing information found for subscription');
      }

      const listPrice = (price.unit_amount || 0) / 100;
      let actualPrice = listPrice;
      let discountAmount = 0;
      let discountPercentage = 0;

      // Calculate discount from subscription-level discount
      if (subscription.discounts && subscription.discounts.length > 0) {
        const discount = subscription.discounts[0];
        if (typeof discount === 'object' && discount.coupon) {
          const coupon = discount.coupon;
          if (coupon.amount_off) {
            discountAmount = coupon.amount_off / 100;
          } else if (coupon.percent_off) {
            discountPercentage = coupon.percent_off;
            discountAmount = (listPrice * coupon.percent_off) / 100;
          }
          actualPrice = Math.max(0, listPrice - discountAmount);
        }
      }

      // Get latest invoice for actual charged amount
      let invoiceActualAmount = null;
      if (
        subscription.latest_invoice &&
        typeof subscription.latest_invoice === 'object'
      ) {
        invoiceActualAmount =
          (subscription.latest_invoice.amount_paid || 0) / 100;
        // If invoice shows different amount, use that as actual price
        if (
          invoiceActualAmount !== null &&
          invoiceActualAmount !== actualPrice
        ) {
          actualPrice = invoiceActualAmount;
          discountAmount = listPrice - actualPrice;
          if (listPrice > 0) {
            discountPercentage = (discountAmount / listPrice) * 100;
          }
        }
      }

      // Step 6: Build discount and coupon information
      const discounts = [];
      const coupons = [];

      if (subscription.discounts && subscription.discounts.length > 0) {
        const discount = subscription.discounts[0];
        if (typeof discount === 'object' && discount.coupon) {
          const coupon = discount.coupon;

          discounts.push({
            id: discount.id,
            object: 'discount',
            start: new Date(discount.start * 1000),
            end: discount.end ? new Date(discount.end * 1000) : null,
            couponId: coupon.id,
          });

          coupons.push({
            id: coupon.id,
            name: coupon.name,
            amountOff: coupon.amount_off ? coupon.amount_off / 100 : null,
            percentOff: coupon.percent_off || null,
            currency: coupon.currency,
            duration: coupon.duration,
            durationInMonths: coupon.duration_in_months,
            maxRedemptions: coupon.max_redemptions,
            timesRedeemed: coupon.times_redeemed,
            valid: coupon.valid,
            created: new Date(coupon.created * 1000),
          });
        }
      }

      // Step 7: Build minimal response - only essential data
      const isActive =
        subscription.status === 'active' || subscription.status === 'trialing';

      const response = {
        isActive,
        total: actualPrice,
        currency: price.currency,
        discounts: coupons,
        // Extract cancellation data from existing live Stripe fetch
        cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
        currentPeriodEnd: subscription.cancel_at_period_end
          ? (subscription as any).cancel_at
            ? new Date((subscription as any).cancel_at * 1000).toISOString()
            : null
          : (subscriptionItem as any).current_period_end
          ? new Date(
              (subscriptionItem as any).current_period_end * 1000
            ).toISOString()
          : null,
      };

      apiLogger.databaseOperation(
        'subscription_pricing_fetch_completed',
        true,
        {
          userId: user.id.substring(0, 8) + '***',
          subscriptionId: subscription.id.substring(0, 8) + '***',
          status: subscription.status,
          listPrice,
          actualPrice,
          discountAmount,
          hasDiscounts: discounts.length > 0,
          responseTime: `${Date.now() - startTime}ms`,
        }
      );

      return NextResponse.json(response);
    } catch (error) {
      const operationType = checkStatus
        ? 'payment_status_check_error'
        : 'subscription_pricing_fetch_error';

      apiLogger.databaseOperation(operationType, false, {
        userId: user.id.substring(0, 8) + '***',
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime: `${Date.now() - startTime}ms`,
      });

      if (checkStatus) {
        return NextResponse.json(
          {
            hasAccess: false,
            reason: 'Error checking subscription status',
            subscriptionStatus: 'ERROR',
            debug: {
              userId: user.id,
              error: error instanceof Error ? error.message : 'Unknown error',
            },
          },
          { status: 500 }
        );
      } else {
        return NextResponse.json(
          {
            isActive: false,
            total: 0,
            currency: 'usd',
            discounts: [],
          },
          { status: 500 }
        );
      }
    }
  },
  {
    action: 'subscription_api',
    requireAdmin: false,
    requireCSRF: false,
    requireRateLimit: true,
    allowedMethods: ['GET'],
  }
);
