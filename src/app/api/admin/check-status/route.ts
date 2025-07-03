import { NextRequest, NextResponse } from 'next/server';
import { getCurrentProfileForAuth } from '@/lib/query';
import { db } from '@/lib/db';
import { rateLimitAdmin, trackSuspiciousActivity } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // ✅ SECURITY: Rate limiting for admin status checks
    const rateLimitResult = await rateLimitAdmin()(request);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(request, 'ADMIN_STATUS_RATE_LIMIT_EXCEEDED');
      return rateLimitResult.error;
    }

    // ✅ PERFORMANCE: Use lightweight auth for frequent admin checks
    const profile = await getCurrentProfileForAuth();
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
    console.error('❌ [ADMIN_CHECK] Admin status check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
