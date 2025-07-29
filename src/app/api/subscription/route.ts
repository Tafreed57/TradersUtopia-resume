import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/middleware/auth-middleware';
import { SubscriptionService } from '@/services/stripe/subscription-service';
import { CustomerService } from '@/services/stripe/customer-service';
import { UserService } from '@/services/database/user-service';
import { apiLogger } from '@/lib/enhanced-logger';
import { z } from 'zod';
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';

// No query parameters needed - always include coupons

/**
 * Subscription Status API
 *
 * @route GET /api/subscription
 * @description Fetches minimal subscription information directly from Stripe:
 * - isActive: boolean - whether subscription is active or trialing
 * - total: number - exact amount being charged (after discounts)
 * - currency: string - currency code
 * - discounts: array - active coupons/discounts applied (always included)
 * @security Requires authentication with rate limiting
 */
export const GET = withAuth(
  async (req: NextRequest, { user, isAdmin }) => {
    const startTime = Date.now();

    try {
      // Initialize services
      const userService = new UserService();
      const subscriptionService = new SubscriptionService();
      const customerService = new CustomerService();

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
      apiLogger.databaseOperation('subscription_pricing_fetch_error', false, {
        userId: user.id.substring(0, 8) + '***',
        error: error instanceof Error ? error.message : 'Unknown error',
        responseTime: `${Date.now() - startTime}ms`,
      });

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
  },
  {
    action: 'subscription_pricing_fetch',
    requireAdmin: false,
    requireCSRF: false,
    requireRateLimit: true,
    allowedMethods: ['GET'],
  }
);
