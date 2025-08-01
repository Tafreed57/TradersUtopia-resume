import { NextRequest, NextResponse } from 'next/server';
import { withAuth, authHelpers } from '@/middleware/auth-middleware';
import { apiLogger } from '@/lib/enhanced-logger';
import { ValidationError } from '@/lib/error-handling';
import { z } from 'zod';
import {
  sendAdminAnnouncement,
  processBatchNotifications,
} from '@/trigger/batch-notifications';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Schema for batch notification creation
const batchNotificationSchema = z.object({
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(1000),
  actionUrl: z.string().url().optional(),
  targetUserType: z.enum(['all', 'subscribers', 'admins']).default('all'),
  userIds: z.array(z.string()).optional(), // For custom user targeting
});

/**
 * Create Batch Notification (Admin Only)
 * Triggers batch notifications to multiple users
 */
export const POST = withAuth(async (req: NextRequest, { user, isAdmin }) => {
  // Only admins can create batch notifications
  if (!isAdmin) {
    throw new ValidationError(
      'Only administrators can create batch notifications'
    );
  }

  // Step 1: Input validation
  const body = await req.json();
  let validatedData;
  try {
    validatedData = batchNotificationSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(
        'Invalid batch notification data: ' +
          error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      );
    }
    throw error;
  }

  try {
    let jobHandle;

    // Determine which job to trigger based on request
    if (validatedData.userIds && validatedData.userIds.length > 0) {
      // Custom user targeting - use direct batch notification
      jobHandle = await processBatchNotifications.trigger({
        userIds: validatedData.userIds,
        notification: {
          type: 'ADMIN_ANNOUNCEMENT',
          title: validatedData.title,
          message: validatedData.message,
          actionUrl: validatedData.actionUrl,
        },
        metadata: {
          isCustomTargeting: true,
          createdBy: user.id,
          createdByName: user.name || user.email,
          timestamp: new Date().toISOString(),
        },
      });

      apiLogger.databaseOperation('batch_notification_custom_triggered', true, {
        jobId: jobHandle.id.substring(0, 8) + '***',
        userId: user.id.substring(0, 8) + '***',
        targetUsers: validatedData.userIds.length,
        title: validatedData.title.substring(0, 50) + '...',
      });
    } else {
      // Use admin announcement helper for automatic user targeting
      jobHandle = await sendAdminAnnouncement.trigger({
        title: validatedData.title,
        message: validatedData.message,
        actionUrl: validatedData.actionUrl,
        targetUserType: validatedData.targetUserType,
      });

      apiLogger.databaseOperation('admin_announcement_triggered', true, {
        jobId: jobHandle.id.substring(0, 8) + '***',
        userId: user.id.substring(0, 8) + '***',
        targetUserType: validatedData.targetUserType,
        title: validatedData.title.substring(0, 50) + '...',
      });
    }

    return NextResponse.json({
      success: true,
      jobId: jobHandle.id,
      message: 'Batch notification job triggered successfully',
      targetUserType: validatedData.targetUserType,
      customTargeting: !!(
        validatedData.userIds && validatedData.userIds.length > 0
      ),
      targetUserCount: validatedData.userIds?.length || 'auto-determined',
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    // Log the error
    apiLogger.databaseOperation('batch_notification_trigger_failed', false, {
      userId: user.id.substring(0, 8) + '***',
      targetUserType: validatedData.targetUserType,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        error: 'Failed to trigger batch notification',
        message: 'An error occurred while starting the batch notification job',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}, authHelpers.adminOnly('CREATE_BATCH_NOTIFICATION'));

/**
 * Get Batch Notification History (Admin Only)
 * Returns recent batch notification jobs
 */
export const GET = withAuth(async (req: NextRequest, { user, isAdmin }) => {
  // Only admins can view batch notification history
  if (!isAdmin) {
    throw new ValidationError(
      'Only administrators can view batch notification history'
    );
  }

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '10'), 50);
  const offset = Math.max(parseInt(url.searchParams.get('offset') || '0'), 0);

  try {
    // Note: This is a simplified response. In a real implementation,
    // you might want to store batch notification history in your database
    // or use Trigger.dev's API to fetch job history

    apiLogger.databaseOperation('batch_notification_history_requested', true, {
      userId: user.id.substring(0, 8) + '***',
      limit,
      offset,
    });

    return NextResponse.json({
      message: 'Batch notification history endpoint',
      note: 'Use the individual job status endpoint (/api/notifications/jobs/[jobId]) to check specific job statuses',
      limit,
      offset,
      // In a full implementation, you would return actual job history here
      jobs: [],
      instructions: {
        createBatchNotification: 'POST /api/notifications/batch',
        checkJobStatus: 'GET /api/notifications/jobs/[jobId]',
        cancelJob: 'DELETE /api/notifications/jobs/[jobId]',
      },
    });
  } catch (error) {
    apiLogger.databaseOperation('batch_notification_history_error', false, {
      userId: user.id.substring(0, 8) + '***',
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        error: 'Failed to retrieve batch notification history',
        message: 'An error occurred while fetching the notification history',
      },
      { status: 500 }
    );
  }
}, authHelpers.adminOnly('VIEW_BATCH_NOTIFICATION_HISTORY'));
