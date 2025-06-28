import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { rateLimitServer, trackSuspiciousActivity } from '@/lib/rate-limit';
import { strictCSRFValidation } from '@/lib/csrf';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-05-28.basil',
});

export async function POST(request: NextRequest) {
  try {
    // CSRF protection for admin operations
    const csrfValid = await strictCSRFValidation(request);
    if (!csrfValid) {
      trackSuspiciousActivity(request, 'ADMIN_GRANT_CSRF_VALIDATION_FAILED');
      return NextResponse.json({ 
        error: 'CSRF validation failed',
        message: 'Invalid security token. Please refresh and try again.'
      }, { status: 403 });
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
      where: { userId: user.id }
    });

    if (!adminProfile || !adminProfile.isAdmin) {
      trackSuspiciousActivity(request, 'NON_ADMIN_GRANT_ATTEMPT');
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Find the user
    const targetProfile = await db.profile.findFirst({
      where: { userId }
    });

    if (!targetProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (targetProfile.subscriptionStatus === 'ACTIVE') {
      return NextResponse.json({ error: 'User already has an active subscription' }, { status: 400 });
    }

    console.log(`🎁 [ADMIN] Admin ${adminProfile.email} is granting subscription to ${targetProfile.email} (${userId})`);

    // Create or get Stripe customer
    let customerId = targetProfile.stripeCustomerId;
    
    if (!customerId) {
      try {
        const customer = await stripe.customers.create({
          email: targetProfile.email,
          name: targetProfile.name,
          metadata: {
            userId: targetProfile.userId,
            adminGranted: 'true',
            grantedBy: adminProfile.email,
            grantedAt: new Date().toISOString(),
          }
        });
        customerId = customer.id;
        console.log(`👤 [ADMIN] Created Stripe customer ${customerId} for user ${userId}`);
      } catch (stripeError) {
        console.error(`Failed to create Stripe customer for user ${userId}:`, stripeError);
        return NextResponse.json({ 
          error: 'Failed to create Stripe customer',
          message: 'Unable to set up payment processing. Please try again.'
        }, { status: 500 });
      }
    }

    // Create a subscription with admin-granted pricing (free or special pricing)
    // For now, we'll create a "comped" subscription that doesn't charge
    try {
      // Instead of using environment variables, get the product and price from Stripe
      // Look for the active product that's being used in the system
      console.log('🔍 [ADMIN] Fetching available products and prices from Stripe...');
      
      const products = await stripe.products.list({ 
        active: true,
        limit: 10 
      });
      
      if (products.data.length === 0) {
        console.error('❌ [ADMIN] No active products found in Stripe');
        return NextResponse.json({ 
          error: 'No products configured',
          message: 'No active products found in Stripe. Please configure products first.'
        }, { status: 500 });
      }

      // Use the first active product (you can modify this logic as needed)
      const product = products.data[0];
      const productId = product.id;
      
      // Get the default price for this product
      const prices = await stripe.prices.list({
        product: productId,
        active: true,
        limit: 10
      });

      if (prices.data.length === 0) {
        console.error(`❌ [ADMIN] No active prices found for product ${productId}`);
        return NextResponse.json({ 
          error: 'No prices configured',
          message: 'No active prices found for the product. Please configure pricing first.'
        }, { status: 500 });
      }

      const priceId = prices.data[0].id;
      
      console.log(`🎯 [ADMIN] Using product: ${productId} with price: ${priceId}`);

      // Create the 100% off coupon first
      const adminCouponId = await createAdminCoupon();
      console.log(`🎫 [ADMIN] Using coupon ${adminCouponId} for user ${userId}`);

      // Create subscription with proper items and discount
      const subscriptionData = {
        customer: customerId,
        items: [{ 
          price: priceId,
          quantity: 1
        }],
        discounts: [{
          coupon: adminCouponId
        }],
        metadata: {
          userId: targetProfile.userId,
          adminGranted: 'true',
          grantedBy: adminProfile.email,
          grantedAt: new Date().toISOString(),
        }
      };

      console.log(`📋 [ADMIN] Creating subscription with data:`, {
        customer: customerId,
        items: subscriptionData.items,
        discountCoupon: adminCouponId,
        userId: targetProfile.userId
      });

      const subscription = await stripe.subscriptions.create(subscriptionData);

      console.log(`💳 [ADMIN] Created comped Stripe subscription ${subscription.id} for user ${userId}`);

      // Extract subscription dates with proper validation
      let subscriptionStart: Date;
      let subscriptionEnd: Date;

      try {
        // Log the subscription object to see what properties are available
        console.log(`📅 [ADMIN] Subscription object properties:`, {
          id: subscription.id,
          current_period_start: subscription.current_period_start,
          current_period_end: subscription.current_period_end,
          status: subscription.status,
          start_date: subscription.start_date
        });

        if (subscription.current_period_start && subscription.current_period_end) {
          subscriptionStart = new Date(subscription.current_period_start * 1000);
          subscriptionEnd = new Date(subscription.current_period_end * 1000);
        } else {
          // Fallback: Use current date and add 30 days for admin grants
          const now = new Date();
          subscriptionStart = now;
          subscriptionEnd = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days from now
          console.log(`⚠️ [ADMIN] Using fallback dates - Start: ${subscriptionStart.toISOString()}, End: ${subscriptionEnd.toISOString()}`);
        }

        // Validate the dates
        if (isNaN(subscriptionStart.getTime()) || isNaN(subscriptionEnd.getTime())) {
          throw new Error('Invalid subscription dates calculated');
        }

        console.log(`📅 [ADMIN] Final dates - Start: ${subscriptionStart.toISOString()}, End: ${subscriptionEnd.toISOString()}`);

      } catch (dateError) {
        console.error('❌ [ADMIN] Error processing subscription dates:', dateError);
        // Use safe fallback dates
        const now = new Date();
        subscriptionStart = now;
        subscriptionEnd = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));
        console.log(`🔄 [ADMIN] Using safe fallback dates - Start: ${subscriptionStart.toISOString()}, End: ${subscriptionEnd.toISOString()}`);
      }

      // Update profile with subscription data
      await db.profile.update({
        where: { userId },
        data: {
          subscriptionStatus: 'ACTIVE',
          subscriptionStart: subscriptionStart,
          subscriptionEnd: subscriptionEnd,
          stripeCustomerId: customerId,
          stripeSessionId: subscription.id,
          stripeProductId: productId,
          updatedAt: new Date(),
        }
      });

      console.log(`🗄️ [ADMIN] Updated database subscription for user ${userId}`);

    } catch (error) {
      console.error(`❌ [ADMIN] Error in subscription process for user ${userId}:`, error);
      
      // Check if this is a Stripe error or database error
      if (error instanceof Error) {
        if (error.message.includes('Stripe') || error.message.includes('stripe')) {
          console.error('🚨 [ADMIN] Stripe API Error:', error);
          return NextResponse.json({ 
            error: 'Failed to create Stripe subscription',
            message: 'Unable to set up subscription with payment processor. Please try again.'
          }, { status: 500 });
        } else if (error.message.includes('Prisma') || error.message.includes('database')) {
          console.error('🚨 [ADMIN] Database Error:', error);
          return NextResponse.json({ 
            error: 'Failed to save subscription',
            message: 'Subscription was created but failed to save to database. Please contact support.'
          }, { status: 500 });
        }
      }
      
      // General error fallback
      return NextResponse.json({ 
        error: 'Failed to grant subscription',
        message: 'Unable to grant subscription access. Please try again.'
      }, { status: 500 });
    }

    console.log(`✅ [ADMIN] Successfully granted subscription to ${targetProfile.email} by admin ${adminProfile.email}`);

    return NextResponse.json({
      success: true,
      message: 'User has been granted subscription access',
      grantedSubscription: {
        userId: targetProfile.userId,
        email: targetProfile.email,
        name: targetProfile.name,
        customerId: customerId,
      }
    });

  } catch (error) {
    console.error('Error granting subscription:', error);
    trackSuspiciousActivity(request, 'ADMIN_GRANT_ERROR');
    
    return NextResponse.json({ 
      error: 'Failed to grant subscription',
      message: 'Unable to grant subscription access. Please try again later.'
    }, { status: 500 });
  }
}

