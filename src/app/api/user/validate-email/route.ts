import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismadb';
import { z } from 'zod';

const emailValidationSchema = z.object({
  email: z.string().email('Invalid email format'),
});

export async function POST(request: NextRequest) {
  try {
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
