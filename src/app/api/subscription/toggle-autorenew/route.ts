import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import Stripe from 'stripe';
import { createNotification } from '@/lib/notifications';
import {
  rateLimitSubscription,
  trackSuspiciousActivity,
} from '@/lib/rate-limit';
import {
  validateInput,
  autoRenewalSchema,
  secureTextInput,
} from '@/lib/validation';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  try {
    // ✅ SECURITY: Rate limiting for subscription operations
    const rateLimitResult = await rateLimitSubscription()(request);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(request, 'AUTORENEW_RATE_LIMIT_EXCEEDED');
      return rateLimitResult.error;
    }

    // ✅ SECURITY: Authentication check
    const user = await currentUser();
    if (!user) {
      trackSuspiciousActivity(request, 'UNAUTHENTICATED_AUTORENEW_ACCESS');
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // ✅ SECURITY: Input validation
    const validationResult = await validateInput(autoRenewalSchema)(request);
    if (!validationResult.success) {
      trackSuspiciousActivity(request, 'INVALID_AUTORENEW_INPUT');
      return validationResult.error;
    }

    const { autoRenew } = validationResult.data;

    // Find the user's profile
    const profile = await db.profile.findFirst({
      where: { userId: user.id },
    });

    if (!profile) {
      trackSuspiciousActivity(request, 'AUTORENEW_PROFILE_NOT_FOUND');
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    if (!profile.stripeCustomerId) {
      return NextResponse.json(
        { error: 'No Stripe customer found' },
        { status: 400 }
      );
    }

    // ✅ SECURITY: Enhanced Stripe API interaction with error handling
    let subscriptions;
    try {
      // Get active subscriptions
      subscriptions = await stripe.subscriptions.list({
        customer: profile.stripeCustomerId,
        status: 'active',
        limit: 1,
      });
    } catch (stripeError) {
      trackSuspiciousActivity(request, 'STRIPE_API_ERROR');
      return NextResponse.json(
        {
          error: 'Failed to access subscription data',
          message: 'Service temporarily unavailable',
        },
        { status: 503 }
      );
    }

    if (subscriptions.data.length === 0) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 400 }
      );
    }

    const subscription = subscriptions.data[0];

    // ✅ SECURITY: Enhanced Stripe operation with error handling
    let updatedSubscription;
    try {
      // Update the subscription in Stripe
      updatedSubscription = await stripe.subscriptions.update(subscription.id, {
        cancel_at_period_end: !autoRenew, // If autoRenew is true, don't cancel at period end
      });
    } catch (stripeError) {
      trackSuspiciousActivity(request, 'STRIPE_UPDATE_ERROR');
      return NextResponse.json(
        {
          error: 'Failed to update subscription',
          message: 'Could not modify auto-renewal setting',
        },
        { status: 500 }
      );
    }

    // ✅ SECURITY: Safe access to current_period_end with proper validation
    // Try subscription level first, then fall back to subscription item level (same pattern as sync/cancel routes)
    let periodEndTimestamp = (updatedSubscription as any).current_period_end;

    // If not found at subscription level, check subscription items
    if (!periodEndTimestamp && subscription.items?.data?.[0]) {
      periodEndTimestamp = subscription.items.data[0].current_period_end;
    }

    // Validate timestamp before creating date
    if (!periodEndTimestamp || typeof periodEndTimestamp !== 'number') {
      return NextResponse.json(
        {
          error: 'Invalid subscription period data',
          message: 'Unable to determine subscription end date',
        },
        { status: 400 }
      );
    }

    const periodEndDate = new Date(periodEndTimestamp * 1000);

    // Validate the resulting date
    if (isNaN(periodEndDate.getTime())) {
      return NextResponse.json(
        {
          error: 'Invalid subscription period data',
          message: 'Unable to calculate subscription end date',
        },
        { status: 400 }
      );
    }

    // Create notification
    await createNotification({
      userId: user.id,
      type: 'PAYMENT',
      title: `Auto-renewal ${autoRenew ? 'Re-enabled' : 'Disabled'}`,
      message: autoRenew
        ? `🎉 Great! Your subscription will now automatically renew on ${periodEndDate.toLocaleDateString()}. You're all set!`
        : `Auto-renewal disabled. Your subscription remains active until ${periodEndDate.toLocaleDateString()}. You can re-enable anytime before then.`,
    });

    return NextResponse.json({
      success: true,
      autoRenew: !(updatedSubscription as any).cancel_at_period_end,
      message: `Auto-renewal ${autoRenew ? 'enabled' : 'disabled'} successfully`,
      subscription: {
        id: updatedSubscription.id,
        cancelAtPeriodEnd: (updatedSubscription as any).cancel_at_period_end,
        currentPeriodEnd: periodEndDate,
      },
    });
  } catch (error) {
    trackSuspiciousActivity(request, 'AUTORENEW_OPERATION_ERROR');

    // ✅ SECURITY: Don't expose detailed error information
    return NextResponse.json(
      {
        error: 'Failed to toggle auto-renewal',
        message: 'An internal error occurred. Please try again later.',
      },
      { status: 500 }
    );
  }
}
