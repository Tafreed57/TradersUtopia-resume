import { NextRequest, NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { z } from 'zod';
import { auth } from '@clerk/nextjs/server';
import { rateLimitGeneral, trackSuspiciousActivity } from '@/lib/rate-limit';

const validateEmailSchema = z.object({
  email: z.string().email('Invalid email address'),
});

// Add a simple GET method to test if the route is being recognized
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Email validation API is working',
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request: NextRequest) {
  try {
    // ✅ SECURITY FIX: Add rate limiting to prevent abuse
    const rateLimitResult = await rateLimitGeneral()(request);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(request, 'EMAIL_VALIDATION_RATE_LIMIT_EXCEEDED');
      return rateLimitResult.error;
    }

    // ✅ SECURITY FIX: Require authentication to prevent public user enumeration
    const { userId } = await auth();
    if (!userId) {
      trackSuspiciousActivity(request, 'UNAUTHENTICATED_EMAIL_VALIDATION');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { email } = validateEmailSchema.parse(body);

    // Use Clerk's API to check if a user exists with this email
    try {
      const users = await clerkClient.users.getUserList({
        emailAddress: [email],
      });

      const userExists = users.data.length > 0;

      return NextResponse.json({
        exists: userExists,
        message: userExists
          ? 'Email found in system'
          : 'No account found with this email address',
      });
    } catch (clerkError: any) {
      console.error('[VALIDATE_EMAIL] Clerk API error:', clerkError);

      // If Clerk API fails, return a generic error but don't expose details
      return NextResponse.json(
        {
          exists: false,
          message: 'Unable to validate email at this time. Please try again.',
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('[VALIDATE_EMAIL] Error:', error);

    // Handle validation errors
    if (error.name === 'ZodError') {
      return NextResponse.json(
        {
          error: 'Invalid email format',
          message: 'Please provide a valid email address',
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Unable to validate email at this time',
      },
      { status: 500 }
    );
  }
}
