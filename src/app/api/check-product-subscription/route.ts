import { NextRequest, NextResponse } from 'next/server';
import { getCurrentProfileWithSync } from '@/lib/query';
import { db } from '@/lib/db';
import Stripe from 'stripe';
import {
  rateLimitSubscription,
  trackSuspiciousActivity,
} from '@/lib/rate-limit';
import { validateInput, productSubscriptionSchema } from '@/lib/validation';
import { strictCSRFValidation } from '@/lib/csrf';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  try {
    // ✅ SECURITY FIX: Add CSRF protection
    const csrfValid = await strictCSRFValidation(request);
    if (!csrfValid) {
      trackSuspiciousActivity(request, 'PRODUCT_CHECK_CSRF_FAILED');
      return NextResponse.json(
        {
          error: 'CSRF validation failed',
          message: 'Invalid security token. Please refresh and try again.',
        },
        { status: 403 }
      );
    }

    // ✅ SECURITY: Rate limiting for subscription checks
    const rateLimitResult = await rateLimitSubscription()(request);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(request, 'SUBSCRIPTION_RATE_LIMIT_EXCEEDED');
      return rateLimitResult.error;
    }

    // ✅ PERFORMANCE: Use lightweight auth instead of full Clerk API
    const profile = await getCurrentProfileWithSync();
    if (!profile) {
      trackSuspiciousActivity(request, 'UNAUTHENTICATED_SUBSCRIPTION_CHECK');
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // ✅ SECURITY: Input validation
    const validationResult = await validateInput(productSubscriptionSchema)(
      request
    );
    if (!validationResult.success) {
      trackSuspiciousActivity(request, 'INVALID_SUBSCRIPTION_INPUT');
      return validationResult.error;
    }

    const { allowedProductIds } = validationResult.data;

    // ✅ PERFORMANCE: Check cached profile data first
    if (profile.isAdmin) {
      return NextResponse.json({
        hasAccess: true,
        reason: 'Admin access granted',
        productId: profile.stripeProductId,
        subscriptionEnd: profile.subscriptionEnd,
        profile: {
          id: profile.id,
          subscriptionStatus: profile.subscriptionStatus,
          stripeProductId: profile.stripeProductId,
        },
      });
    } else if (
      profile.subscriptionStatus === 'ACTIVE' &&
      profile.subscriptionEnd &&
      profile.stripeProductId &&
      new Date(profile.subscriptionEnd) > new Date() &&
      allowedProductIds.includes(profile.stripeProductId)
    ) {
      return NextResponse.json({
        hasAccess: true,
        productId: profile.stripeProductId,
        reason: `Valid cached subscription for product: ${profile.stripeProductId}`,
        subscriptionEnd: profile.subscriptionEnd,
        profile: {
          id: profile.id,
          subscriptionStatus: profile.subscriptionStatus,
          stripeProductId: profile.stripeProductId,
        },
      });
    } else if (profile.subscriptionStatus === 'FREE') {
      return NextResponse.json(
        {
          hasAccess: false,
          reason: 'No active subscription found for the required products',
        },
        { status: 401 }
      );
    }
    // TODO: NONE OF THE CODE BELOW THIS LINE IS EVER REACHED SINCE ONE
    // OF THE ABOVE TWO CONDITIONS IS ALWAYS TRUE AND THE API CALL ENDS

    // Enhanced Stripe API interaction with error handling
    let customer;
    try {
      // Step 1: Search for customer in Stripe by email
      const customers = await stripe.customers.list({
        email: profile.email,
        limit: 1,
      });

      if (customers.data.length === 0) {
        // Update profile to reflect no subscription
        await db.profile.update({
          where: { id: profile.id },
          data: {
            subscriptionStatus: 'FREE',
            subscriptionEnd: null,
            stripeProductId: null,
          },
        });

        return NextResponse.json({
          hasAccess: false,
          reason: 'No customer found in Stripe with this email',
        });
      }

      customer = customers.data[0];
    } catch (stripeError) {
      trackSuspiciousActivity(request, 'STRIPE_API_ERROR');

      // Return cached data if Stripe is down but we have recent data
      if (
        profile.subscriptionStatus === 'ACTIVE' &&
        profile.subscriptionEnd &&
        new Date(profile.subscriptionEnd) > new Date()
      ) {
        return NextResponse.json({
          hasAccess: allowedProductIds.includes(profile.stripeProductId || ''),
          productId: profile.stripeProductId,
          reason: 'Using cached subscription (Stripe temporarily unavailable)',
          subscriptionEnd: profile.subscriptionEnd,
        });
      }

      return NextResponse.json(
        {
          hasAccess: false,
          reason: 'Failed to verify subscription status',
          error: 'Service temporarily unavailable',
        },
        { status: 503 }
      );
    }

    // Step 2: Check for active subscriptions with allowed products
    let validSubscription = null;
    let subscribedProductId = null;

    try {
      const subscriptions = await stripe.subscriptions.list({
        customer: customer.id,
        status: 'active',
        limit: 10,
      });

      for (const subscription of subscriptions.data) {
        for (const item of subscription.items.data) {
          // Get the price details to find the product ID
          const price = await stripe.prices.retrieve(item.price.id);

          if (allowedProductIds.includes(price.product as string)) {
            validSubscription = subscription;
            subscribedProductId = price.product as string;
            break;
          }
        }
        if (validSubscription) break;
      }
    } catch (stripeError) {
      trackSuspiciousActivity(request, 'STRIPE_SUBSCRIPTION_ERROR');
      return NextResponse.json(
        {
          hasAccess: false,
          reason: 'Failed to verify subscription details',
          error: 'Service temporarily unavailable',
        },
        { status: 503 }
      );
    }

    if (!validSubscription) {
      // Update profile to reflect no active subscription
      await db.profile.update({
        where: { id: profile.id },
        data: {
          subscriptionStatus: 'FREE',
          subscriptionEnd: null,
          stripeProductId: null,
          stripeCustomerId: customer.id,
        },
      });

      return NextResponse.json({
        hasAccess: false,
        reason: 'No active subscription found for the required products',
      });
    }

    // Calculate subscription end date with validation
    let subscriptionEnd: Date;
    try {
      if (validSubscription && (validSubscription as any).current_period_end) {
        subscriptionEnd = new Date(
          (validSubscription as any).current_period_end * 1000
        );
      } else {
        subscriptionEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      }

      if (isNaN(subscriptionEnd.getTime())) {
        subscriptionEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      }
    } catch (dateError) {
      subscriptionEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }

    // ✅ PERFORMANCE: Update cached profile data
    const updatedProfile = await db.profile.update({
      where: { id: profile.id },
      data: {
        subscriptionStatus: 'ACTIVE',
        subscriptionStart: new Date(),
        subscriptionEnd: subscriptionEnd,
        stripeCustomerId: customer.id,
        stripeProductId: subscribedProductId,
      },
    });

    return NextResponse.json({
      hasAccess: true,
      productId: subscribedProductId,
      reason: `Valid subscription found for product: ${subscribedProductId}`,
      subscriptionEnd: subscriptionEnd,
      profile: {
        id: updatedProfile.id,
        subscriptionStatus: updatedProfile.subscriptionStatus,
        stripeProductId: updatedProfile.stripeProductId,
      },
    });
  } catch (error) {
    trackSuspiciousActivity(request, 'SUBSCRIPTION_CHECK_ERROR');
    // ✅ SECURITY: Don't expose detailed error information
    return NextResponse.json(
      {
        hasAccess: false,
        reason: 'Failed to verify product subscription',
        error: 'An internal error occurred while checking subscription status',
      },
      { status: 500 }
    );
  }
}
