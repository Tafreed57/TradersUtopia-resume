import { NextRequest, NextResponse } from 'next/server';
import { withAuth, authHelpers } from '@/middleware/auth-middleware';
import { TimerService } from '@/services/database/timer-service';
import { apiLogger } from '@/lib/enhanced-logger';
import { ValidationError, withErrorHandling } from '@/lib/error-handling';
import { z } from 'zod';

// Timer settings schema
const timerSettingsSchema = z.object({
  duration: z.number().min(1).max(168), // 1 hour to 7 days (168 hours)
  message: z.string().min(1).max(200), // Timer message
  priceMessage: z.string().min(1).max(100), // Price increase message
});

/**
 * Get Timer Settings
 * Returns current timer configuration and remaining time
 * Public route - no authentication required
 */
export const GET = withErrorHandling(async (req: NextRequest) => {
  const timerService = new TimerService();

  try {
    // Get timer settings using service layer (auto-handles expiry)
    const timer = await timerService.getTimer();

    apiLogger.databaseOperation('timer_settings_retrieved', true, {
      remainingHours: timer.remainingHours,
      isExpired: timer.isExpired,
      public: true,
    });

    return NextResponse.json({
      success: true,
      timer,
    });
  } catch (error) {
    apiLogger.databaseOperation('timer_settings_retrieval_failed', false, {
      error: error instanceof Error ? error.message : 'Unknown error',
      public: true,
    });

    throw new ValidationError(
      'Failed to get timer settings: ' +
        (error instanceof Error ? error.message : 'Unknown error')
    );
  }
}, 'get_timer_public');

/**
 * Update Timer Settings
 * Admin-only operation for updating timer configuration
 */
export const POST = withAuth(async (req: NextRequest, { user, isAdmin }) => {
  // Only global admins can update timer settings
  if (!isAdmin) {
    throw new ValidationError('Admin access required');
  }

  // Step 1: Input validation
  const body = await req.json();
  const validationResult = timerSettingsSchema.safeParse(body);
  if (!validationResult.success) {
    throw new ValidationError(
      'Invalid timer settings: ' +
        validationResult.error.issues.map(i => i.message).join(', ')
    );
  }

  const validatedData = validationResult.data;
  const timerService = new TimerService();

  try {
    // Step 2: Update timer settings using service layer
    const updatedTimer = await timerService.updateTimerSettings(
      validatedData,
      user.id
    );

    apiLogger.databaseOperation('timer_settings_updated_via_api', true, {
      adminId: user.id.substring(0, 8) + '***',
      duration: validatedData.duration,
      message: validatedData.message.substring(0, 20) + '...',
      priceMessage: validatedData.priceMessage.substring(0, 20) + '...',
    });

    console.log(
      `🕒 [TIMER] Admin updated timer settings: ${validatedData.duration}h, "${validatedData.message}"`
    );

    return NextResponse.json({
      success: true,
      message: 'Timer settings updated successfully',
      settings: {
        startTime: updatedTimer.startTime.getTime(),
        duration: updatedTimer.duration,
        message: updatedTimer.message,
        priceMessage: updatedTimer.priceMessage,
        remainingHours: updatedTimer.remainingHours,
        isExpired: updatedTimer.isExpired,
      },
    });
  } catch (error) {
    apiLogger.databaseOperation('timer_settings_update_failed', false, {
      adminId: user.id.substring(0, 8) + '***',
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    throw new ValidationError(
      'Failed to update timer settings: ' +
        (error instanceof Error ? error.message : 'Unknown error')
    );
  }
}, authHelpers.adminOnly('UPDATE_TIMER_SETTINGS'));
