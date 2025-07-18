import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db } from '@/lib/db';
import { currentUser } from '@clerk/nextjs/server';
import {
  rateLimitSubscription,
  trackSuspiciousActivity,
} from '@/lib/rate-limit';
import { strictCSRFValidation } from '@/lib/csrf';
import {
  validateInputSimple,
  productSubscriptionSchema,
} from '@/lib/validation';
import { TRADING_ALERT_PRODUCTS } from '@/lib/product-config';

export async function POST(request: NextRequest) {
  try {
    // ✅ SECURITY: CSRF and Rate limiting
    const csrfValid = await strictCSRFValidation(request);
    if (!csrfValid) {
      trackSuspiciousActivity(request, 'PRODUCT_CHECK_CSRF_FAILED');
      return NextResponse.json(
        {
          error: 'CSRF validation failed',
          hasAccess: false,
          reason: 'Security check failed',
        },
        { status: 403 }
      );
    }

    // Rate limiting for subscription checks
    const rateLimitResult = await rateLimitSubscription()(request);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(request, 'PRODUCT_CHECK_RATE_LIMITED');
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          hasAccess: false,
          reason: 'Too many requests',
        },
        { status: 429 }
      );
    }

    // ✅ AUTHENTICATION: Get current user
    const user = await currentUser();
    if (!user) {
      return NextResponse.json(
        {
          error: 'Not authenticated',
          hasAccess: false,
          reason: 'User not signed in',
        },
        { status: 401 }
      );
    }

    // ✅ INPUT VALIDATION: Get and validate product IDs
    const body = await request.json();

    // ✅ UPDATED: Use client-safe product IDs as default
    const allowedProductIds = body.allowedProductIds || TRADING_ALERT_PRODUCTS;

    const validatedData = validateInputSimple(productSubscriptionSchema, {
      allowedProductIds,
    });

    console.log(
      '🎯 [PRODUCT-CHECK] Starting webhook-only subscription verification...'
    );
    console.log('🎯 [PRODUCT-CHECK] User ID:', user.id);
    console.log(
      '🎯 [PRODUCT-CHECK] User Primary Email:',
      user.primaryEmailAddress?.emailAddress
    );
    console.log(
      '🎯 [PRODUCT-CHECK] All User Emails:',
      user.emailAddresses.map(e => e.emailAddress)
    );
    console.log(
      '🎯 [PRODUCT-CHECK] Checking products:',
      validatedData.allowedProductIds
    );

    // ✅ STEP 0: Check if user is admin first - admins get automatic premium access
    console.log('🔑 [STEP 0] Checking if user is admin...');

    const adminProfile = await db.profile.findFirst({
      where: {
        userId: user.id,
        isAdmin: true,
      },
    });

    if (adminProfile) {
      console.log(
        '✅ [STEP 0] Admin user detected - granting automatic premium access:',
        {
          email: adminProfile.email,
          adminStatus: true,
        }
      );

      return NextResponse.json({
        hasAccess: true,
        reason: 'Admin user - automatic premium access granted',
        productId: 'admin_access',
        subscriptionEnd: null, // Admins don't have subscription end dates
        foundWithEmail: adminProfile.email,
        searchedEmails: user.emailAddresses.map(e => e.emailAddress),
        source: 'admin_bypass',
        isAdminAccess: true,
      });
    }

    console.log(
      '❌ [STEP 0] User is not admin, proceeding with subscription checks'
    );

    // ✅ WEBHOOK-ONLY: Check database for active subscription using cached data
    console.log(
      '🔍 [STEP 1] Checking webhook-cached database for active subscription...'
    );

    const profilesWithSubscription = await db.profile.findMany({
      where: {
        userId: user.id,
        subscriptionStatus: 'ACTIVE',
        subscriptionEnd: {
          gt: new Date(),
        },
        stripeProductId: {
          in: validatedData.allowedProductIds,
        },
      },
      orderBy: {
        subscriptionEnd: 'desc', // Get the latest subscription
      },
    });

    if (profilesWithSubscription.length > 0) {
      const profile = profilesWithSubscription[0];
      console.log(
        '✅ [STEP 1] Found active subscription in webhook-cached database:',
        {
          productId: profile.stripeProductId,
          subscriptionEnd: profile.subscriptionEnd,
          email: profile.email,
          lastWebhookUpdate: profile.lastWebhookUpdate,
          subscriptionAmount: profile.subscriptionAmount,
          currency: profile.subscriptionCurrency,
          interval: profile.subscriptionInterval,
          autoRenew: profile.subscriptionAutoRenew,
        }
      );

      return NextResponse.json({
        hasAccess: true,
        reason: 'Valid subscription found in webhook-cached database',
        productId: profile.stripeProductId,
        subscriptionEnd: profile.subscriptionEnd,
        foundWithEmail: profile.email,
        searchedEmails: user.emailAddresses.map(e => e.emailAddress),
        source: 'webhook_cached',
        // ✅ NEW: Additional cached subscription details
        subscriptionDetails: {
          amount: profile.subscriptionAmount,
          currency: profile.subscriptionCurrency,
          interval: profile.subscriptionInterval,
          autoRenew: profile.subscriptionAutoRenew,
          discountPercent: profile.discountPercent,
          discountName: profile.discountName,
          lastWebhookUpdate: profile.lastWebhookUpdate,
        },
        performanceNote: 'Served from webhook cache - no Stripe API calls made',
      });
    }

    console.log(
      '❌ [STEP 1] No active subscription found in webhook-cached database'
    );

    // ✅ WEBHOOK-ONLY: Check for any profile with Stripe connection (for manual sync option)
    const profileWithStripeConnection = await db.profile.findFirst({
      where: {
        userId: user.id,
        stripeCustomerId: {
          not: null,
        },
      },
    });

    if (profileWithStripeConnection) {
      console.log(
        'ℹ️ [STEP 2] User has Stripe connection but no active cached subscription'
      );

      return NextResponse.json({
        hasAccess: false,
        reason:
          'No active subscription found in cached data - try manual sync if needed',
        searchedEmails: user.emailAddresses.map(e => e.emailAddress),
        source: 'webhook_cached',
        hasStripeConnection: true,
        customerId: profileWithStripeConnection.stripeCustomerId,
        lastWebhookUpdate: profileWithStripeConnection.lastWebhookUpdate,
        syncSuggestion:
          'If you recently subscribed, try refreshing or contact support',
        performanceNote: 'Served from webhook cache - no Stripe API calls made',
      });
    }

    // ✅ WEBHOOK-ONLY: No Stripe connection found
    console.log('❌ [STEP 2] No Stripe connection found for user');

    return NextResponse.json({
      hasAccess: false,
      reason: 'No subscription or Stripe connection found',
      searchedEmails: user.emailAddresses.map(e => e.emailAddress),
      source: 'webhook_cached',
      hasStripeConnection: false,
      performanceNote: 'Served from webhook cache - no Stripe API calls made',
    });
  } catch (error) {
    console.error(
      '❌ [PRODUCT-CHECK] Error in webhook-only subscription check:',
      error
    );
    return NextResponse.json(
      {
        hasAccess: false,
        reason: 'Error checking subscription',
        source: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
