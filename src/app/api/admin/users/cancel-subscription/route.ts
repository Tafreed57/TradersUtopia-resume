import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { rateLimitServer, trackSuspiciousActivity } from '@/lib/rate-limit';
import { strictCSRFValidation } from '@/lib/csrf';
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  try {
    // CSRF protection for admin operations
    const csrfValid = await strictCSRFValidation(request);
    if (!csrfValid) {
      trackSuspiciousActivity(request, 'ADMIN_CANCEL_CSRF_VALIDATION_FAILED');
      return NextResponse.json(
        {
          error: 'CSRF validation failed',
          message: 'Invalid security token. Please refresh and try again.',
        },
        { status: 403 }
      );
    }

    // Rate limiting for admin operations
    const rateLimitResult = await rateLimitServer()(request);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(request, 'ADMIN_CANCEL_RATE_LIMIT_EXCEEDED');
      return rateLimitResult.error;
    }

    const user = await currentUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Find the admin's profile and check admin status
    const adminProfile = await db.profile.findFirst({
      where: { userId: user.id },
    });

    if (!adminProfile || !adminProfile.isAdmin) {
      trackSuspiciousActivity(request, 'NON_ADMIN_CANCEL_ATTEMPT');
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Find the user and their subscription
    const targetProfile = await db.profile.findFirst({
      where: { userId },
    });

    if (!targetProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (
      targetProfile.subscriptionStatus === 'FREE' ||
      !targetProfile.stripeCustomerId
    ) {
      return NextResponse.json(
        { error: 'User has no active subscription' },
        { status: 400 }
      );
    }

    // Cancel subscription in Stripe
    try {
      // Find and cancel active subscriptions for this customer
      const subscriptions = await stripe.subscriptions.list({
        customer: targetProfile.stripeCustomerId,
        status: 'active',
        limit: 10,
      });

      let cancelledSubscriptionId = '';
      for (const subscription of subscriptions.data) {
        await stripe.subscriptions.cancel(subscription.id);
        cancelledSubscriptionId = subscription.id;
      }
    } catch (stripeError) {
      return NextResponse.json(
        {
          error: 'Failed to cancel subscription in Stripe',
          message:
            'Unable to process subscription cancellation. Please try again.',
        },
        { status: 500 }
      );
    }

    // Update subscription status in database
    await db.profile.update({
      where: { userId },
      data: {
        subscriptionStatus: 'CANCELLED',
        subscriptionEnd: new Date(),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'User subscription has been cancelled',
      cancelledSubscription: {
        userId: targetProfile.userId,
        email: targetProfile.email,
        name: targetProfile.name,
        customerId: targetProfile.stripeCustomerId,
      },
    });
  } catch (error) {
    trackSuspiciousActivity(request, 'ADMIN_CANCEL_ERROR');

    return NextResponse.json(
      {
        error: 'Failed to cancel subscription',
        message: 'Unable to cancel user subscription. Please try again later.',
      },
      { status: 500 }
    );
  }
}
