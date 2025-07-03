import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { getCSRFTokenForUser, getCSRFStats } from '@/lib/csrf';
import { rateLimitGeneral, trackSuspiciousActivity } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // ✅ SECURITY: Rate limiting for CSRF token generation
    const rateLimitResult = await rateLimitGeneral()(request);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(request, 'CSRF_TOKEN_RATE_LIMIT_EXCEEDED');
      return rateLimitResult.error;
    }

    // ✅ SECURITY: Authentication check
    const user = await currentUser();
    if (!user) {
      trackSuspiciousActivity(request, 'UNAUTHENTICATED_CSRF_TOKEN_REQUEST');
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Generate CSRF token for the user
    const csrfToken = await getCSRFTokenForUser();

    if (!csrfToken) {
      trackSuspiciousActivity(request, 'CSRF_TOKEN_GENERATION_FAILED');
      return NextResponse.json(
        {
          error: 'Failed to generate CSRF token',
          message: 'Unable to generate security token. Please try again later.',
        },
        { status: 500 }
      );
    }

    // ✅ SECURITY: Log CSRF token generation
    console.log(
      `🔒 [CSRF] Token generated for user: ${user.emailAddresses[0]?.emailAddress} (${user.id})`
    );
    console.log(
      `📍 [CSRF] IP: ${request.headers.get('x-forwarded-for') || 'unknown'}`
    );

    return NextResponse.json(
      {
        token: csrfToken,
        expiresIn: 3600, // 1 hour in seconds
        maxAge: 3600, // Legacy field for compatibility
        usage:
          'Include this token in X-CSRF-Token header for state-changing requests',
      },
      {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  } catch (error) {
    console.error('❌ [CSRF] Error generating CSRF token:', error);
    trackSuspiciousActivity(request, 'CSRF_TOKEN_ERROR');

    return NextResponse.json(
      {
        error: 'CSRF token generation failed',
        message: 'Unable to generate security token. Please try again later.',
      },
      { status: 500 }
    );
  }
}

// ✅ SECURITY: Development endpoint to check CSRF stats (production should disable this)
export async function POST(request: NextRequest) {
  try {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        {
          error: 'CSRF stats disabled in production',
          environment: 'production',
        },
        { status: 403 }
      );
    }

    // ✅ SECURITY: Rate limiting for debug operations
    const rateLimitResult = await rateLimitGeneral()(request);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(request, 'CSRF_STATS_RATE_LIMIT_EXCEEDED');
      return rateLimitResult.error;
    }

    // ✅ SECURITY: Authentication check
    const user = await currentUser();
    if (!user) {
      trackSuspiciousActivity(request, 'UNAUTHENTICATED_CSRF_STATS_REQUEST');
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const stats = getCSRFStats();

    return NextResponse.json(
      {
        environment: 'development',
        timestamp: new Date().toISOString(),
        csrfStats: stats,
        note: '🔒 CSRF protection is active for state-changing requests',
      },
      {
        headers: {
          'X-Environment': 'development',
          'X-Security-Level': 'high',
        },
      }
    );
  } catch (error) {
    console.error('❌ [CSRF] Error retrieving CSRF stats:', error);

    return NextResponse.json(
      {
        error: 'CSRF stats failed',
        message: 'Unable to retrieve CSRF statistics. Please try again later.',
      },
      { status: 500 }
    );
  }
}
