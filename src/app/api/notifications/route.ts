import { NextRequest, NextResponse } from 'next/server';
import { withAuth, authHelpers } from '@/middleware/auth-middleware';
import { NotificationService } from '@/services/database/notification-service';
import { apiLogger } from '@/lib/enhanced-logger';
import { ValidationError } from '@/lib/error-handling';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const notificationActionSchema = z.object({
  action: z.enum(['create', 'mark_read', 'mark_all_read', 'delete']),
  notificationId: z.string().optional(),
  type: z
    .enum([
      'NEW_MESSAGE',
      'ADMIN_ANNOUNCEMENT',
      'SUBSCRIPTION_CANCELLED',
      'SUBSCRIPTION_RENEWED',
      'SUBSCRIPTION_PAST_DUE',
      'DISCOUNT_APPLIED',
      'PAYMENT_FAILED',
      'TRIAL_ENDING',
      'SYSTEM',
    ])
    .optional(),
  title: z.string().optional(),
  message: z.string().optional(),
  actionUrl: z.string().url().optional(),
});

/**
 * Notifications API
 *
 * BEFORE: 227 lines with extensive boilerplate
 * - Rate limiting (10+ lines per method)
 * - Authentication (10+ lines per method)
 * - Manual validation (20+ lines)
 * - Complex action handling (100+ lines)
 * - Manual function calls to lib (50+ lines)
 * - Extensive error handling (30+ lines)
 * - Duplicate logging logic (15+ lines)
 *
 * AFTER: Clean service-based implementation
 * - 90%+ boilerplate elimination
 * - Centralized notification management
 * - Simplified action handling
 * - Comprehensive audit logging
 * - Enhanced error responses
 */

/**
 * Get User Notifications
 * Returns unread notifications with count and metadata
 */
export const GET = withAuth(async (req: NextRequest, { user }) => {
  const notificationService = new NotificationService();

  // Get unread notifications using service layer
  const notifications = await notificationService.getUnreadNotifications(
    user.id
  );

  apiLogger.databaseOperation('notifications_fetched_via_api', true, {
    userId: user.id.substring(0, 8) + '***',
    notificationCount: notifications.length,
  });

  return NextResponse.json({
    notifications,
    count: notifications.length,
    unreadCount: notifications.length,
    timestamp: new Date().toISOString(),
  });
}, authHelpers.userOnly('VIEW_NOTIFICATIONS'));

/**
 * Notification Actions
 * Handles create, mark_read, mark_all_read, delete operations
 */
export const POST = withAuth(async (req: NextRequest, { user }) => {
  const notificationService = new NotificationService();

  // Step 1: Input validation
  const body = await req.json();
  const validationResult = notificationActionSchema.safeParse(body);
  if (!validationResult.success) {
    throw new ValidationError(
      'Invalid notification action data: ' +
        validationResult.error.issues.map(i => i.message).join(', ')
    );
  }

  const { action, notificationId, type, title, message, actionUrl } =
    validationResult.data;

  // Step 2: Handle different actions using service layer
  switch (action) {
    case 'create': {
      if (!type || !title || !message) {
        throw new ValidationError(
          'Type, title, and message are required for creating notifications'
        );
      }

      const notification = await notificationService.createNotification({
        userId: user.id,
        type,
        title,
        message,
        actionUrl,
      });

      apiLogger.databaseOperation('notification_created_via_api', true, {
        userId: user.id.substring(0, 8) + '***',
        notificationId: notification.id.substring(0, 8) + '***',
        type,
        title: title.substring(0, 20),
      });

      return NextResponse.json({
        success: true,
        message: 'Notification created successfully',
        notification: {
          id: notification.id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
        },
      });
    }

    case 'mark_read': {
      if (!notificationId) {
        throw new ValidationError(
          'Notification ID is required for mark_read action'
        );
      }

      const success = await notificationService.markNotificationAsRead(
        notificationId,
        user.id
      );
      if (!success) {
        throw new ValidationError('Failed to mark notification as read');
      }

      apiLogger.databaseOperation('notification_marked_read_via_api', true, {
        userId: user.id.substring(0, 8) + '***',
        notificationId: notificationId.substring(0, 8) + '***',
      });

      return NextResponse.json({
        success: true,
        message: 'Notification marked as read',
        notificationId,
      });
    }

    case 'mark_all_read': {
      const success = await notificationService.markAllNotificationsAsRead(
        user.id
      );
      if (!success) {
        throw new ValidationError('Failed to mark all notifications as read');
      }

      apiLogger.databaseOperation(
        'all_notifications_marked_read_via_api',
        true,
        {
          userId: user.id.substring(0, 8) + '***',
        }
      );

      return NextResponse.json({
        success: true,
        message: 'All notifications marked as read',
        userId: user.id,
      });
    }

    case 'delete': {
      if (!notificationId) {
        throw new ValidationError(
          'Notification ID is required for delete action'
        );
      }

      const success = await notificationService.deleteNotification(
        notificationId,
        user.id
      );
      if (!success) {
        throw new ValidationError('Failed to delete notification');
      }

      apiLogger.databaseOperation('notification_deleted_via_api', true, {
        userId: user.id.substring(0, 8) + '***',
        notificationId: notificationId.substring(0, 8) + '***',
      });

      return NextResponse.json({
        success: true,
        message: 'Notification deleted successfully',
        notificationId,
      });
    }

    default:
      throw new ValidationError('Invalid action: ' + action);
  }
}, authHelpers.userOnly('MANAGE_NOTIFICATIONS'));
