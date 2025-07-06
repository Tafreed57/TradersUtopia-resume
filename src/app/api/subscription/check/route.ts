import { NextRequest, NextResponse } from 'next/server';
import { checkUserSubscription } from '@/lib/subscription';
import { rateLimitGeneral, trackSuspiciousActivity } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  try {
    // ✅ SECURITY FIX: Add rate limiting
    const rateLimitResult = await rateLimitGeneral()(request);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(request, 'SUB_CHECK_RATE_LIMIT_EXCEEDED');
      return rateLimitResult.error;
    }

    const subscriptionData = await checkUserSubscription();

    return NextResponse.json(subscriptionData);
  } catch (error) {
    console.error('Error checking subscription:', error);
    return NextResponse.json(
      { hasAccess: false, status: 'ERROR', canStartTrial: false },
      { status: 500 }
    );
  }
}
