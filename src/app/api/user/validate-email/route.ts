import { NextRequest, NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { z } from 'zod';

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
