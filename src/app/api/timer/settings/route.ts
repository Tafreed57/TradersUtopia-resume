import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { rateLimitServer, trackSuspiciousActivity } from '@/lib/rate-limit';
import { strictCSRFValidation } from '@/lib/csrf';
import { z } from 'zod';

// Timer settings schema
const timerSettingsSchema = z.object({
  duration: z.number().min(1).max(168), // 1 hour to 7 days (168 hours)
  message: z.string().min(1).max(200), // Timer message
  priceMessage: z.string().min(1).max(100), // Price increase message
});

// Helper function to get or create the active timer
async function getActiveTimer() {
  let timer = await db.timer.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'desc' },
  });

  // If no active timer exists, create a default one
  if (!timer) {
    timer = await db.timer.create({
      data: {
        startTime: new Date(),
        duration: 72, // 72 hours default
        message: 'Lock in current pricing before increase',
        priceMessage: 'Next price increase: $199/month',
        isActive: true,
      },
    });
  }

  return timer;
}

// GET - Retrieve timer settings
export async function GET(request: NextRequest) {
  try {
    // Rate limiting for general requests
    const rateLimitResult = await rateLimitServer()(request);
    if (!rateLimitResult.success) {
      return rateLimitResult.error;
    }

    const timer = await getActiveTimer();

    // Calculate current time remaining
    const currentTime = Date.now();
    const startTime = timer.startTime.getTime();
    const elapsedHours = (currentTime - startTime) / (1000 * 60 * 60);
    const remainingHours = Math.max(0, timer.duration - elapsedHours);

    // If timer expired, reset it
    if (remainingHours <= 0) {
      const updatedTimer = await db.timer.update({
        where: { id: timer.id },
        data: {
          startTime: new Date(),
        },
      });

      const newRemainingHours = updatedTimer.duration;

      return NextResponse.json({
        success: true,
        settings: {
          startTime: updatedTimer.startTime.getTime(),
          duration: updatedTimer.duration,
          message: updatedTimer.message,
          priceMessage: updatedTimer.priceMessage,
          remainingHours: newRemainingHours,
          isExpired: false,
        },
      });
    }

    return NextResponse.json({
      success: true,
      settings: {
        startTime: timer.startTime.getTime(),
        duration: timer.duration,
        message: timer.message,
        priceMessage: timer.priceMessage,
        remainingHours,
        isExpired: false,
      },
    });
  } catch (error) {
    console.error('Error getting timer settings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Update timer settings (admin only)
export async function POST(request: NextRequest) {
  try {
    // CSRF protection for admin operations
    const csrfValid = await strictCSRFValidation(request);
    if (!csrfValid) {
      trackSuspiciousActivity(request, 'TIMER_SETTINGS_CSRF_VALIDATION_FAILED');
      return NextResponse.json(
        {
          error: 'CSRF validation failed',
          message: 'Invalid security token. Please refresh and try again.',
        },
        { status: 403 }
      );
    }

    // Rate limiting for admin operations
    const rateLimitResult = await rateLimitServer()(request);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(request, 'TIMER_SETTINGS_RATE_LIMIT_EXCEEDED');
      return rateLimitResult.error;
    }

    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Check if user is admin
    const adminProfile = await db.profile.findFirst({
      where: { userId: user.id, isAdmin: true },
    });

    if (!adminProfile) {
      trackSuspiciousActivity(request, 'NON_ADMIN_TIMER_SETTINGS_ATTEMPT');
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = timerSettingsSchema.parse(body);

    // Get the current active timer or create one
    const currentTimer = await getActiveTimer();

    // Update the timer settings and reset the start time
    const updatedTimer = await db.timer.update({
      where: { id: currentTimer.id },
      data: {
        startTime: new Date(), // Reset timer when settings change
        duration: validatedData.duration,
        message: validatedData.message,
        priceMessage: validatedData.priceMessage,
      },
    });

    console.log(
      `🕒 [TIMER] Admin ${adminProfile.email} updated timer settings:`,
      {
        duration: updatedTimer.duration,
        message: updatedTimer.message,
        priceMessage: updatedTimer.priceMessage,
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Timer settings updated successfully',
      settings: {
        startTime: updatedTimer.startTime.getTime(),
        duration: updatedTimer.duration,
        message: updatedTimer.message,
        priceMessage: updatedTimer.priceMessage,
        remainingHours: updatedTimer.duration,
        isExpired: false,
      },
    });
  } catch (error) {
    console.error('Error updating timer settings:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
