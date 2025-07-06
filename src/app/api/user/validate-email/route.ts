import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismadb';
import { z } from 'zod';
import { auth } from '@clerk/nextjs/server';
import { rateLimitGeneral, trackSuspiciousActivity } from '@/lib/rate-limit';

const emailValidationSchema = z.object({
  email: z.string().email('Invalid email format'),
});

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
    const { email } = emailValidationSchema.parse(body);

    // Check if a profile exists with this email
    const profile = await prisma.profile.findFirst({
      where: {
        email: {
          equals: email,
          mode: 'insensitive', // Case-insensitive search
        },
      },
      select: {
        id: true,
        email: true,
      },
    });

    return NextResponse.json({
      exists: !!profile,
      email: email,
    });
  } catch (error: any) {
    console.error('Email validation error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid input',
          message: 'Please provide a valid email address',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: 'Email validation failed',
        message: 'Unable to validate email address',
      },
      { status: 500 }
    );
  }
}
