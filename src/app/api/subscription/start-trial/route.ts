import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { startTrial, checkUserSubscription } from '@/lib/subscription';
import {
  rateLimitSubscription,
  trackSuspiciousActivity,
} from '@/lib/rate-limit';
import { strictCSRFValidation } from '@/lib/csrf';

export async function POST(request: NextRequest) {
  try {
    // ✅ SECURITY FIX: Add CSRF protection
    const csrfValid = await strictCSRFValidation(request);
    if (!csrfValid) {
      trackSuspiciousActivity(request, 'START_TRIAL_CSRF_FAILED');
      return NextResponse.json(
        {
          error: 'CSRF validation failed',
          message: 'Invalid security token. Please refresh and try again.',
        },
        { status: 403 }
      );
    }

    // ✅ SECURITY FIX: Add rate limiting
    const rateLimitResult = await rateLimitSubscription()(request);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(request, 'START_TRIAL_RATE_LIMIT_EXCEEDED');
      return rateLimitResult.error;
    }

    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user can start trial
    const subscriptionData = await checkUserSubscription();

    if (!subscriptionData.canStartTrial) {
      return NextResponse.json(
        { error: 'Trial already used or user has active subscription' },
        { status: 400 }
      );
    }

    const trialEnd = await startTrial(userId);

    return NextResponse.json({
      success: true,
      trialEnd,
      message: '14-day free trial started successfully!',
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to start trial' },
      { status: 500 }
    );
  }
}
