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
  subscriptionCancelSchema,
  secureTextInput,
} from '@/lib/validation';
import { strictCSRFValidation } from '@/lib/csrf';

export async function POST(request: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  try {
    // ✅ SECURITY: CSRF protection for subscription operations
    const csrfValid = await strictCSRFValidation(request);
    if (!csrfValid) {
      trackSuspiciousActivity(request, 'SUBSCRIPTION_CSRF_VALIDATION_FAILED');
      return NextResponse.json(
        {
          error: 'CSRF validation failed',
          message: 'Invalid security token. Please refresh and try again.',
        },
        { status: 403 }
      );
    }
    // ✅ SECURITY: Rate limiting for subscription operations
    const rateLimitResult = await rateLimitSubscription()(request);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(request, 'CANCEL_RATE_LIMIT_EXCEEDED');
      return rateLimitResult.error;
    }

    // ✅ SECURITY: Authentication check
    const user = await currentUser();
    if (!user) {
      trackSuspiciousActivity(request, 'UNAUTHENTICATED_CANCEL_ACCESS');
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // ✅ SECURITY: Input validation
    const validationResult = await validateInput(subscriptionCancelSchema)(
      request
    );
    if (!validationResult.success) {
      trackSuspiciousActivity(request, 'INVALID_CANCEL_INPUT');
      return validationResult.error;
    }

    const { password, confirmCancel, reason } = validationResult.data;

    // ✅ SECURITY: Sanitize optional reason input
    let sanitizedReason = null;
    if (reason) {
      const reasonCheck = secureTextInput(reason);
      if (reasonCheck.threats.length) {
        trackSuspiciousActivity(
          request,
          `CANCEL_REASON_THREATS_${reasonCheck.threats.join('_')}`
        );
        return NextResponse.json(
          {
            error: 'Invalid cancellation reason',
            message: 'The reason contains invalid content',
          },
          { status: 400 }
        );
      }
      sanitizedReason = reasonCheck.clean;
    }

    // Find the user's profile with webhook-cached subscription data
    const profile = await db.profile.findFirst({
      where: { userId: user.id },
    });

    if (!profile) {
      trackSuspiciousActivity(request, 'CANCEL_PROFILE_NOT_FOUND');
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    console.log(
      `⚡ [CANCEL-OPTIMIZED] Processing cancellation for user: ${user.id}`
    );

    // ✅ OPTIMIZED: Use webhook-cached subscription data instead of Stripe API call
    if (!profile.stripeSubscriptionId) {
      console.log('❌ [CANCEL-OPTIMIZED] No cached subscription ID found');
      return NextResponse.json(
        { error: 'No active subscription found in system' },
        { status: 400 }
      );
    }

    // ✅ OPTIMIZED: Verify subscription is active using cached data
    const hasActiveSubscription =
      profile.subscriptionStatus === 'ACTIVE' &&
      profile.subscriptionEnd &&
      new Date(profile.subscriptionEnd) > new Date();

    if (!hasActiveSubscription) {
      console.log(
        '❌ [CANCEL-OPTIMIZED] Subscription not active according to cache'
      );
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 400 }
      );
    }

    console.log(
      `⚡ [CANCEL-OPTIMIZED] Using cached subscription ID: ${profile.stripeSubscriptionId}`
    );

    // ✅ NECESSARY: Cancel the subscription in Stripe (state-changing operation)
    let updatedSubscription;
    try {
      // Set subscription to cancel at period end (not immediately)
      updatedSubscription = await stripe.subscriptions.update(
        profile.stripeSubscriptionId,
        {
          cancel_at_period_end: true,
        }
      );

      console.log(
        `✅ [CANCEL-OPTIMIZED] Successfully cancelled Stripe subscription`
      );
    } catch (stripeError) {
      console.error(
        '❌ [CANCEL-OPTIMIZED] Stripe cancellation failed:',
        stripeError
      );
      trackSuspiciousActivity(request, 'STRIPE_CANCEL_ERROR');
      return NextResponse.json(
        {
          error: 'Failed to cancel subscription',
          message: 'Could not process cancellation request',
        },
        { status: 500 }
      );
    }

    // ✅ OPTIMIZED: Use cached subscription end date with Stripe data as backup
    let periodEndDate = profile.subscriptionEnd;

    if (!periodEndDate) {
      // Fallback to Stripe data if cached date is missing
      const periodEndTimestamp = (updatedSubscription as any)
        .current_period_end;
      if (periodEndTimestamp && typeof periodEndTimestamp === 'number') {
        periodEndDate = new Date(periodEndTimestamp * 1000);
      }
    }

    // Validate the period end date
    if (!periodEndDate || isNaN(periodEndDate.getTime())) {
      return NextResponse.json(
        {
          error: 'Invalid subscription period data',
          message: 'Unable to determine subscription end date',
        },
        { status: 400 }
      );
    }

    // ✅ OPTIMIZED: Update database cache with cancellation status
    try {
      await db.profile.update({
        where: { id: profile.id },
        data: {
          subscriptionAutoRenew: false, // Cancellation disables auto-renewal
          subscriptionCancelledAt: new Date(),

          updatedAt: new Date(),
        },
      });

      console.log(
        `⚡ [CANCEL-OPTIMIZED] Updated database cache with cancellation status`
      );
    } catch (dbError) {
      console.error(
        '⚠️ [CANCEL-OPTIMIZED] Failed to update database cache:',
        dbError
      );
      // Don't fail the request if cache update fails, Stripe cancellation succeeded
    }

    // Create notification
    await createNotification({
      userId: user.id,
      type: 'PAYMENT',
      title: 'Auto-Renewal Disabled',
      message: `Auto-renewal has been disabled. Your subscription will remain active until ${periodEndDate.toLocaleDateString()}. You can re-enable auto-renewal anytime before then.`,
    });

    console.log(
      `✅ [CANCEL-OPTIMIZED] Subscription cancelled successfully with optimized performance`
    );

    return NextResponse.json({
      success: true,
      message: 'Auto-renewal disabled successfully',
      subscription: {
        id: updatedSubscription.id,
        status: updatedSubscription.status,
        cancelAtPeriodEnd: updatedSubscription.cancel_at_period_end,
        currentPeriodEnd: periodEndDate,
        willCancelAt: periodEndDate,
      },
      performance: {
        optimized: true,
        stripeApiCalls: 1, // Down from 2
        usedWebhookCache: true,
      },
    });
  } catch (error) {
    trackSuspiciousActivity(request, 'CANCEL_OPERATION_ERROR');

    // ✅ SECURITY: Don't expose detailed error information
    return NextResponse.json(
      {
        error: 'Failed to cancel subscription',
        message: 'An internal error occurred. Please try again later.',
      },
      { status: 500 }
    );
  }
}
