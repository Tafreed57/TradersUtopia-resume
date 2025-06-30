import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { rateLimitServer, trackSuspiciousActivity } from '@/lib/rate-limit';
import { strictCSRFValidation } from '@/lib/csrf';
import { getStripeInstance } from '@/lib/stripe';


// Mark this route as dynamic to prevent static generation
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  try {
    // CSRF protection for admin operations
    const csrfValid = await strictCSRFValidation(request);
    if (!csrfValid) {
      trackSuspiciousActivity(request, 'ADMIN_GRANT_CSRF_VALIDATION_FAILED');
      return NextResponse.json(
        {
          error: 'CSRF validation failed',
          message: 'Invalid security token. Please refresh and try again.',
        },
        { status: 403 }
      );
    }

    // Rate limiting for admin operations
    const rateLimitResult = await rateLimitServer()(request);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(request, 'ADMIN_GRANT_RATE_LIMIT_EXCEEDED');
      return rateLimitResult.error;
    }

    const user = await currentUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Find the admin's profile and check admin status
    const adminProfile = await db.profile.findFirst({
      where: { userId: user.id },
    });

    if (!adminProfile || !adminProfile.isAdmin) {
      trackSuspiciousActivity(request, 'NON_ADMIN_GRANT_ATTEMPT');
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Find the user
    const targetProfile = await db.profile.findFirst({
      where: { userId },
    });

    if (!targetProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if Stripe is configured
    const stripe = getStripeInstance();
    if (!stripe) {
      console.warn(
        '⚠️ [ADMIN] Stripe not configured - cannot create subscription'
      );
      return NextResponse.json(
        {
          error: 'Payment service not configured',
          message:
            'Stripe is not properly configured. Cannot create subscription.',
        },
        { status: 503 }
      );
    }

    console.log(
      `🎯 [ADMIN] Admin ${adminProfile.email} is granting subscription to user ${targetProfile.email} (${userId})`
    );

    // Create or update customer in Stripe
    let customerId = targetProfile.stripeCustomerId;

    if (!customerId) {
      console.log(
        `👤 [ADMIN] Creating new Stripe customer for: ${targetProfile.email}`
      );

      const customer = await stripe.customers.create({
        email: targetProfile.email,
        name: targetProfile.name,
        metadata: {
          userId: targetProfile.userId,
          adminGranted: 'true',
          grantedBy: adminProfile.email,
          grantedAt: new Date().toISOString(),
        },
      });

      customerId = customer.id;
      console.log(`✅ [ADMIN] Created Stripe customer: ${customerId}`);

      // Update profile with customer ID
      await db.profile.update({
        where: { userId },
        data: { stripeCustomerId: customerId },
      });
    } else {
      console.log(`✅ [ADMIN] Using existing Stripe customer: ${customerId}`);
    }

    // Create a subscription with admin-granted pricing (free or special pricing)
    // For now, we'll create a "comped" subscription that doesn't charge
    try {
      // Instead of using environment variables, get the product and price from Stripe
      // Look for the active product that's being used in the system
      console.log(
        '🔍 [ADMIN] Fetching available products and prices from Stripe...'
      );

      const products = await stripe.products.list({
        active: true,
        limit: 10,
      });

      if (products.data.length === 0) {
        console.error('❌ [ADMIN] No active products found in Stripe');
        return NextResponse.json(
          {
            error: 'No products configured',
            message:
              'No active products found in Stripe. Please configure products first.',
          },
          { status: 500 }
        );
      }

      // Use the first active product (you can modify this logic as needed)
      const product = products.data[0];
      const productId = product.id;

      // Get the default price for this product
      const prices = await stripe.prices.list({
        product: productId,
        active: true,
        limit: 10,
      });

      if (prices.data.length === 0) {
        console.error(
          `❌ [ADMIN] No active prices found for product ${productId}`
        );
        return NextResponse.json(
          {
            error: 'No prices configured',
            message:
              'No active prices found for the product. Please configure pricing first.',
          },
          { status: 500 }
        );
      }

      const priceId = prices.data[0].id;

      console.log(
        `🎯 [ADMIN] Using product: ${productId} with price: ${priceId}`
      );

      // Create the 100% off coupon first
      const adminCouponId = await createAdminCoupon(stripe);
      console.log(
        `🎫 [ADMIN] Using coupon ${adminCouponId} for user ${userId}`
      );

      // Create subscription with proper items and discount
      const subscriptionData = {
        customer: customerId,
        items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        discounts: [
          {
            coupon: adminCouponId,
          },
        ],
        metadata: {
          userId: targetProfile.userId,
          adminGranted: 'true',
          grantedBy: adminProfile.email,
          grantedAt: new Date().toISOString(),
        },
      };

      console.log(`📋 [ADMIN] Creating subscription with data:`, {
        customer: customerId,
        items: subscriptionData.items,
        discountCoupon: adminCouponId,
        userId: targetProfile.userId,
      });

      const subscription = await stripe.subscriptions.create(subscriptionData);

      console.log(
        `💳 [ADMIN] Created comped Stripe subscription ${subscription.id} for user ${userId}`
      );

      // Extract subscription dates with proper validation
      let subscriptionStart: Date;
      let subscriptionEnd: Date;

      // Use proper type assertion for accessing subscription periods
      const subscriptionWithPeriods = subscription as any;

      if (
        subscriptionWithPeriods.current_period_start &&
        subscriptionWithPeriods.current_period_end
      ) {
        subscriptionStart = new Date(
          subscriptionWithPeriods.current_period_start * 1000
        );
        subscriptionEnd = new Date(
          subscriptionWithPeriods.current_period_end * 1000
        );
      } else {
        // Fallback dates if Stripe data is missing
        subscriptionStart = new Date();
        subscriptionEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
        console.warn(
          '⚠️ [ADMIN] Using fallback dates - Stripe period data missing'
        );
      }

      // Update the database with the subscription details
      const updatedProfile = await db.profile.update({
        where: { userId },
        data: {
          subscriptionStatus: 'ACTIVE',
          subscriptionStart: subscriptionStart,
          subscriptionEnd: subscriptionEnd,
          stripeCustomerId: customerId,
          stripeProductId: productId,
        },
      });

      console.log(
        `✅ [ADMIN] Successfully granted subscription to user ${targetProfile.email}`
      );
      console.log(
        `📅 [ADMIN] Subscription valid from ${subscriptionStart.toISOString()} to ${subscriptionEnd.toISOString()}`
      );

      return NextResponse.json({
        success: true,
        message: `Subscription successfully granted to ${targetProfile.email}`,
        subscription: {
          id: subscription.id,
          productId: productId,
          productName: product.name,
          status: 'ACTIVE',
          start: subscriptionStart.toISOString(),
          end: subscriptionEnd.toISOString(),
          customer: customerId,
        },
        user: {
          userId: targetProfile.userId,
          email: targetProfile.email,
          name: targetProfile.name,
        },
      });
    } catch (error) {
      console.error('❌ [ADMIN] Error creating subscription:', error);
      trackSuspiciousActivity(request, 'ADMIN_GRANT_STRIPE_ERROR');

      return NextResponse.json(
        {
          error: 'Failed to create subscription',
          message: 'Unable to create subscription. Please try again later.',
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('❌ [ADMIN] Error granting subscription:', error);
    trackSuspiciousActivity(request, 'ADMIN_GRANT_ERROR');

    return NextResponse.json(
      {
        error: 'Failed to grant subscription',
        message: 'Unable to grant subscription. Please try again later.',
      },
      { status: 500 }
    );
  }
}

// Helper function to create admin coupon (100% off)
async function createAdminCoupon(stripe: any) {
  try {
    const coupon = await stripe.coupons.create({
      percent_off: 100,
      duration: 'forever',
      name: 'Admin Granted Access',
      metadata: {
        type: 'admin_granted',
        createdAt: new Date().toISOString(),
      },
    });

    console.log(`🎫 [ADMIN] Created 100% off coupon: ${coupon.id}`);
    return coupon.id;
  } catch (error) {
    console.error('❌ [ADMIN] Error creating coupon:', error);
    throw new Error('Failed to create admin coupon');
  }
}
