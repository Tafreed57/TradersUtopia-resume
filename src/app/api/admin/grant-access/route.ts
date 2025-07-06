import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { rateLimitAdmin, trackSuspiciousActivity } from '@/lib/rate-limit';
import { secureTextInput } from '@/lib/validation';
import { z } from 'zod';
import { strictCSRFValidation } from '@/lib/csrf';

// Specific validation for grant access endpoint
const grantAccessSchema = z.object({
  reason: z.string().max(500, 'Reason too long').optional(),
});

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // ✅ SECURITY: CSRF protection for admin operations
    const csrfValid = await strictCSRFValidation(request);
    if (!csrfValid) {
      trackSuspiciousActivity(request, 'ADMIN_GRANT_CSRF_VALIDATION_FAILED');
      return NextResponse.json(
        {
          error: 'CSRF validation failed',
          message: 'Invalid security token. Please refresh and try again.',
        },
        { status: 403 }
      );
    }

    // ✅ SECURITY: Rate limiting for admin operations
    const rateLimitResult = await rateLimitAdmin()(request);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(request, 'ADMIN_RATE_LIMIT_EXCEEDED');
      return rateLimitResult.error;
    }

    // ✅ SECURITY: Authentication check
    const user = await currentUser();
    if (!user) {
      trackSuspiciousActivity(request, 'UNAUTHENTICATED_ADMIN_ACCESS');
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // ✅ SECURITY FIX: Ensure the current user is an admin before proceeding
    const requestingProfile = await db.profile.findFirst({
      where: { userId: user.id },
    });

    if (!requestingProfile || !requestingProfile.isAdmin) {
      trackSuspiciousActivity(request, 'NON_ADMIN_GRANT_ATTEMPT');
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // ✅ SECURITY: Input validation
    let reason = '';
    try {
      const body = await request.json();
      const validated = grantAccessSchema.parse(body);
      reason = validated.reason || '';
    } catch (error) {
      // If no JSON body or invalid, continue with empty reason
      reason = '';
    }

    // ✅ SECURITY: Sanitize text inputs
    const sanitizedReason = reason ? secureTextInput(reason) : null;
    if (sanitizedReason?.threats.length) {
      console.warn(
        `🚨 [SECURITY] Admin operation blocked - threats detected: ${sanitizedReason.threats.join(', ')}`
      );
      trackSuspiciousActivity(
        request,
        `ADMIN_INPUT_THREATS_${sanitizedReason.threats.join('_')}`
      );
      return NextResponse.json(
        {
          error: 'Invalid input detected',
          message: 'Potentially malicious content in request data',
        },
        { status: 400 }
      );
    }

    // This endpoint no longer grants access directly.
    // It is now only for logging and serves as a placeholder for a more secure process.
    // The actual granting of admin rights should be done via a secure, audited process
    // (e.g., a CLI script or a super-admin panel with 2FA).

    // ✅ SECURITY: Log admin access attempt with details (no personal data exposed)
    console.log(
      `🔑 [ADMIN] Admin access attempt by an existing admin: ${requestingProfile.email}`
    );
    console.log(
      `📝 [ADMIN] Reason: ${sanitizedReason?.clean || 'No reason provided'}`
    );
    console.log(
      `📍 [ADMIN] IP: ${request.headers.get('x-forwarded-for') || 'unknown'}`
    );
    console.log(`🖥️ [ADMIN] User Agent: [MASKED_FOR_SECURITY]`);

    return NextResponse.json({
      success: true,
      message:
        'This endpoint is for logging purposes only. Admin access must be granted via a secure, offline process.',
    });
  } catch (error) {
    console.error('❌ [ADMIN] Error in admin access endpoint:', error);
    trackSuspiciousActivity(request, 'ADMIN_GRANT_ERROR');

    // ✅ SECURITY: Don't expose detailed error information
    return NextResponse.json(
      {
        error: 'Admin access endpoint error',
        message: 'An internal error occurred. Please try again later.',
      },
      { status: 500 }
    );
  }
}
