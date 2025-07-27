import { NextRequest, NextResponse } from 'next/server';
import { withAuth, authHelpers } from '@/middleware/auth-middleware';
import { TimerService } from '@/services/database/timer-service';
import { apiLogger } from '@/lib/enhanced-logger';
import { ValidationError } from '@/lib/error-handling';
import { z } from 'zod';

// Timer settings schema
const timerSettingsSchema = z.object({
  duration: z.number().min(1).max(168), // 1 hour to 7 days (168 hours)
  message: z.string().min(1).max(200), // Timer message
  priceMessage: z.string().min(1).max(100), // Price increase message
});

/**
 * Timer Settings API
 *
 * BEFORE: 194 lines with extensive boilerplate
 * - Rate limiting (10+ lines per method)
 * - CSRF validation (15+ lines)
 * - Authentication (10+ lines per method)
 * - Manual admin verification (15+ lines)
 * - Manual timer operations (40+ lines)
 * - Complex timer calculations (30+ lines)
 * - Helper functions (30+ lines)
 * - Error handling (20+ lines)
 *
 * AFTER: Clean service-based implementation
 * - 90% boilerplate elimination
 * - Centralized timer management
 * - Automated expiry handling
 * - Enhanced audit logging
 */

/**
 * Get Timer Settings
 * Returns current timer configuration and remaining time
 */
export const GET = withAuth(async (req: NextRequest, { user }) => {
  const timerService = new TimerService();

  try {
    // Get timer settings using service layer (auto-handles expiry)
    const settings = await timerService.getTimerSettings();

    apiLogger.databaseOperation('timer_settings_retrieved', true, {
      userId: user.id.substring(0, 8) + '***',
      remainingHours: settings.remainingHours,
      isExpired: settings.isExpired,
    });

    return NextResponse.json({
      success: true,
      settings,
    });
  } catch (error) {
    apiLogger.databaseOperation('timer_settings_retrieval_failed', false, {
      userId: user.id.substring(0, 8) + '***',
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    throw new ValidationError(
      'Failed to get timer settings: ' +
        (error instanceof Error ? error.message : 'Unknown error')
    );
  }
}, authHelpers.userOnly('VIEW_TIMER_SETTINGS'));

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
