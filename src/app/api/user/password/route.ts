import { NextRequest, NextResponse } from 'next/server';
import { currentUser, clerkClient } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { TOTP } from 'otpauth';
import { rateLimitPassword, trackSuspiciousActivity } from '@/lib/rate-limit';
import {
  validateInput,
  passwordSchema,
  secureTextInput,
} from '@/lib/validation';
import { strictCSRFValidation } from '@/lib/csrf';

// ✅ SECURITY: Enhanced password verification with Clerk API
async function verifyCurrentPassword(
  userId: string,
  currentPassword: string
): Promise<boolean> {
  try {
    const verification = await clerkClient.users.verifyPassword({
      userId: userId,
      password: currentPassword,
    });
    return verification.verified;
  } catch (error) {
    console.error('Password verification failed:', error);
    return false;
  }
}

// ✅ SECURITY: 2FA verification with backup code support
async function verify2FACode(
  userId: string,
  code: string
): Promise<{ valid: boolean; usingBackupCode?: boolean }> {
  try {
    // Find user profile with 2FA settings
    const profile = await db.profile.findFirst({
      where: { userId: userId, twoFactorEnabled: true },
    });

    if (!profile || !profile.twoFactorSecret) {
      return { valid: false };
    }

    // First, try TOTP verification
    const totp = new TOTP({
      issuer: 'TradersUtopia',
      label: `${profile.name} (${profile.email})`,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: profile.twoFactorSecret,
    });

    const delta = totp.validate({ token: code, window: 1 });

    if (delta !== null) {
      return { valid: true };
    }

    // If TOTP fails, check backup codes
    if (profile.backupCodes && profile.backupCodes.includes(code)) {
      // Remove used backup code
      const updatedBackupCodes = profile.backupCodes.filter(
        backupCode => backupCode !== code
      );

      await db.profile.update({
        where: { id: profile.id },
        data: { backupCodes: updatedBackupCodes },
      });

      return { valid: true, usingBackupCode: true };
    }

    return { valid: false };
  } catch (error) {
    console.error('2FA verification error:', error);
    return { valid: false };
  }
}

