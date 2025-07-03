import { db } from '@/lib/db';
import { sendPushNotification } from '@/lib/push-notifications';

// Database notification functions
export async function createNotification({
  userId,
  type,
  title,
  message,
  actionUrl,
}: {
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
}) {
  try {
    // Create the database notification
    const notification = await db.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        actionUrl,
      },
    });

    // Get user profile with preferences
    const profile = await db.profile.findFirst({
      where: { userId },
      select: {
        name: true,
        pushNotifications: true,
      },
    });

    if (!profile) {
      console.warn(`⚠️ [NOTIFICATION] Profile not found for user: ${userId}`);
      return notification;
    }

    // Parse push notification preferences (with defaults)
    const pushPrefs = (profile.pushNotifications as any) || {
      system: true,
      security: true,
      payment: true,
      messages: true,
      mentions: true,
      serverUpdates: false,
    };

    // Map notification types to preference keys
    const typeMapping: Record<string, keyof typeof pushPrefs> = {
      SYSTEM: 'system',
      SECURITY: 'security',
      PAYMENT: 'payment',
      MESSAGE: 'messages',
      MENTION: 'mentions',
      SERVER_UPDATE: 'serverUpdates',
      FRIEND_REQUEST: 'messages', // Treat as messages
    };

    const prefKey = typeMapping[type] || 'system';

    // Send push notification if enabled
    if (pushPrefs[prefKey]) {
      if (process.env.NODE_ENV === 'development') {
        console.log(
          `📱 [NOTIFICATION] Sending push notification for ${type} to user: ${userId}`
        );
      }

      sendPushNotification({
        userId,
        title,
        message,
        type,
        actionUrl,
      }).catch(error => {
        console.error(`❌ [PUSH] Failed to send push notification:`, error);
      });
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(
        `✅ [NOTIFICATION] Created ${type} notification for user: ${userId}`
      );
    }
    return notification;
  } catch (error) {
    console.error('❌ [NOTIFICATION] Failed to create notification:', error);
    return null;
  }
}

export async function getUnreadNotifications(userId: string) {
  try {
    const notifications = await db.notification.findMany({
      where: {
        userId,
        read: false,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50, // Limit to recent 50 notifications
    });
    return notifications;
  } catch (error) {
    console.error('Failed to fetch notifications:', error);
    return [];
  }
}

export async function markNotificationAsRead(notificationId: string) {
  try {
    await db.notification.update({
      where: { id: notificationId },
      data: { read: true },
    });
    return true;
  } catch (error) {
    console.error('Failed to mark notification as read:', error);
    return false;
  }
}

export async function markAllNotificationsAsRead(userId: string) {
  try {
    await db.notification.updateMany({
      where: {
        userId,
        read: false,
      },
      data: { read: true },
    });
    return true;
  } catch (error) {
    console.error('Failed to mark all notifications as read:', error);
    return false;
  }
}