// Helper function to create or get admin coupon
async function createAdminCoupon() {
  try {
    console.log('🎫 [ADMIN] Looking for existing admin coupon...');
    
    // Try to get existing admin coupon
    const coupons = await stripe.coupons.list({ limit: 100 });
    const adminCoupon = coupons.data.find(c => c.id === 'admin-grant-100-off');
    
    if (adminCoupon && adminCoupon.valid) {
      console.log('🎫 [ADMIN] Using existing admin coupon: admin-grant-100-off');
      return adminCoupon.id;
    }

    console.log('🎫 [ADMIN] Creating new admin coupon...');
    
    // Create new admin coupon if it doesn't exist
    const coupon = await stripe.coupons.create({
      id: 'admin-grant-100-off',
      name: 'Admin Grant - 100% Off',
      percent_off: 100,
      duration: 'forever',
      metadata: {
        type: 'admin_grant',
        description: 'Coupon for admin-granted subscriptions',
        createdAt: new Date().toISOString()
      }
    });

    console.log(`🎫 [ADMIN] Created new admin coupon: ${coupon.id}`);
    return coupon.id;
    
  } catch (error) {
    console.error('🚨 [ADMIN] Error with admin coupon:', error);
    
    // Fallback: create a one-time coupon with timestamp to avoid ID conflicts
    try {
      const timestamp = Date.now();
      const fallbackCoupon = await stripe.coupons.create({
        id: `admin-grant-${timestamp}`,
        name: `Admin Grant - ${timestamp}`,
        percent_off: 100,
        duration: 'forever',
        metadata: {
          type: 'admin_grant_fallback',
          description: 'Fallback admin grant coupon',
          createdAt: new Date().toISOString()
        }
      });
      
      console.log(`🎫 [ADMIN] Created fallback coupon: ${fallbackCoupon.id}`);
      return fallbackCoupon.id;
      
    } catch (fallbackError) {
      console.error('🚨 [ADMIN] Failed to create fallback coupon:', fallbackError);
      throw new Error('Unable to create admin discount coupon');
    }
  }
} 