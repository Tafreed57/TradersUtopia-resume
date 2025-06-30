import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import Stripe from 'stripe';
import {
  rateLimitSubscription,
  trackSuspiciousActivity,
} from '@/lib/rate-limit';
import { validateInput, productSubscriptionSchema } from '@/lib/validation';


// Mark this route as dynamic to prevent static generation
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-05-28.basil',
  });
  try {
    // ✅ SECURITY: Rate limiting for subscription checks
    const rateLimitResult = await rateLimitSubscription()(request);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(request, 'SUBSCRIPTION_RATE_LIMIT_EXCEEDED');
      return rateLimitResult.error;
    }

    // ✅ SECURITY: Authentication check
    const user = await currentUser();
    if (!user) {
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

    const userEmail = user.emailAddresses[0]?.emailAddress;
    if (!userEmail) {
      trackSuspiciousActivity(request, 'NO_EMAIL_SUBSCRIPTION_CHECK');
      return NextResponse.json(
        {
          error: 'No email found',
          message: 'User email is required for subscription verification',
        },
        { status: 400 }
      );
    }

    console.log(
      `🔍 [SUBSCRIPTION] Checking product-specific subscription for user: ${userEmail}`
    );
    console.log(
      `🎯 [SUBSCRIPTION] Allowed product IDs: ${allowedProductIds.join(', ')}`
    );

    // 🚨 SECURITY FIX: REMOVED dangerous database-first check
    // Previously this would grant access based on database alone without Stripe verification
    // Now we ALWAYS verify with Stripe for security

    // ✅ SECURITY: Enhanced Stripe API interaction with error handling
    let customer;
    try {
      // Step 1: Search for customer in Stripe by email
      const customers = await stripe.customers.list({
        email: userEmail,
        limit: 1,
      });

      if (customers.data.length === 0) {
        console.log(
          `❌ [SUBSCRIPTION] No customer found in Stripe for: ${userEmail}`
        );
        return NextResponse.json({
          hasAccess: false,
          reason: 'No customer found in Stripe with this email',
        });
      }

      customer = customers.data[0];
      console.log(`✅ [SUBSCRIPTION] Found Stripe customer: ${customer.id}`);
    } catch (stripeError) {
      console.error(
        '❌ [SUBSCRIPTION] Stripe customer lookup error:',
        stripeError
      );
      trackSuspiciousActivity(request, 'STRIPE_API_ERROR');
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
            console.log(
              `✅ [SUBSCRIPTION] Found valid subscription for product: ${subscribedProductId}`
            );
            break;
          }
        }
        if (validSubscription) break;
      }

      if (!validSubscription && subscriptions.data.length > 0) {
        // Log what products they DO have for debugging
        const userProducts = [];
        for (const subscription of subscriptions.data) {
          for (const item of subscription.items.data) {
            const price = await stripe.prices.retrieve(item.price.id);
            userProducts.push(price.product);
          }
        }
        console.log(
          `❌ [SUBSCRIPTION] User has subscriptions but not for allowed products. User products: ${userProducts.join(', ')}`
        );
      }
    } catch (stripeError) {
      console.error(
        '❌ [SUBSCRIPTION] Stripe subscription lookup error:',
        stripeError
      );
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
      console.log(
        `❌ [SUBSCRIPTION] No valid subscription found for user: ${userEmail}`
      );
      return NextResponse.json({
        hasAccess: false,
        reason: 'No active subscription found for the required products',
      });
    }

    // Calculate subscription end date with validation
    let subscriptionEnd: Date;
    try {
      if (validSubscription && (validSubscription as any).current_period_end) {
        // Convert Stripe timestamp to Date
        subscriptionEnd = new Date(
          (validSubscription as any).current_period_end * 1000
        );
        console.log(
          `📅 [SUBSCRIPTION] Subscription end from Stripe: ${subscriptionEnd.toISOString()}`
        );
      } else {
        // Fallback: 30 days from now for one-time payments or invalid subscription data
        subscriptionEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        console.log(
          `📅 [SUBSCRIPTION] Using fallback subscription end: ${subscriptionEnd.toISOString()}`
        );
      }

      // Validate the date is not invalid
      if (isNaN(subscriptionEnd.getTime())) {
        console.log(
          '⚠️ [SUBSCRIPTION] Invalid subscription end date, using 30-day fallback'
        );
        subscriptionEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      }
    } catch (dateError) {
      console.error('❌ [SUBSCRIPTION] Date calculation error:', dateError);
      subscriptionEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }

    // Find or create/update profile
    let profile = await db.profile.findFirst({
      where: { userId: user.id },
    });

    try {
      if (!profile) {
        profile = await db.profile.create({
          data: {
            userId: user.id,
            name: `${user.firstName} ${user.lastName}`,
            email: userEmail,
            imageUrl: user.imageUrl,
            subscriptionStatus: 'ACTIVE',
            subscriptionStart: new Date(),
            subscriptionEnd: subscriptionEnd,
            stripeCustomerId: customer.id,
            stripeProductId: subscribedProductId,
          },
        });
        console.log(
          `➕ [SUBSCRIPTION] Created new profile with product: ${subscribedProductId}`
        );
      } else {
        profile = await db.profile.update({
          where: { id: profile.id },
          data: {
            subscriptionStatus: 'ACTIVE',
            subscriptionStart: new Date(),
            subscriptionEnd: subscriptionEnd,
            stripeCustomerId: customer.id,
            stripeProductId: subscribedProductId,
          },
        });
        console.log(
          `🔄 [SUBSCRIPTION] Updated profile with product: ${subscribedProductId}`
        );
      }
    } catch (dbError) {
      console.error('❌ [SUBSCRIPTION] Database error:', dbError);
      trackSuspiciousActivity(request, 'SUBSCRIPTION_DB_ERROR');
      return NextResponse.json(
        {
          hasAccess: false,
          reason: 'Failed to update subscription status',
          error: 'Database error occurred',
        },
        { status: 500 }
      );
    }

    // ✅ SECURITY: Log successful subscription verification
    console.log(
      `✅ [SUBSCRIPTION] Access granted to user: ${userEmail} for product: ${subscribedProductId}`
    );
    console.log(
      `📍 [SUBSCRIPTION] IP: ${request.headers.get('x-forwarded-for') || 'unknown'}`
    );

    return NextResponse.json({
      hasAccess: true,
      productId: subscribedProductId,
      reason: `Valid subscription found for product: ${subscribedProductId}`,
      subscriptionEnd: subscriptionEnd,
      profile: {
        id: profile.id,
        subscriptionStatus: profile.subscriptionStatus,
        stripeProductId: profile.stripeProductId,
      },
    });
  } catch (error) {
    console.error(
      '❌ [SUBSCRIPTION] Error checking product subscription:',
      error
    );
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
