import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import Stripe from 'stripe';
import { rateLimitGeneral, trackSuspiciousActivity } from '@/lib/rate-limit';
import { strictCSRFValidation } from '@/lib/csrf';
import { TRADING_ALERT_PRODUCTS } from '@/lib/product-config';

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
      trackSuspiciousActivity(request, 'SESSION_CHECK_CSRF_FAILED');
      return NextResponse.json(
        { error: 'CSRF validation failed' },
        { status: 403 }
      );
    }

    const rateLimitResult = await rateLimitGeneral()(request);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(request, 'SESSION_CHECK_RATE_LIMITED');
      return rateLimitResult.error;
    }

    const user = await currentUser();
    if (!user) {
      return NextResponse.json(
        {
          isAuthenticated: false,
          hasAccess: false,
          reason: 'Not signed in',
          cached: false,
        },
        { status: 401 }
      );
    }

    const userEmail = user.emailAddresses[0]?.emailAddress;
    if (!userEmail) {
      return NextResponse.json(
        {
          isAuthenticated: true,
          hasAccess: false,
          reason: 'No email found',
          cached: false,
        },
        { status: 400 }
      );
    }

    const sessionKey = `auth_${user.id}`;
    const now = Date.now();

    // ⚡ STEP 1: Check session cache first
    if (sessionCache.has(sessionKey)) {
      const cached = sessionCache.get(sessionKey)!;
      if (now < cached.expiresAt) {
        console.log(`⚡ [SESSION-AUTH] Using cached data for: ${userEmail}`);
        return NextResponse.json({
          ...cached.data,
          cached: true,
          cacheAge: Math.round((now - cached.timestamp) / 1000),
        });
      } else {
        sessionCache.delete(sessionKey);
      }
    }

    console.log(
      `🔍 [SESSION-AUTH] Starting comprehensive auth check for: ${userEmail}`
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
        isAuthenticated: true,
        hasAccess: true,
        isAdmin: true,
        reason: 'Admin user - automatic access',
        subscriptionStatus: 'ADMIN',
        subscriptionEnd: null,
        stripeProductId: 'admin_access',
        profile: {
          id: profile.id,
          email: profile.email,
          name: profile.name,
          isAdmin: true,
        },
        dataSource: 'admin_bypass',
        stripeCallMade: false,
      };

      // Cache admin result
      sessionCache.set(sessionKey, {
        data: authData,
        timestamp: now,
        expiresAt: now + CACHE_DURATION,
      });

      console.log(`👑 [SESSION-AUTH] Admin access granted to: ${userEmail}`);
      return NextResponse.json({ ...authData, cached: false });
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

      if (isActive && isRecent) {
        hasValidDbSubscription = true;
        needsStripeCheck = false;
        console.log(
          `📋 [SESSION-AUTH] Using recent database data, skipping Stripe check`
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
    if (needsStripeCheck) {
      console.log(`🔄 [SESSION-AUTH] Making ONE comprehensive Stripe check...`);
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
              const subscriptionWithPeriods = activeSubscription as any;

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
              }

              if (activeSubscription.items?.data?.[0]?.price?.product) {
                stripeProductId = activeSubscription.items.data[0].price
                  .product as string;
              }

              console.log(
                `✅ [SESSION-AUTH] Found active subscription: ${activeSubscription.id}`
              );
            } else {
              console.log(
                `⚠️ [SESSION-AUTH] Customer exists but no active subscription`
              );
            }
          }
        } else {
          console.log(
            `❌ [SESSION-AUTH] No Stripe customer found for: ${userEmail}`
          );
        }
      } catch (stripeError) {
        console.error(`❌ [SESSION-AUTH] Stripe API error:`, stripeError);
        // Continue with database data if Stripe fails
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
            email: userEmail,
            imageUrl: user.imageUrl || '',
            subscriptionStatus,
            subscriptionStart,
            subscriptionEnd,
            stripeCustomerId,
            stripeProductId,
            lastStripeCheck: new Date(),
            updatedAt: new Date(),
          },
        });
        console.log(`✅ [SESSION-AUTH] Created new profile`);
      } else if (stripeCallMade) {
        profile = await db.profile.update({
          where: { id: profile.id },
          data: {
            subscriptionStatus,
            subscriptionStart,
            subscriptionEnd,
            stripeCustomerId,
            stripeProductId,
            lastStripeCheck: new Date(),
            updatedAt: new Date(),
          },
        });
        console.log(`✅ [SESSION-AUTH] Updated profile with Stripe data`);
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
      TRADING_ALERT_PRODUCTS.includes(stripeProductId);

    const authData = {
      isAuthenticated: true,
      hasAccess: hasValidProductAccess,
      isAdmin: false,
      reason: hasValidProductAccess
        ? 'Active subscription with valid product access'
        : hasActiveSubscription
          ? 'Active subscription but invalid product'
          : subscriptionStatus === 'CANCELLED'
            ? 'Subscription cancelled'
            : 'No active subscription',
      subscriptionStatus,
      subscriptionStart: subscriptionStart?.toISOString() || null,
      subscriptionEnd: subscriptionEnd?.toISOString() || null,
      stripeProductId,
      stripeCustomerId,
      profile: {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        isAdmin: profile.isAdmin || false,
      },
      dataSource,
      stripeCallMade,
      validProducts: TRADING_ALERT_PRODUCTS,
    };

    // ⚡ STEP 8: Cache the result
    sessionCache.set(sessionKey, {
      data: authData,
      timestamp: now,
      expiresAt: now + CACHE_DURATION,
    });

    console.log(
      `🎯 [SESSION-AUTH] Complete auth check finished for: ${userEmail}`
    );
    console.log(
      `📊 [SESSION-AUTH] Result: ${hasValidProductAccess ? 'ACCESS GRANTED' : 'ACCESS DENIED'}`
    );
    console.log(
      `🔄 [SESSION-AUTH] Stripe API call made: ${stripeCallMade ? 'YES' : 'NO'}`
    );

    return NextResponse.json({ ...authData, cached: false });
  } catch (error) {
    console.error('❌ [SESSION-AUTH] Error:', error);
    return NextResponse.json(
      {
        isAuthenticated: false,
        hasAccess: false,
        reason: 'Authentication check failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        cached: false,
      },
      { status: 500 }
    );
  }
}

// Cleanup expired cache entries periodically
setInterval(
  () => {
    const now = Date.now();
    for (const [key, value] of sessionCache.entries()) {
      if (now > value.expiresAt) {
        sessionCache.delete(key);
      }
    }
  },
  10 * 60 * 1000
); // Cleanup every 10 minutes
