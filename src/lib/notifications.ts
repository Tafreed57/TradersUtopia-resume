import { sendPushNotification } from '@/lib/push-notifications';
import { NotificationType } from '@prisma/client';
import { UserService } from '@/services/database/user-service';
import { NotificationService } from '@/services/database/notification-service';

interface Notification {
  userId: string;
  type:
    | 'MESSAGE'
    | 'MENTION'
    | 'SERVER_UPDATE'
    | 'FRIEND_REQUEST'
    | 'SYSTEM'
    | 'PAYMENT'
    | 'SECURITY';
  title: string;
  message: string;
  actionUrl?: string;
}
// Database notification functions

/**
 * Enhanced notification creation with subscription checking and push notifications
 * Refactored to use the new database service pattern
 */
export async function createNotification({
  userId,
  type,
  title,
  message,
  actionUrl,
  metadata,
}: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  actionUrl?: string | null;
  metadata?: Record<string, any>;
}) {
  try {
    const userService = new UserService();
    const notificationService = new NotificationService();

    // Get user with subscription data
    const user = await userService.findUserWithSubscriptionData(userId);

    if (!user) {
      console.warn(`⚠️ [NOTIFICATION] User not found: ${userId}`);
      return null;
    }

    // Create the database notification using the service
    const notification = await notificationService.createNotification({
      userId,
      type,
      title,
      message,
      actionUrl: actionUrl || undefined, // Convert null to undefined
      metadata: metadata || undefined,
    });

    // For push notifications, we'll use a simplified approach for now
    // since the push notification system needs to be updated to work with the new schema
    // TODO: Update push notification system to work with new User/PushSubscription schema

    // Send push notification (fire and forget)
    sendPushNotification({
      userId,
      title,
      message,
      type,
      actionUrl: actionUrl || undefined,
    }).catch(error => {
      console.error(`❌ [PUSH] Failed to send push notification:`, error);
    });

    return notification;
  } catch (error) {
    console.error('❌ [NOTIFICATION] Failed to create notification:', error);
    return null;
  }
}

/**
 * Get unread notifications for a user
 */
export async function getUnreadNotifications(userId: string) {
  try {
    const notificationService = new NotificationService();
    return await notificationService.getUnreadNotifications(userId);
  } catch (error) {
    console.error('Failed to fetch notifications:', error);
    return [];
  }
}

/**
 * Mark a notification as read
 */
export async function markNotificationAsRead(
  notificationId: string,
  userId?: string
) {
  try {
    const notificationService = new NotificationService();
    return await notificationService.markNotificationAsRead(
      notificationId,
      userId
    );
  } catch (error) {
    console.error('Failed to mark notification as read:', error);
    return false;
  }
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsAsRead(userId: string) {
  try {
    const notificationService = new NotificationService();
    return await notificationService.markAllNotificationsAsRead(userId);
  } catch (error) {
    console.error('Failed to mark all notifications as read:', error);
    return false;
  }
}
