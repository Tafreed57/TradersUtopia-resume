import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { rateLimitGeneral, trackSuspiciousActivity } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // ✅ SECURITY: Rate limiting for profile access
    const rateLimitResult = await rateLimitGeneral()(request);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(request, 'USER_PROFILE_RATE_LIMIT_EXCEEDED');
      return rateLimitResult.error;
    }

    const { userId } = await auth();

    if (!userId) {
      trackSuspiciousActivity(request, 'UNAUTHENTICATED_PROFILE_ACCESS');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find the user's profile in our database
    const profile = await db.profile.findUnique({
      where: {
        userId: userId,
      },
      select: {
        id: true,
        userId: true,
        name: true,
        email: true,
        imageUrl: true,
        createdAt: true,
        updatedAt: true,
        subscriptionStatus: true,
        isAdmin: true,
      },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error('[USER_PROFILE_GET]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
