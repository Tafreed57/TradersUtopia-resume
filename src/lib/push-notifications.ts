import webpush from 'web-push';
import { UserService } from '@/services/database/user-service';

// Configure web-push with proper VAPID subject
let vapidSubject: string;

if (process.env.NODE_ENV === 'production') {
  // In production, use HTTPS URL or fallback to mailto
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl && appUrl.startsWith('https://')) {
    vapidSubject = appUrl;
  } else {
    vapidSubject = 'mailto:notifications@tradersutopia.com';
  }
} else {
  // In development, always use mailto format (VAPID doesn't accept http://)
  vapidSubject = 'mailto:admin@tradersutopia.dev';
}

// Only configure if we have the required keys
if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(
      vapidSubject,
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
    // ✅ PERFORMANCE: Only log VAPID setup once, not on every import
    // Note: VAPID configured successfully (no console output for performance)
  } catch (error) {
    console.error('❌ [PUSH] Failed to configure VAPID details:', error);
  }
} else {
  if (process.env.NODE_ENV === 'development') {
    console.warn(
      '⚠️ [PUSH] VAPID keys not found - push notifications disabled'
    );
  }
}

interface PushNotificationData {
  userId: string;
  title: string;
  message: string;
  type: string;
  actionUrl?: string;
  icon?: string;
}

interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

const getNotificationIcon = (type: string): string => {
  const iconMap: Record<string, string> = {
    SYSTEM: '⚙️',
    SECURITY: '🔒',
    PAYMENT: '💳',
    MESSAGE: '💬',
    MENTION: '👤',
    SERVER_UPDATE: '📢',
  };
  return iconMap[type] || '📔';
};

export async function sendPushNotification(
  data: PushNotificationData
): Promise<boolean> {
  try {
    // Initialize UserService
    const userService = new UserService();

    // Get user's push subscriptions using the service
    const user = await userService.getUserWithPushSubscriptions(data.userId);

    if (
      !user ||
      !user.pushSubscriptions ||
      user.pushSubscriptions.length === 0
    ) {
      // ✅ PERFORMANCE: Skip logging for better performance
      return false;
    }

    const pushSubscriptions = user.pushSubscriptions;
    let successCount = 0;
    let failureCount = 0;
    const invalidEndpoints: string[] = [];

    // Prepare notification payload
    const payload = JSON.stringify({
      title: data.title,
      body: data.message,
      icon: '/logo.png',
      badge: '/logo.png',
      image: '/logo.png',
      data: {
        url: data.actionUrl || '/',
        type: data.type,
        timestamp: Date.now(),
      },
      actions: data.actionUrl
        ? [
            {
              action: 'open',
              title: 'View',
              icon: '/logo.png',
            },
          ]
        : [],
      requireInteraction: data.type === 'SECURITY', // Security notifications require interaction
      silent: false,
      tag: `${data.type.toLowerCase()}-${Date.now()}`, // Prevent duplicate notifications
      renotify: true,
    });

    // Send to all user's subscriptions
    const sendPromises = pushSubscriptions.map(
      async (subscription: PushSubscription, index: number) => {
        try {
          await webpush.sendNotification(subscription, payload, {
            TTL: 24 * 60 * 60, // 24 hours
            urgency: data.type === 'SECURITY' ? 'high' : 'normal',
          });

          // ✅ PERFORMANCE: Notification sent (no console output for performance)
          successCount++;
          return true;
        } catch (error: any) {
          console.error(
            `❌ [PUSH] Failed to send to subscription ${index + 1}:`,
            error
          );

          // If subscription is invalid (410 Gone), mark it for removal
          if (error.statusCode === 410 || error.statusCode === 404) {
            invalidEndpoints.push(subscription.endpoint);
          }

          failureCount++;
          return false;
        }
      }
    );

    await Promise.all(sendPromises);

    // Clean up invalid subscriptions if any were found
    if (invalidEndpoints.length > 0) {
      await userService.removeInvalidPushSubscriptions(
        data.userId,
        invalidEndpoints
      );
    }

    // ✅ PERFORMANCE: Push notification results (no console output for performance)
    return successCount > 0;
  } catch (error) {
    console.error('❌ [PUSH] Error sending push notification:', error);
    return false;
  }
}

export async function subscribeToPushNotifications(
  userId: string,
  subscription: PushSubscription
): Promise<boolean> {
  try {
    // Initialize UserService
    const userService = new UserService();

    // Use the service to upsert the push subscription
    const success = await userService.upsertPushSubscription(
      userId,
      subscription
    );

    if (success) {
      console.log('✅ [PUSH] Push subscription saved successfully');
    }

    return success;
  } catch (error) {
    console.error('❌ [PUSH] Error saving push subscription:', error);
    console.error('❌ [PUSH] Full error details:', error);
    return false;
  }
}
