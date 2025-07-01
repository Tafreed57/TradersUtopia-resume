import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import * as OTPAuth from 'otpauth';
import { cookies } from 'next/headers';
import { rateLimit2FA, trackSuspiciousActivity } from '@/lib/rate-limit';
import {
  validateInput,
  twoFactorLoginSchema,
  secureTextInput,
} from '@/lib/validation';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // ✅ SECURITY: Rate limiting for 2FA login operations
    const rateLimitResult = await rateLimit2FA()(request);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(request, '2FA_LOGIN_RATE_LIMIT_EXCEEDED');
      return rateLimitResult.error;
    }

    // ✅ SECURITY: Authentication check
    const user = await currentUser();
    if (!user) {
      trackSuspiciousActivity(request, 'UNAUTHENTICATED_2FA_LOGIN');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ✅ SECURITY: Input validation
    const validationResult = await validateInput(twoFactorLoginSchema)(request);
    if (!validationResult.success) {
      trackSuspiciousActivity(request, 'INVALID_2FA_LOGIN_INPUT');
      return validationResult.error;
    }

    const { code } = validationResult.data;

    // ✅ SECURITY: Sanitize code input
    const codeCheck = secureTextInput(code);
    if (codeCheck.threats.length) {
      console.warn(
        `🚨 [SECURITY] Suspicious 2FA login code input: ${codeCheck.threats.join(', ')}`
      );
      trackSuspiciousActivity(request, 'SUSPICIOUS_2FA_LOGIN_INPUT');
      return NextResponse.json(
        {
          error: 'Invalid code format',
          message: 'The code contains invalid characters',
        },
        { status: 400 }
      );
    }

    // Get the user's profile
    const profile = await db.profile.findUnique({
      where: {
        userId: user.id,
      },
    });

    if (!profile) {
      trackSuspiciousActivity(request, '2FA_LOGIN_PROFILE_NOT_FOUND');
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    if (!profile.twoFactorEnabled || !profile.twoFactorSecret) {
      trackSuspiciousActivity(request, '2FA_LOGIN_NOT_ENABLED');
      return NextResponse.json(
        {
          error: '2FA not enabled for this account',
          message:
            'Two-factor authentication must be enabled before login verification',
        },
        { status: 400 }
      );
    }

    // ✅ SECURITY: Enhanced TOTP verification with comprehensive logging
    const totp = new OTPAuth.TOTP({
      secret: profile.twoFactorSecret,
      digits: 6,
      period: 30,
    });

    const delta = totp.validate({ token: code, window: 1 });

    if (delta === null) {
      // Check if it's a backup code
      if (profile.backupCodes && profile.backupCodes.includes(code)) {
        // Remove the used backup code
        const updatedBackupCodes = profile.backupCodes.filter(
          backupCode => backupCode !== code
        );

        await db.profile.update({
          where: { id: profile.id },
          data: {
            backupCodes: updatedBackupCodes,
          },
        });

        // Set secure 2FA verification cookie
        const cookieStore = cookies();
        cookieStore.set('2fa-verified', 'true', {
          httpOnly: true, // ✅ SECURE: Prevent XSS attacks by blocking JavaScript access
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict', // ✅ SECURE: Prevent CSRF attacks
          maxAge: 60 * 60 * 8, // ✅ SECURE: Reduced to 8 hours for better security
          path: '/', // Ensure cookie is available site-wide
        });

        // ✅ SECURITY: Log successful backup code usage
        console.log(
          `🔑 [2FA-LOGIN] Backup code used successfully by user: ${profile.email}`
        );
        console.log(
          `📍 [2FA-LOGIN] IP: ${request.headers.get('x-forwarded-for') || 'unknown'}`
        );
        console.log(
          `🔢 [2FA-LOGIN] Remaining backup codes: ${updatedBackupCodes.length}`
        );

        return NextResponse.json({
          success: true,
          message: '2FA verified with backup code',
          backupCodeUsed: true,
          remainingBackupCodes: updatedBackupCodes.length,
        });
      }

      trackSuspiciousActivity(request, 'INVALID_2FA_LOGIN_CODE');
      console.warn(
        `🚨 [2FA-LOGIN] Invalid code attempt for user: ${profile.email}`
      );
      return NextResponse.json(
        {
          error: 'Invalid authentication code',
          message: 'The code is incorrect or has expired',
        },
        { status: 400 }
      );
    }

    // Set secure 2FA verification cookie for the session
    const cookieStore = cookies();
    cookieStore.set('2fa-verified', 'true', {
      httpOnly: true, // ✅ SECURE: Prevent XSS attacks by blocking JavaScript access
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict', // ✅ SECURE: Prevent CSRF attacks
      maxAge: 60 * 60 * 8, // ✅ SECURE: Reduced to 8 hours for better security
      path: '/', // Ensure cookie is available site-wide
    });

    // ✅ SECURITY: Log successful 2FA login verification
    console.log(
      `🔒 [2FA-LOGIN] Two-factor verification successful for user: ${profile.email}`
    );
    console.log(
      `📍 [2FA-LOGIN] IP: ${request.headers.get('x-forwarded-for') || 'unknown'}`
    );
    console.log(
      `🖥️ [2FA-LOGIN] User Agent: ${request.headers.get('user-agent')?.slice(0, 100) || 'unknown'}`
    );

    return NextResponse.json({
      success: true,
      message: '2FA verification successful',
      backupCodeUsed: false,
    });
  } catch (error) {
    console.error('❌ [2FA-LOGIN] 2FA login verification error:', error);
    trackSuspiciousActivity(request, '2FA_LOGIN_ERROR');

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'An error occurred during verification. Please try again.',
      },
      { status: 500 }
    );
  }
}
