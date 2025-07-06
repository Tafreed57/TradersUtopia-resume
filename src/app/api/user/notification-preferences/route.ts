import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { rateLimitGeneral, trackSuspiciousActivity } from '@/lib/rate-limit';
import { strictCSRFValidation } from '@/lib/csrf';
import { z } from 'zod';

const preferencesSchema = z.object({
  preferences: z.object({
    push: z.object({
      system: z.boolean(),
      security: z.boolean(),
      payment: z.boolean(),
      messages: z.boolean(),
      mentions: z.boolean(),
      serverUpdates: z.boolean(),
    }),
  }),
});

export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimitGeneral()(request);
    if (!rateLimitResult.success) {
      return rateLimitResult.error;
    }

    // Authentication check
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get user profile with notification preferences
    const profile = await db.profile.findFirst({
      where: { userId: user.id },
      select: {
        pushNotifications: true,
      },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      preferences: {
        push: profile.pushNotifications || {
          system: true,
          security: true,
          payment: true,
          messages: true,
          mentions: true,
          serverUpdates: false,
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to load preferences',
        message: 'Could not retrieve notification preferences',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // ✅ SECURITY FIX: Add CSRF protection
    const csrfValid = await strictCSRFValidation(request);
    if (!csrfValid) {
      trackSuspiciousActivity(request, 'NOTIFICATION_PREFERENCES_CSRF_FAILED');
      return NextResponse.json(
        {
          error: 'CSRF validation failed',
          message: 'Invalid security token. Please refresh and try again.',
        },
        { status: 403 }
      );
    }

    // Rate limiting
    const rateLimitResult = await rateLimitGeneral()(request);
    if (!rateLimitResult.success) {
      return rateLimitResult.error;
    }

    // Authentication check
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { preferences } = preferencesSchema.parse(body);

    // Update user profile with new preferences
    await db.profile.update({
      where: { userId: user.id },
      data: {
        pushNotifications: preferences.push,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Notification preferences updated successfully',
    });
  } catch (error) {
    trackSuspiciousActivity(request, 'NOTIFICATION_PREFERENCES_SAVE_ERROR');

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid input',
          message: 'Invalid preferences format provided.',
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to save preferences',
        message: 'Could not save notification preferences',
      },
      { status: 500 }
    );
  }
}
