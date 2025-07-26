import { NextRequest, NextResponse } from 'next/server';
import { getCurrentProfileForAuth } from '@/lib/query';
import {
  getUnreadNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  createNotification,
} from '@/lib/notifications';
import {
  rateLimitNotification,
  trackSuspiciousActivity,
} from '@/lib/rate-limit';
import { validateInput, notificationActionSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  try {
    // ✅ SECURITY: Rate limiting for notification access
    const rateLimitResult = await rateLimitNotification()(request);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(request, 'NOTIFICATIONS_GET_RATE_LIMIT_EXCEEDED');
      return rateLimitResult.error;
    }

    // ✅ SECURITY: Authentication check
    const user = await getCurrentProfileForAuth();
    if (!user) {
      trackSuspiciousActivity(request, 'UNAUTHENTICATED_NOTIFICATIONS_ACCESS');
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // FIX: Use Clerk userId instead of Prisma profile id for notifications
    const notifications = await getUnreadNotifications(user.userId);

    console.log(
      '📬 [NOTIFICATIONS] Fetched notifications for user:',
      user.userId
    );
    console.log('📬 [NOTIFICATIONS] Notification count:', notifications.length);
    // console.log(
    //   '📬 [NOTIFICATIONS] Notifications:'
    //   // notifications.map(n => ({ id: n.id, type: n.type, title: n.title }))
    // );

    return NextResponse.json({
      notifications,
      count: notifications.length,
      unreadCount: notifications.length, // Add unreadCount for compatibility
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ [NOTIFICATIONS] Fetch notifications error:', error);
    trackSuspiciousActivity(request, 'NOTIFICATIONS_FETCH_ERROR');

    return NextResponse.json(
      {
        error: 'Failed to fetch notifications',
        message: 'Could not retrieve notifications at this time',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // ✅ SECURITY: Rate limiting for notification operations
    const rateLimitResult = await rateLimitNotification()(request);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(request, 'NOTIFICATIONS_RATE_LIMIT_EXCEEDED');
      return rateLimitResult.error;
    }

    // ✅ SECURITY: Authentication check
    const user = await getCurrentProfileForAuth();
    if (!user) {
      trackSuspiciousActivity(request, 'UNAUTHENTICATED_NOTIFICATIONS_ACTION');
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // ✅ SECURITY: Input validation
    const validationResult = await validateInput(notificationActionSchema)(
      request
    );
    if (!validationResult.success) {
      trackSuspiciousActivity(request, 'INVALID_NOTIFICATIONS_INPUT');
      return validationResult.error;
    }

    const { action, notificationId, type, title, message, actionUrl } =
      validationResult.data;

    // ✅ SECURITY: Enhanced operation handling with logging
    if (action === 'create') {
      if (!type || !title || !message) {
        trackSuspiciousActivity(request, 'INCOMPLETE_NOTIFICATION_DATA');
        return NextResponse.json(
          {
            error: 'Missing required fields',
            message:
              'Type, title, and message are required for creating notifications',
          },
          { status: 400 }
        );
      }

      console.log(
        `📢 [NOTIFICATIONS] Creating notification for user: ${user.id}, type: ${type}, title: ${title}`
      );

      const notification = await createNotification({
        userId: user.id,
        type: type as any,
        title,
        message,
        actionUrl,
      });

      if (notification) {
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
      } else {
        trackSuspiciousActivity(request, 'NOTIFICATION_CREATION_FAILED');
        return NextResponse.json(
          {
            error: 'Failed to create notification',
            message: 'Could not create notification at this time',
          },
          { status: 500 }
        );
      }
    }

    if (action === 'mark_read' && notificationId) {
      console.log(
        `📖 [NOTIFICATIONS] Marking notification as read: ${notificationId} for user: ${user.id}`
      );

      const success = await markNotificationAsRead(notificationId);
      if (success) {
        return NextResponse.json({
          success: true,
          message: 'Notification marked as read',
          notificationId,
        });
      } else {
        trackSuspiciousActivity(request, 'NOTIFICATION_MARK_READ_FAILED');
        return NextResponse.json(
          {
            error: 'Failed to mark notification as read',
            message: 'Could not update notification status',
          },
          { status: 500 }
        );
      }
    }

    if (action === 'mark_all_read') {
      console.log(
        `📖 [NOTIFICATIONS] Marking all notifications as read for user: ${user.userId}`
      );

      // FIX: Use Clerk userId instead of Prisma profile id
      const success = await markAllNotificationsAsRead(user.userId);
      if (success) {
        return NextResponse.json({
          success: true,
          message: 'All notifications marked as read',
          userId: user.userId,
        });
      } else {
        trackSuspiciousActivity(request, 'NOTIFICATION_MARK_ALL_READ_FAILED');
        return NextResponse.json(
          {
            error: 'Failed to mark all notifications as read',
            message: 'Could not update notification status',
          },
          { status: 500 }
        );
      }
    }

    if (action === 'delete' && notificationId) {
      console.log(
        `🗑️ [NOTIFICATIONS] Delete action requested for notification: ${notificationId}`
      );
      // Note: Delete functionality would need to be implemented in notifications lib
      return NextResponse.json(
        {
          error: 'Delete action not yet implemented',
          message: 'Notification deletion is not currently available',
        },
        { status: 501 }
      );
    }

    // Should not reach here due to validation, but extra safety
    trackSuspiciousActivity(request, 'INVALID_NOTIFICATION_ACTION');
    return NextResponse.json(
      {
        error: 'Invalid action',
        message: 'The requested action is not supported',
      },
      { status: 400 }
    );
  } catch (error) {
    console.error('❌ [NOTIFICATIONS] Notification action error:', error);
    trackSuspiciousActivity(request, 'NOTIFICATIONS_ACTION_ERROR');

    return NextResponse.json(
      {
        error: 'Failed to process notification action',
        message: 'An internal error occurred while processing your request',
      },
      { status: 500 }
    );
  }
}