export async function POST(request: NextRequest) {
  try {
    // ✅ SECURITY: CSRF protection for password operations
    const csrfValid = await strictCSRFValidation(request);
    if (!csrfValid) {
      trackSuspiciousActivity(request, 'PASSWORD_CSRF_VALIDATION_FAILED');
      return NextResponse.json(
        {
          error: 'CSRF validation failed',
          message: 'Invalid security token. Please refresh and try again.',
        },
        { status: 403 }
      );
    }

    // ✅ SECURITY: Rate limiting for password operations
    const rateLimitResult = await rateLimitPassword()(request);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(request, 'PASSWORD_RATE_LIMIT_EXCEEDED');
      return rateLimitResult.error;
    }

    // ✅ SECURITY: Authentication check
    const user = await currentUser();
    if (!user) {
      trackSuspiciousActivity(request, 'UNAUTHENTICATED_PASSWORD_ACCESS');
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // ✅ SECURITY: Input validation
    const validationResult = await validateInput(passwordSchema)(request);
    if (!validationResult.success) {
      trackSuspiciousActivity(request, 'INVALID_PASSWORD_INPUT');
      return validationResult.error;
    }

    const { action, currentPassword, newPassword, twoFactorCode, use2FA } =
      validationResult.data;

    // ✅ SECURITY: Sanitize password inputs (check for dangerous patterns but don't modify)
    if (currentPassword) {
      const currentPasswordCheck = secureTextInput(currentPassword);
      if (currentPasswordCheck.threats.length) {
        console.warn(
          `🚨 [SECURITY] Suspicious current password input: ${currentPasswordCheck.threats.join(', ')}`
        );
        trackSuspiciousActivity(request, 'SUSPICIOUS_PASSWORD_INPUT');
      }
    }

    const newPasswordCheck = secureTextInput(newPassword);
    if (newPasswordCheck.threats.length) {
      console.warn(
        `🚨 [SECURITY] Suspicious new password input: ${newPasswordCheck.threats.join(', ')}`
      );
      trackSuspiciousActivity(request, 'SUSPICIOUS_PASSWORD_INPUT');
    }

    // Get user's current password status
    const hasPassword = user.passwordEnabled;

    // Authentication verification for password changes
    if (action === 'change' && hasPassword) {
      let authenticationVerified = false;

      if (use2FA && twoFactorCode) {
        // ✅ SECURITY: 2FA authentication
        console.log('🔐 [PASSWORD] Verifying 2FA code for password change...');
        const twoFactorResult = await verify2FACode(user.id, twoFactorCode);

        if (twoFactorResult.valid) {
          authenticationVerified = true;
          console.log(
            '✅ [PASSWORD] 2FA verification successful' +
              (twoFactorResult.usingBackupCode ? ' (backup code used)' : '')
          );
        } else {
          trackSuspiciousActivity(request, 'INVALID_2FA_PASSWORD_CHANGE');
          return NextResponse.json(
            {
              error: 'Invalid 2FA code',
              message: 'The 2FA code you entered is incorrect or has expired.',
            },
            { status: 400 }
          );
        }
      } else if (currentPassword) {
        // ✅ SECURITY: Current password verification
        console.log('🔐 [PASSWORD] Verifying current password...');
        authenticationVerified = await verifyCurrentPassword(
          user.id,
          currentPassword
        );

        if (!authenticationVerified) {
          trackSuspiciousActivity(request, 'INVALID_CURRENT_PASSWORD');
          return NextResponse.json(
            {
              error: 'Current password is incorrect',
              message: 'Please check your current password and try again.',
            },
            { status: 400 }
          );
        }
        console.log('✅ [PASSWORD] Current password verification successful');
      } else {
        trackSuspiciousActivity(request, 'PASSWORD_CHANGE_NO_AUTH');
        return NextResponse.json(
          {
            error: 'Authentication required',
            message:
              'Either current password or 2FA code is required to change password.',
          },
          { status: 400 }
        );
      }

      if (!authenticationVerified) {
        trackSuspiciousActivity(request, 'PASSWORD_CHANGE_AUTH_FAILED');
        return NextResponse.json(
          {
            error: 'Authentication failed',
            message: 'Could not verify your identity. Please try again.',
          },
          { status: 400 }
        );
      }
    }

    // ✅ SECURITY: Update password using Clerk
    try {
      await clerkClient.users.updateUser(user.id, {
        password: newPassword,
      });

      // ✅ SECURITY: Log successful password change
      console.log(
        `🔐 [PASSWORD] Password successfully updated for user: ${user.id}`
      );
      console.log(`📝 [PASSWORD] Action: ${action}`);
      console.log(
        `🔒 [PASSWORD] Auth method: ${use2FA ? '2FA' : 'current password'}`
      );
      console.log(
        `📍 [PASSWORD] IP: ${request.headers.get('x-forwarded-for') || 'unknown'}`
      );

      return NextResponse.json({
        success: true,
        message: 'Password updated successfully!',
        authMethod: use2FA ? '2FA' : 'password',
      });
    } catch (clerkError: any) {
      console.error('Clerk password update error:', clerkError);
      trackSuspiciousActivity(request, 'PASSWORD_UPDATE_FAILED');

      // Handle specific Clerk errors
      if (clerkError.errors && clerkError.errors.length > 0) {
        const error = clerkError.errors[0];
        let errorMessage = error.message || 'Failed to update password';

        // Handle specific error codes
        if (error.code === 'form_password_pwned') {
          errorMessage =
            '🚨 This password has been compromised in a data breach. Please choose a different, more secure password for your safety.';
        } else if (error.code === 'form_password_validation_failed') {
          errorMessage =
            'Password does not meet security requirements. Please ensure it has uppercase, lowercase, numbers, and special characters.';
        } else if (error.code === 'form_password_incorrect') {
          errorMessage =
            'Current password is incorrect. Please check your current password and try again.';
        }

        return NextResponse.json(
          {
            error: errorMessage,
            code: error.code,
          },
          { status: 400 }
        );
      }

      return NextResponse.json(
        {
          error:
            'Failed to update password. Please try again with a different password.',
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('❌ [PASSWORD] Password update error:', error);
    trackSuspiciousActivity(request, 'PASSWORD_ENDPOINT_ERROR');

    // ✅ SECURITY: Don't expose detailed error information
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'An unexpected error occurred. Please try again later.',
      },
      { status: 500 }
    );
  }
}

// ✅ SECURITY: GET endpoint for password status (with rate limiting)
export async function GET(request: NextRequest) {
  try {
    // Apply general rate limiting to GET requests
    const rateLimitResult = await rateLimitPassword()(request);
    if (!rateLimitResult.success) {
      return rateLimitResult.error;
    }

    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    return NextResponse.json({
      hasPassword: user.passwordEnabled,
      userId: user.id,
      message: 'Password status retrieved successfully',
    });
  } catch (error) {
    console.error('❌ [PASSWORD] Password status error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get password status',
        message: 'Could not retrieve password information',
      },
      { status: 500 }
    );
  }
}
