import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import {
  rateLimitSubscription,
  trackSuspiciousActivity,
} from '@/lib/rate-limit';
import { validateInput, subscriptionActivationSchema } from '@/lib/validation';
import { strictCSRFValidation } from '@/lib/csrf';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // ✅ SECURITY FIX: Add CSRF protection
    const csrfValid = await strictCSRFValidation(request);
    if (!csrfValid) {
      trackSuspiciousActivity(request, 'ACTIVATION_CSRF_VALIDATION_FAILED');
      return NextResponse.json(
        {
          error: 'CSRF validation failed',
          message: 'Invalid security token. Please refresh and try again.',
        },
        { status: 403 }
      );
    }

    // ✅ SECURITY: Rate limiting for subscription activation
    const rateLimitResult = await rateLimitSubscription()(request);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(request, 'ACTIVATION_RATE_LIMIT_EXCEEDED');
      return rateLimitResult.error;
    }

    // ✅ SECURITY: Authentication check
    const user = await currentUser();
    if (!user) {
      trackSuspiciousActivity(request, 'UNAUTHENTICATED_ACTIVATION_ACCESS');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ✅ SECURITY: Input validation (re-enabling for this endpoint)
    const validationResult = await validateInput(subscriptionActivationSchema)(
      request
    );
    if (!validationResult.success) {
      trackSuspiciousActivity(request, 'INVALID_ACTIVATION_INPUT');
      return validationResult.error;
    }

    console.log('Activating subscription for user:', {
      userId: user.id,
      email: user.emailAddresses[0]?.emailAddress,
      name: `${user.firstName} ${user.lastName}`,
    });

    // Find or create the user's profile
    let profile = await db.profile.findFirst({
      where: { userId: user.id },
    });

    if (!profile) {
      // Create profile if it doesn't exist
      profile = await db.profile.create({
        data: {
          userId: user.id,
          name: `${user.firstName} ${user.lastName}`,
          email: user.emailAddresses[0]?.emailAddress || '',
          imageUrl: user.imageUrl,
          subscriptionStatus: 'FREE',
        },
      });
      console.log('Created new profile:', profile.id);
    }

    // Activate the subscription
    const updatedProfile = await db.profile.update({
      where: { id: profile.id },
      data: {
        subscriptionStatus: 'ACTIVE',
        subscriptionStart: new Date(),
        subscriptionEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      },
    });

    console.log(
      '✅ Successfully activated subscription for user:',
      updatedProfile.email
    );

    return NextResponse.json({
      success: true,
      message: 'Subscription activated successfully!',
      profile: {
        id: updatedProfile.id,
        name: updatedProfile.name,
        email: updatedProfile.email,
        subscriptionStatus: updatedProfile.subscriptionStatus,
        subscriptionStart: updatedProfile.subscriptionStart,
        subscriptionEnd: updatedProfile.subscriptionEnd,
      },
    });
  } catch (error) {
    console.error('Error activating subscription:', error);
    trackSuspiciousActivity(request, 'ACTIVATION_ENDPOINT_ERROR');

    // ✅ SECURITY: Generic error response - no internal details exposed
    return NextResponse.json(
      {
        error: 'Failed to activate subscription',
        message:
          'Unable to process subscription activation. Please try again later.',
      },
      { status: 500 }
    );
  }
}
