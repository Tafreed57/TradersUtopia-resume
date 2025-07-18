import { NextRequest, NextResponse } from 'next/server';
import { getCurrentProfileWithSync } from '@/lib/query';
import { rateLimitGeneral, trackSuspiciousActivity } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // ✅ SECURITY: Use general rate limiting for frequent admin status checks (not admin operations)
    const rateLimitResult = await rateLimitGeneral()(request);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(request, 'ADMIN_STATUS_RATE_LIMIT_EXCEEDED');
      return rateLimitResult.error;
    }

    // ✅ PERFORMANCE: Use lightweight auth for frequent admin checks
    const profile = await getCurrentProfileWithSync();
    if (!profile) {
      trackSuspiciousActivity(request, 'UNAUTHENTICATED_ADMIN_CHECK');
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Profile already contains all needed data including isAdmin
    return NextResponse.json({
      isAdmin: profile.isAdmin,
      profile: {
        id: profile.id,
        email: profile.email,
        isAdmin: profile.isAdmin,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
