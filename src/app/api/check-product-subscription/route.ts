import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { currentUser } from '@clerk/nextjs/server';
import {
  rateLimitSubscription,
  trackSuspiciousActivity,
} from '@/lib/rate-limit';
import { strictCSRFValidation } from '@/lib/csrf';
import { TRADING_ALERT_PRODUCTS } from '@/lib/product-config';
import Stripe from 'stripe';

// Session cache to prevent repeated API calls
const sessionCache = new Map<
  string,
  {
    data: any;
    timestamp: number;
    expiresAt: number;
  }
>();

const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
const STRIPE_CHECK_COOLDOWN = 5 * 60 * 1000; // 5 minutes between Stripe checks

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

    const userEmail = user.primaryEmailAddress?.emailAddress;
    const sessionKey = `auth_${user.id}`;
    const now = Date.now();

    console.log(
      `🎯 [PRODUCT-CHECK-OPTIMIZED] Starting optimized check for user: ${user.id}`
    );

    // ⚡ STEP 1: Check session cache first
    if (sessionCache.has(sessionKey)) {
      const cached = sessionCache.get(sessionKey)!;
      if (now < cached.expiresAt) {
        console.log(
          `⚡ [PRODUCT-CHECK-OPTIMIZED] Using cached session data (age: ${Math.round((now - cached.timestamp) / 1000)}s)`
        );

        return NextResponse.json({
          hasAccess: cached.data.hasAccess,
          reason: cached.data.reason,
          productId: cached.data.stripeProductId,
          subscriptionEnd: cached.data.subscriptionEnd,
          foundWithEmail: cached.data.profile?.email,
          source: 'session_cache',
          isAdminAccess: cached.data.isAdmin,
          dataSource: cached.data.dataSource,
          stripeCallMade: false,
          cacheHit: true,
          cacheAge: Math.round((now - cached.timestamp) / 1000),
        });
      } else {
        sessionCache.delete(sessionKey);
      }
    }

    console.log(
      `🔍 [PRODUCT-CHECK-OPTIMIZED] No cache found, performing comprehensive check`
    );

    // ⚡ STEP 2: Check database first (fastest)
    let profile = await db.profile.findFirst({
      where: {
        OR: [{ userId: user.id }, { email: userEmail }],
      },
    });

    // ⚡ STEP 3: Admin check (highest priority)
    if (profile?.isAdmin) {
      const authData = {
        hasAccess: true,
        reason: 'Admin user - automatic premium access granted',
        productId: 'admin_access',
        subscriptionEnd: null,
        foundWithEmail: profile.email,
        source: 'admin_access',
        isAdminAccess: true,
        dataSource: 'admin_bypass',
        stripeCallMade: false,
        profile: {
          id: profile.id,
          email: profile.email,
          name: profile.name,
          isAdmin: true,
        },
      };

      // Cache admin result
      sessionCache.set(sessionKey, {
        data: authData,
        timestamp: now,
        expiresAt: now + CACHE_DURATION,
      });

      console.log(`👑 [PRODUCT-CHECK-OPTIMIZED] Admin access granted`);
      return NextResponse.json(authData);
    }

    // ⚡ STEP 4: Check for recent database data (avoid Stripe call if recent)
    let needsStripeCheck = true;
    let hasValidDbSubscription = false;

    if (
      profile &&
      profile.subscriptionStatus === 'ACTIVE' &&
      profile.subscriptionEnd
    ) {
      const isActive = new Date() < profile.subscriptionEnd;
      const isRecent =
        profile.updatedAt &&
        now - profile.updatedAt.getTime() < STRIPE_CHECK_COOLDOWN;

      if (
        isActive &&
        isRecent &&
        profile.stripeProductId &&
        TRADING_ALERT_PRODUCTS.includes(profile.stripeProductId as any)
      ) {
        hasValidDbSubscription = true;
        needsStripeCheck = false;
        console.log(
          `📋 [PRODUCT-CHECK-OPTIMIZED] Using recent valid database data, skipping Stripe check`
        );
      }
    }

    let stripeCallMade = false;
    let subscriptionStatus: 'ACTIVE' | 'CANCELLED' | 'EXPIRED' | 'FREE' =
      'FREE';
    let subscriptionStart: Date | null = null;
    let subscriptionEnd: Date | null = null;
    let stripeProductId: string | null = null;
    let stripeCustomerId: string | null = null;
    let dataSource = 'database';

    // ⚡ STEP 5: Comprehensive Stripe check (only if needed)
    if (needsStripeCheck && userEmail) {
      console.log(
        `🔄 [PRODUCT-CHECK-OPTIMIZED] Making ONE comprehensive Stripe check...`
      );
      stripeCallMade = true;
      dataSource = 'stripe_comprehensive';

      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

      try {
        // Single comprehensive API call
        const customers = await stripe.customers.list({
          email: userEmail,
          limit: 1,
          expand: ['data.subscriptions'],
        });

        if (customers.data.length > 0) {
          const customer = customers.data[0];
          stripeCustomerId = customer.id;

          // Check expanded subscription data
          const expandedCustomer = customer as any;
          if (expandedCustomer.subscriptions?.data?.length > 0) {
            const activeSubscription = expandedCustomer.subscriptions.data.find(
              (sub: any) => sub.status === 'active' || sub.status === 'trialing'
            );

            if (activeSubscription) {
              subscriptionStatus = 'ACTIVE';

              // ✅ FIXED: Better subscription date extraction with logging
              if (
                activeSubscription.current_period_start &&
                activeSubscription.current_period_end
              ) {
                subscriptionStart = new Date(
                  activeSubscription.current_period_start * 1000
                );
                subscriptionEnd = new Date(
                  activeSubscription.current_period_end * 1000
                );
                console.log(
                  `📅 [PRODUCT-CHECK-OPTIMIZED] Subscription period: ${subscriptionStart.toISOString()} to ${subscriptionEnd.toISOString()}`
                );
              } else {
                // Fallback: Set subscription end to 30 days from now if dates not available
                subscriptionStart = new Date();
                subscriptionEnd = new Date(
                  Date.now() + 30 * 24 * 60 * 60 * 1000
                );
                console.log(
                  `⚠️ [PRODUCT-CHECK-OPTIMIZED] Using fallback dates - subscription period data not available`
                );
              }

              if (activeSubscription.items?.data?.[0]?.price?.product) {
                stripeProductId = activeSubscription.items.data[0].price
                  .product as string;
              }

              console.log(
                `✅ [PRODUCT-CHECK-OPTIMIZED] Found active subscription: ${activeSubscription.id} for product: ${stripeProductId}`
              );
            } else {
              console.log(
                `⚠️ [PRODUCT-CHECK-OPTIMIZED] Customer exists but no active subscription`
              );
            }
          }
        } else {
          console.log(
            `❌ [PRODUCT-CHECK-OPTIMIZED] No Stripe customer found for: ${userEmail}`
          );
        }
      } catch (stripeError) {
        console.error(
          `❌ [PRODUCT-CHECK-OPTIMIZED] Stripe API error:`,
          stripeError
        );
        dataSource = 'database_fallback';
      }
    } else if (hasValidDbSubscription) {
      // Use valid database data
      subscriptionStatus = profile!.subscriptionStatus as any;
      subscriptionStart = profile!.subscriptionStart;
      subscriptionEnd = profile!.subscriptionEnd;
      stripeProductId = profile!.stripeProductId;
      stripeCustomerId = profile!.stripeCustomerId;
      dataSource = 'database_recent';
    }

    // ⚡ STEP 6: Update database with latest data (only if Stripe call was made)
    if (stripeCallMade || !profile) {
      if (!profile) {
        profile = await db.profile.create({
          data: {
            userId: user.id,
            name: `${user.firstName} ${user.lastName}`,
            email: userEmail || '',
            imageUrl: user.imageUrl || '',
            subscriptionStatus,
            subscriptionStart,
            subscriptionEnd,
            stripeCustomerId,
            stripeProductId,
            updatedAt: new Date(),
          },
        });
        console.log(`✅ [PRODUCT-CHECK-OPTIMIZED] Created new profile`);
      } else if (stripeCallMade) {
        profile = await db.profile.update({
          where: { id: profile.id },
          data: {
            subscriptionStatus,
            subscriptionStart,
            subscriptionEnd,
            stripeCustomerId,
            stripeProductId,
            updatedAt: new Date(),
          },
        });
        console.log(
          `✅ [PRODUCT-CHECK-OPTIMIZED] Updated profile with Stripe data`
        );
      }
    }

    // ⚡ STEP 7: Determine final access status
    const hasActiveSubscription =
      subscriptionStatus === 'ACTIVE' &&
      subscriptionEnd &&
      new Date() < subscriptionEnd;

    const hasValidProductAccess =
      hasActiveSubscription &&
      stripeProductId &&
      TRADING_ALERT_PRODUCTS.includes(stripeProductId as any);

    const authData = {
      hasAccess: hasValidProductAccess,
      reason: hasValidProductAccess
        ? 'Active subscription with valid product access'
        : hasActiveSubscription
          ? 'Active subscription but invalid product'
          : subscriptionStatus === 'CANCELLED'
            ? 'Subscription cancelled'
            : 'No active subscription',
      productId: stripeProductId,
      subscriptionEnd: subscriptionEnd?.toISOString() || null,
      foundWithEmail: profile.email,
      source: 'optimized_check',
      isAdminAccess: false,
      dataSource,
      stripeCallMade,
      profile: {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        isAdmin: profile.isAdmin || false,
      },
    };

    // ⚡ STEP 8: Cache the result
    sessionCache.set(sessionKey, {
      data: authData,
      timestamp: now,
      expiresAt: now + CACHE_DURATION,
    });

    console.log(
      `🎯 [PRODUCT-CHECK-OPTIMIZED] Complete check finished: ${hasValidProductAccess ? 'ACCESS GRANTED' : 'ACCESS DENIED'}`
    );
    console.log(
      `🔄 [PRODUCT-CHECK-OPTIMIZED] Stripe API call made: ${stripeCallMade ? 'YES' : 'NO'}`
    );

    return NextResponse.json(authData);
  } catch (error) {
    console.error('❌ [PRODUCT-CHECK-OPTIMIZED] Error:', error);

    return NextResponse.json(
      {
        hasAccess: false,
        reason: 'Product access check failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        productId: null,
        source: 'error',
      },
      { status: 500 }
    );
  }
}
