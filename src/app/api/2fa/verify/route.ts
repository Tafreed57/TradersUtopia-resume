import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { TOTP } from 'otpauth';
import { createNotification } from '@/lib/notifications';
import { rateLimit2FA, trackSuspiciousActivity } from '@/lib/rate-limit';
import {
  validateInput,
  twoFactorCodeSchema,
  secureTextInput,
} from '@/lib/validation';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // ✅ SECURITY: Rate limiting for 2FA operations
    const rateLimitResult = await rateLimit2FA()(request);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(request, '2FA_RATE_LIMIT_EXCEEDED');
      return rateLimitResult.error;
    }

    // ✅ SECURITY: Authentication check
    const user = await currentUser();
    if (!user) {
      trackSuspiciousActivity(request, 'UNAUTHENTICATED_2FA_ACCESS');
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // ✅ SECURITY: Input validation
    const validationResult = await validateInput(twoFactorCodeSchema)(request);
    if (!validationResult.success) {
      trackSuspiciousActivity(request, 'INVALID_2FA_INPUT');
      return validationResult.error;
    }

    const { code } = validationResult.data;

    // ✅ SECURITY: Sanitize code input
    const codeCheck = secureTextInput(code);
    if (codeCheck.threats.length) {
      console.warn(
        `🚨 [SECURITY] Suspicious 2FA code input: ${codeCheck.threats.join(', ')}`
      );
      trackSuspiciousActivity(request, 'SUSPICIOUS_2FA_INPUT');
      return NextResponse.json(
        {
          error: 'Invalid code format',
          message: 'The code contains invalid characters',
        },
        { status: 400 }
      );
    }

    // Find the user's profile
    const profile = await db.profile.findFirst({
      where: { userId: user.id },
    });

    if (!profile) {
      trackSuspiciousActivity(request, '2FA_PROFILE_NOT_FOUND');
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    if (!profile.twoFactorSecret) {
      trackSuspiciousActivity(request, '2FA_NOT_SETUP');
      return NextResponse.json(
        {
          error: '2FA not set up. Please set up 2FA first.',
          message:
            'Two-factor authentication must be configured before verification',
        },
        { status: 400 }
      );
    }

    // ✅ SECURITY: Verify the code with enhanced logging
    const totp = new TOTP({
      issuer: 'TradersUtopia',
      label: `${profile.name} (${profile.email})`,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: profile.twoFactorSecret,
    });

    const isValid = totp.validate({ token: code, window: 1 });

    if (!isValid) {
      trackSuspiciousActivity(request, 'INVALID_2FA_CODE');
      console.warn(
        `🚨 [2FA] Invalid verification attempt for user: ${profile.email}`
      );
      return NextResponse.json(
        {
          error: 'Invalid code',
          message: 'The verification code is incorrect or has expired',
        },
        { status: 400 }
      );
    }

    // Generate backup codes
    const backupCodes = Array.from({ length: 8 }, () =>
      Math.random().toString(36).substring(2, 10).toUpperCase()
    );

    // ✅ SECURITY: Enable 2FA with comprehensive logging
    await db.profile.update({
      where: { id: profile.id },
      data: {
        twoFactorEnabled: true,
        backupCodes,
      },
    });

    // Create security notification
    await createNotification({
      userId: user.id,
      type: 'SECURITY',
      title: '2FA Enabled',
      message:
        'Two-factor authentication has been successfully enabled on your account.',
    });

    // ✅ SECURITY: Log successful 2FA enablement
    console.log(
      `🔒 [2FA] Two-factor authentication enabled for user: ${profile.email}`
    );
    console.log(
      `📍 [2FA] IP: ${request.headers.get('x-forwarded-for') || 'unknown'}`
    );
    console.log(
      `🖥️ [2FA] User Agent: ${request.headers.get('user-agent')?.slice(0, 100) || 'unknown'}`
    );
    console.log(`🔑 [2FA] Generated ${backupCodes.length} backup codes`);

    return NextResponse.json({
      success: true,
      message: '2FA has been successfully enabled!',
      backupCodes: backupCodes,
      warning:
        'Please save these backup codes in a secure location. They will not be shown again.',
    });
  } catch (error) {
    console.error('❌ [2FA] 2FA verification error:', error);
    trackSuspiciousActivity(request, '2FA_VERIFY_ERROR');

    // ✅ SECURITY: Don't expose detailed error information
    return NextResponse.json(
      {
        error: 'Failed to verify 2FA',
        message: 'An error occurred during verification. Please try again.',
      },
      { status: 500 }
    );
  }
}
