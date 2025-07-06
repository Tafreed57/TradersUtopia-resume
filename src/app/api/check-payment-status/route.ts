import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { rateLimitGeneral, trackSuspiciousActivity } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // ✅ SECURITY FIX: Add rate limiting
    const rateLimitResult = await rateLimitGeneral()(request);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(request, 'PAYMENT_STATUS_RATE_LIMIT_EXCEEDED');
      return rateLimitResult.error;
    }

    // Step 1: Test Clerk authentication
    const user = await currentUser();

    if (!user) {
      return NextResponse.json(
        { hasAccess: false, reason: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Step 2: Search for profile
    const profile = await db.profile.findFirst({
      where: { userId: user.id },
    });

    if (!profile) {
      return NextResponse.json(
        {
          hasAccess: false,
          reason: 'Profile not found in database',
          userId: user.id,
          suggestion: 'User needs to be created in database',
        },
        { status: 404 }
      );
    }

    // Step 3: Check subscription status (no auto-sync for security)
    let currentProfile = profile;
    let autoSyncPerformed = false;

    // Step 4: Final subscription status check
    const hasActiveSubscription =
      currentProfile.subscriptionStatus === 'ACTIVE' &&
      currentProfile.subscriptionEnd &&
      new Date() < currentProfile.subscriptionEnd;

    return NextResponse.json({
      hasAccess: hasActiveSubscription,
      subscriptionStatus: currentProfile.subscriptionStatus,
      subscriptionEnd: currentProfile.subscriptionEnd,
      reason: hasActiveSubscription
        ? 'Active subscription'
        : 'No active subscription',
      autoSyncPerformed: autoSyncPerformed,
      debug: {
        userId: user.id,
        profileId: currentProfile.id,
        profileEmail: currentProfile.email,
      },
    });
  } catch (error) {
    // ✅ SECURITY: Generic error response - no internal details exposed
    return NextResponse.json(
      {
        hasAccess: false,
        reason: 'Unable to check payment status at this time',
        message: 'Service temporarily unavailable. Please try again later.',
      },
      { status: 500 }
    );
  }
}
