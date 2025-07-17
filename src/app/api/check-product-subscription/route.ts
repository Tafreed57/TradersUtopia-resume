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
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

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
      '🎯 [PRODUCT-CHECK] Starting comprehensive subscription verification...'
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

    // ✅ STEP 1: Quick database check for active subscription
    console.log('🔍 [STEP 1] Checking database for active subscription...');

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
      console.log('✅ [STEP 1] Found active subscription in database:', {
        productId: profile.stripeProductId,
        subscriptionEnd: profile.subscriptionEnd,
        email: profile.email,
      });

      return NextResponse.json({
        hasAccess: true,
        reason: 'Valid subscription found in database',
        productId: profile.stripeProductId,
        subscriptionEnd: profile.subscriptionEnd,
        foundWithEmail: profile.email,
        searchedEmails: user.emailAddresses.map(e => e.emailAddress),
        source: 'database',
      });
    }

    console.log('❌ [STEP 1] No active subscription found in database');

    // ✅ STEP 2: Comprehensive Stripe verification (handles database wipes & email mismatches)
    console.log('🔍 [STEP 2] Performing comprehensive Stripe verification...');

    // Get all user email addresses for comprehensive search
    const allUserEmails = user.emailAddresses.map(e => e.emailAddress);
    console.log('📧 [STEP 2] Searching Stripe with emails:', allUserEmails);

    let stripeSubscription = null;
    let foundWithEmail = null;

    // Search for subscriptions using all user email addresses
    for (const email of allUserEmails) {
      try {
        console.log(`🔍 [STEP 2] Searching Stripe for email: ${email}`);

        // Find customers with this email
        const customers = await stripe.customers.list({
          email: email,
          limit: 10,
        });

        console.log(
          `📊 [STEP 2] Found ${customers.data.length} Stripe customers for ${email}`
        );

        for (const customer of customers.data) {
          // Get active subscriptions for this customer
          const subscriptions = await stripe.subscriptions.list({
            customer: customer.id,
            status: 'active',
            limit: 10,
          });

          console.log(
            `📊 [STEP 2] Found ${subscriptions.data.length} active subscriptions for customer ${customer.id}`
          );

          // Check if any subscription matches our product IDs
          for (const subscription of subscriptions.data) {
            const productIds = subscription.items.data.map(
              item => item.price.product as string
            );
            console.log(
              `🔍 [STEP 2] Subscription ${subscription.id} has products:`,
              productIds
            );

            // Check if subscription has any of our allowed products
            const hasAllowedProduct = productIds.some(productId =>
              validatedData.allowedProductIds.includes(productId)
            );

            if (hasAllowedProduct) {
              stripeSubscription = subscription;
              foundWithEmail = email;
              console.log(
                `✅ [STEP 2] Found matching subscription ${subscription.id} for email ${email}`
              );
              break;
            }
          }

          if (stripeSubscription) break;
        }

        if (stripeSubscription) break;
      } catch (stripeError) {
        console.warn(
          `⚠️ [STEP 2] Stripe search failed for email ${email}:`,
          stripeError
        );
        continue;
      }
    }

    if (!stripeSubscription) {
      console.log(
        '❌ [STEP 2] No valid Stripe subscription found for any email'
      );
      return NextResponse.json({
        hasAccess: false,
        reason: 'No valid subscription found in Stripe',
        searchedEmails: allUserEmails,
        source: 'stripe_comprehensive',
      });
    }

    // ✅ STEP 3: Sync valid Stripe subscription to database
    console.log('🔄 [STEP 3] Syncing valid Stripe subscription to database...');

    try {
      const subscriptionProductIds = stripeSubscription.items.data.map(
        item => item.price.product as string
      );
      const matchingProductId = subscriptionProductIds.find(id =>
        validatedData.allowedProductIds.includes(id)
      );

      if (!matchingProductId) {
        throw new Error('No matching product ID found in subscription');
      }

      // ✅ ENHANCED: Proper date handling for subscription end
      let subscriptionEndDate: Date;
      const currentPeriodEnd = (stripeSubscription as any).current_period_end;

      if (currentPeriodEnd && typeof currentPeriodEnd === 'number') {
        // Stripe timestamps are in seconds, convert to milliseconds
        subscriptionEndDate = new Date(currentPeriodEnd * 1000);
        console.log(
          '📅 [STEP 3] Using Stripe period end:',
          subscriptionEndDate.toISOString()
        );
      } else {
        // Fallback: 30 days from now
        subscriptionEndDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        console.log(
          '📅 [STEP 3] Using 30-day fallback:',
          subscriptionEndDate.toISOString()
        );
      }

      // Validate the date before using it
      if (isNaN(subscriptionEndDate.getTime())) {
        throw new Error('Failed to create valid subscription end date');
      }

      // Update or create profile with subscription data
      const updatedProfile = await db.profile.upsert({
        where: {
          userId: user.id,
        },
        update: {
          subscriptionStatus: 'ACTIVE',
          subscriptionEnd: subscriptionEndDate,
          stripeProductId: matchingProductId,
          stripeCustomerId: stripeSubscription.customer as string,
          email: foundWithEmail || user.primaryEmailAddress?.emailAddress || '',
        },
        create: {
          userId: user.id,
          name: user.firstName || user.username || 'Unknown',
          imageUrl: user.imageUrl || '',
          email: foundWithEmail || user.primaryEmailAddress?.emailAddress || '',
          subscriptionStatus: 'ACTIVE',
          subscriptionEnd: subscriptionEndDate,
          stripeProductId: matchingProductId,
          stripeCustomerId: stripeSubscription.customer as string,
        },
      });

      console.log('✅ [STEP 3] Successfully synced subscription to database:', {
        productId: matchingProductId,
        subscriptionEnd: updatedProfile.subscriptionEnd,
        foundWithEmail,
      });

      return NextResponse.json({
        hasAccess: true,
        reason: 'Valid subscription found in Stripe and synced to database',
        productId: matchingProductId,
        subscriptionEnd: updatedProfile.subscriptionEnd,
        foundWithEmail,
        searchedEmails: allUserEmails,
        source: 'stripe_sync',
      });
    } catch (syncError) {
      console.error(
        '❌ [STEP 3] Failed to sync subscription to database:',
        syncError
      );

      // Return access anyway since Stripe verification passed
      const subscriptionProductIds = stripeSubscription.items.data.map(
        item => item.price.product as string
      );
      const matchingProductId = subscriptionProductIds.find(id =>
        validatedData.allowedProductIds.includes(id)
      );

      // Create fallback end date for response
      const fallbackEndDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      return NextResponse.json({
        hasAccess: true,
        reason: 'Valid subscription found in Stripe (database sync failed)',
        productId: matchingProductId,
        subscriptionEnd: fallbackEndDate,
        foundWithEmail,
        searchedEmails: allUserEmails,
        source: 'stripe_only',
        warning: 'Database sync failed',
      });
    }
  } catch (error) {
    console.error(
      '❌ [PRODUCT-CHECK] Comprehensive verification failed:',
      error
    );

    trackSuspiciousActivity(request, 'PRODUCT_CHECK_ERROR');

    // Return detailed error information for debugging
    if (error instanceof Error) {
      if (error.message.includes('CSRF')) {
        return NextResponse.json(
          {
            error: 'CSRF validation failed',
            hasAccess: false,
            reason: 'Security check failed',
          },
          { status: 403 }
        );
      }

      if (error.message.includes('validation')) {
        return NextResponse.json(
          {
            error: 'Invalid input',
            hasAccess: false,
            reason: 'Invalid request data',
          },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      {
        error: 'Internal server error',
        hasAccess: false,
        reason: 'Verification system error',
      },
      { status: 500 }
    );
  }
}
