import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import Stripe from 'stripe';
import { createNotification } from '@/lib/notifications';
import {
  rateLimitSubscription,
  trackSuspiciousActivity,
} from '@/lib/rate-limit';
import { validateInput, autoRenewalSchema } from '@/lib/validation';

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

    console.log(
      `⚡ [TOGGLE-AUTORENEW-OPTIMIZED] Processing auto-renewal toggle for user: ${user.id}, setting: ${autoRenew}`
    );

    // Find the user's profile with webhook-cached subscription data
    const profile = await db.profile.findFirst({
      where: { userId: user.id },
    });

    if (!profile) {
      trackSuspiciousActivity(request, 'AUTORENEW_PROFILE_NOT_FOUND');
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // ✅ OPTIMIZED: Use webhook-cached subscription data instead of Stripe API call
    if (!profile.stripeSubscriptionId) {
      console.log(
        '❌ [TOGGLE-AUTORENEW-OPTIMIZED] No cached subscription ID found'
      );
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
        '❌ [TOGGLE-AUTORENEW-OPTIMIZED] Subscription not active according to cache'
      );
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 400 }
      );
    }

    console.log(
      `⚡ [TOGGLE-AUTORENEW-OPTIMIZED] Using cached subscription ID: ${profile.stripeSubscriptionId}`
    );

    // ✅ NECESSARY: Update the subscription in Stripe (state-changing operation)
    let updatedSubscription;
    try {
      updatedSubscription = await stripe.subscriptions.update(
        profile.stripeSubscriptionId,
        {
          cancel_at_period_end: !autoRenew, // If autoRenew is true, don't cancel at period end
        }
      );

      console.log(
        `✅ [TOGGLE-AUTORENEW-OPTIMIZED] Successfully updated Stripe subscription`
      );
    } catch (stripeError) {
      console.error(
        '❌ [TOGGLE-AUTORENEW-OPTIMIZED] Stripe update failed:',
        stripeError
      );
      trackSuspiciousActivity(request, 'STRIPE_UPDATE_ERROR');
      return NextResponse.json(
        {
          error: 'Failed to update subscription',
          message: 'Could not modify auto-renewal setting',
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

    // ✅ OPTIMIZED: Update database cache with new auto-renewal setting
    try {
      await db.profile.update({
        where: { id: profile.id },
        data: {
          subscriptionAutoRenew: autoRenew,

          updatedAt: new Date(),
        },
      });

      console.log(
        `⚡ [TOGGLE-AUTORENEW-OPTIMIZED] Updated database cache with new auto-renewal setting`
      );
    } catch (dbError) {
      console.error(
        '⚠️ [TOGGLE-AUTORENEW-OPTIMIZED] Failed to update database cache:',
        dbError
      );
      // Don't fail the request if cache update fails, Stripe update succeeded
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

    console.log(
      `✅ [TOGGLE-AUTORENEW-OPTIMIZED] Auto-renewal ${autoRenew ? 'enabled' : 'disabled'} successfully with optimized performance`
    );

    return NextResponse.json({
      success: true,
      autoRenew: !(updatedSubscription as any).cancel_at_period_end,
      message: `Auto-renewal ${autoRenew ? 'enabled' : 'disabled'} successfully`,
      subscription: {
        id: updatedSubscription.id,
        cancelAtPeriodEnd: (updatedSubscription as any).cancel_at_period_end,
        currentPeriodEnd: periodEndDate,
      },
      performance: {
        optimized: true,
        stripeApiCalls: 1, // Down from 2
        usedWebhookCache: true,
      },
    });
  } catch (error) {
    console.error('❌ [TOGGLE-AUTORENEW-OPTIMIZED] Operation failed:', error);
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
