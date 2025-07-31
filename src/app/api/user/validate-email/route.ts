import { NextRequest, NextResponse } from 'next/server';
import { withAuth, authHelpers } from '@/middleware/auth-middleware';
import { UserService } from '@/services/database/user-service';
import { apiLogger } from '@/lib/enhanced-logger';
import { ValidationError } from '@/lib/error-handling';
import { z } from 'zod';
import { clerkClient } from '@clerk/nextjs/server';

const validateEmailSchema = z.object({
  email: z.string().email('Invalid email address'),
});

/**
 * Email Validation Test Endpoint
 * Returns API status and availability
 */
export const GET = withAuth(async (req: NextRequest, { user }) => {
  apiLogger.databaseOperation('email_validation_api_accessed', true, {
    userId: user.id.substring(0, 8) + '***',
    timestamp: new Date().toISOString(),
  });

  return NextResponse.json({
    message: 'Email validation API is working',
    version: '2.0-service-optimized',
    timestamp: new Date().toISOString(),
    user: {
      id: user.id.substring(0, 8) + '***',
    },
    performance: {
      optimized: true,
      serviceLayerUsed: true,
    },
  });
}, authHelpers.userOnly('TEST_EMAIL_VALIDATION'));

/**
 * Validate Email Address
 * Checks if an email address exists in the system using Clerk
 */
export const POST = withAuth(async (req: NextRequest, { user }) => {
  // Step 1: Input validation
  const body = await req.json();
  const validationResult = validateEmailSchema.safeParse(body);
  if (!validationResult.success) {
    throw new ValidationError(
      'Invalid email format: ' +
        validationResult.error.issues.map(i => i.message).join(', ')
    );
  }

  const { email } = validationResult.data;

  try {
    // Step 2: Check if email exists using Clerk API
    const clerk = await clerkClient();
    const users = await clerk.users.getUserList({
      emailAddress: [email],
    });

    const userExists = users.data.length > 0;
    const foundUserId = userExists ? users.data[0].id : null;

    apiLogger.databaseOperation('email_validation_performed', true, {
      requestUserId: user.id.substring(0, 8) + '***',
      validatedEmail: email.substring(0, 3) + '***',
      emailExists: userExists,
      foundUserId: foundUserId ? foundUserId.substring(0, 8) + '***' : null,
    });

    console.log(
      `📧 [EMAIL-VALIDATION] Email ${email} validation: ${
        userExists ? 'EXISTS' : 'NOT_FOUND'
      }`
    );

    return NextResponse.json({
      exists: userExists,
      message: userExists
        ? 'Email found in system'
        : 'No account found with this email address',
      performance: {
        optimized: true,
        serviceLayerUsed: true,
      },
    });
  } catch (clerkError: any) {
    apiLogger.databaseOperation('email_validation_failed', false, {
      requestUserId: user.id.substring(0, 8) + '***',
      validatedEmail: email.substring(0, 3) + '***',
      error:
        clerkError instanceof Error
          ? clerkError.message
          : 'Unknown Clerk error',
    });

    console.error('[VALIDATE_EMAIL] Clerk API error:', clerkError);

    // If Clerk API fails, return a generic error but don't expose details
    throw new ValidationError(
      'Unable to validate email at this time. Please try again.'
    );
  }
}, authHelpers.userOnly('VALIDATE_EMAIL'));
