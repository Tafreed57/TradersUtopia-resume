import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import Stripe from 'stripe';
import {
  rateLimitSubscription,
  trackSuspiciousActivity,
} from '@/lib/rate-limit';
import { strictCSRFValidation } from '@/lib/csrf';

export async function POST(request: NextRequest) {
  try {
    // ✅ SECURITY: CSRF and Rate limiting
    const csrfValid = await strictCSRFValidation(request);
    if (!csrfValid) {
      trackSuspiciousActivity(request, 'FORCE_SYNC_CSRF_FAILED');
      return NextResponse.json(
        { error: 'CSRF validation failed' },
        { status: 403 }
      );
    }

    const rateLimitResult = await rateLimitSubscription()(request);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(request, 'FORCE_SYNC_RATE_LIMITED');
      return rateLimitResult.error;
    }

    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const userEmail = user.emailAddresses[0]?.emailAddress;
    if (!userEmail) {
      return NextResponse.json({ error: 'No email found' }, { status: 400 });
    }

    console.log(`🔧 [FORCE-SYNC] Starting manual sync for: ${userEmail}`);

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

    // Find user's profile
    let profile = await db.profile.findFirst({
      where: {
        OR: [{ userId: user.id }, { email: userEmail }],
      },
    });

    // Step 1: Find customer in Stripe
    const customers = await stripe.customers.list({
      email: userEmail,
      limit: 1,
    });

    if (customers.data.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No Stripe customer found for this email',
        message: 'You need to complete a purchase first',
      });
    }

    const customer = customers.data[0];
    console.log(`👤 [FORCE-SYNC] Found customer: ${customer.id}`);

    // Step 2: Get all subscriptions for this customer
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'all',
      limit: 10,
    });

    console.log(
      `📋 [FORCE-SYNC] Found ${subscriptions.data.length} subscriptions`
    );

    // Step 3: Find active subscription
    const activeSubscription = subscriptions.data.find(
      sub => sub.status === 'active' || sub.status === 'trialing'
    );

    let subscriptionStatus: 'ACTIVE' | 'CANCELLED' | 'EXPIRED' | 'FREE' =
      'FREE';
    let subscriptionStart: Date | null = null;
    let subscriptionEnd: Date | null = null;
    let stripeProductId: string | null = null;
    let stripeSubscriptionId: string | null = null;

    if (activeSubscription) {
      console.log(
        `✅ [FORCE-SYNC] Found active subscription: ${activeSubscription.id}`
      );

      subscriptionStatus = 'ACTIVE';
      stripeSubscriptionId = activeSubscription.id;

      // Get subscription dates
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

      // Get product ID
      if (activeSubscription.items?.data?.[0]?.price?.product) {
        stripeProductId = activeSubscription.items.data[0].price
          .product as string;
      }

      console.log(`📦 [FORCE-SYNC] Product ID: ${stripeProductId}`);
      console.log(
        `📅 [FORCE-SYNC] Subscription ends: ${subscriptionEnd?.toISOString()}`
      );
    } else {
      console.log(`❌ [FORCE-SYNC] No active subscription found`);

      // Check for any subscription with successful payments
      const anySubscription = subscriptions.data[0];
      if (anySubscription && anySubscription.items?.data?.[0]?.price?.product) {
        stripeProductId = anySubscription.items.data[0].price.product as string;
        console.log(
          `💳 [FORCE-SYNC] Found product from payment history: ${stripeProductId}`
        );
      }
    }

    // Step 4: Create or update profile
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
          stripeCustomerId: customer.id,
          stripeProductId,
          stripeSubscriptionId,
          updatedAt: new Date(),
        },
      });
      console.log(`✅ [FORCE-SYNC] Created new profile`);
    } else {
      profile = await db.profile.update({
        where: { id: profile.id },
        data: {
          subscriptionStatus,
          subscriptionStart,
          subscriptionEnd,
          stripeCustomerId: customer.id,
          stripeProductId,
          stripeSubscriptionId,
          updatedAt: new Date(),
        },
      });
      console.log(`✅ [FORCE-SYNC] Updated existing profile`);
    }

    return NextResponse.json({
      success: true,
      message:
        subscriptionStatus === 'ACTIVE'
          ? '✅ Active subscription found and access granted!'
          : '⚠️ No active subscription found, but profile updated with payment history',
      profile: {
        subscriptionStatus: profile.subscriptionStatus,
        subscriptionEnd: profile.subscriptionEnd,
        stripeProductId: profile.stripeProductId,
        hasAccess:
          profile.subscriptionStatus === 'ACTIVE' &&
          profile.subscriptionEnd &&
          new Date() < profile.subscriptionEnd,
      },
      stripeData: {
        customerId: customer.id,
        subscriptionsFound: subscriptions.data.length,
        activeSubscription: !!activeSubscription,
      },
    });
  } catch (error) {
    console.error('❌ [FORCE-SYNC] Error:', error);
    return NextResponse.json(
      {
        error: 'Force sync failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
