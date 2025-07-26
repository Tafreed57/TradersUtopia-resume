import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { currentUser } from '@clerk/nextjs/server';
import {
  rateLimitSubscription,
  trackSuspiciousActivity,
} from '@/lib/rate-limit';
import { strictCSRFValidation } from '@/lib/csrf';
import { TRADING_ALERT_PRODUCTS } from '@/lib/product-config';

// Session cache to prevent repeated database calls
const sessionCache = new Map<
  string,
  {
    data: any;
    timestamp: number;
    expiresAt: number;
  }
>();

const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

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

    console.log(`🎯 [PRODUCT-CHECK] Starting check for user: ${user.id}`);

    // ⚡ STEP 1: Check session cache first
    if (sessionCache.has(sessionKey)) {
      const cached = sessionCache.get(sessionKey)!;
      if (now < cached.expiresAt) {
        console.log(
          `⚡ [PRODUCT-CHECK] Using cached session data (age: ${Math.round((now - cached.timestamp) / 1000)}s)`
        );

        return NextResponse.json({
          hasAccess: cached.data.hasAccess,
          reason: cached.data.reason,
          productId: cached.data.productId,
          subscriptionEnd: cached.data.subscriptionEnd,
          foundWithEmail: cached.data.foundWithEmail,
          source: 'session_cache',
          isAdminAccess: cached.data.isAdminAccess,
          cacheHit: true,
          cacheAge: Math.round((now - cached.timestamp) / 1000),
        });
      } else {
        sessionCache.delete(sessionKey);
      }
    }

    console.log(`🔍 [PRODUCT-CHECK] No cache found, checking database`);

    // ⚡ STEP 2: Database lookup
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

      console.log(`👑 [PRODUCT-CHECK] Admin access granted`);
      return NextResponse.json(authData);
    }

    // ⚡ STEP 4: Check subscription status from database
    const hasActiveSubscription =
      profile?.subscriptionStatus === 'ACTIVE' &&
      profile?.subscriptionEnd &&
      new Date() < profile?.subscriptionEnd;

    const hasValidProductAccess =
      hasActiveSubscription &&
      profile?.stripeProductId &&
      TRADING_ALERT_PRODUCTS.includes(profile?.stripeProductId as any);

    // ⚡ STEP 5: Determine access and reason
    let reason: string;
    if (hasValidProductAccess) {
      reason = 'Active subscription with valid product access';
    } else if (hasActiveSubscription) {
      reason = 'Active subscription but invalid product';
    } else if (profile?.subscriptionStatus === 'CANCELLED') {
      reason = 'Subscription cancelled';
    } else if (profile?.subscriptionStatus === 'EXPIRED') {
      reason = 'Subscription expired';
    } else {
      reason = 'No active subscription';
    }

    const authData = {
      hasAccess: hasValidProductAccess,
      reason,
      productId: profile?.stripeProductId,
      subscriptionEnd: profile?.subscriptionEnd?.toISOString() || null,
      foundWithEmail: profile?.email,
      source: 'database_check',
      isAdminAccess: false,
      profile: {
        id: profile?.id,
        email: profile?.email,
        name: profile?.name,
        isAdmin: profile?.isAdmin || false,
      },
    };

    // ⚡ STEP 6: Cache the result
    sessionCache.set(sessionKey, {
      data: authData,
      timestamp: now,
      expiresAt: now + CACHE_DURATION,
    });

    console.log(
      `🎯 [PRODUCT-CHECK] Check complete: ${hasValidProductAccess ? 'ACCESS GRANTED' : 'ACCESS DENIED'} - ${reason}`
    );

    return NextResponse.json(authData);
  } catch (error) {
    console.error('❌ [PRODUCT-CHECK] Error:', error);

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
