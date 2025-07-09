import webpush from 'web-push';
import { db } from '@/lib/db';

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

export interface PushNotificationData {
  userId: string;
  title: string;
  message: string;
  type: string;
  actionUrl?: string;
  icon?: string;
}

export interface PushSubscription {
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
    // Get user's profile with push subscriptions
    const profile = await db.profile.findFirst({
      where: { userId: data.userId },
    });

    if (
      !profile ||
      !profile.pushSubscriptions ||
      profile.pushSubscriptions.length === 0
    ) {
      // ✅ PERFORMANCE: Skip logging for better performance
      return false;
    }

    const pushSubscriptions = profile.pushSubscriptions as any[];
    let successCount = 0;
    let failureCount = 0;

    // Prepare notification payload
    const payload = JSON.stringify({
      title: data.title,
      body: data.message,
      icon: '/logo.svg',
      badge: '/logo.svg',
      image: data.icon || getNotificationIcon(data.type),
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
              icon: '/logo.svg',
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

          // If subscription is invalid (410 Gone), remove it
          if (error.statusCode === 410 || error.statusCode === 404) {
            // Remove invalid subscription from database
            const updatedSubscriptions = pushSubscriptions.filter(
              (_, i) => i !== index
            );
            // ✅ FIX: Use profile.id instead of userId for the database update
            await db.profile.update({
              where: { id: profile.id }, // Use profile.id instead of userId
              data: { pushSubscriptions: updatedSubscriptions },
            });
          }

          failureCount++;
          return false;
        }
      }
    );

    await Promise.all(sendPromises);

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
    const profile = await db.profile.findFirst({
      where: { userId },
    });

    if (!profile) {
      console.error('❌ [PUSH] Profile not found for user:', userId);
      return false;
    }

    const existingSubscriptions = (profile.pushSubscriptions as any[]) || [];

    // Check if subscription already exists
    const existingIndex = existingSubscriptions.findIndex(
      (sub: PushSubscription) => sub.endpoint === subscription.endpoint
    );

    let updatedSubscriptions;
    if (existingIndex >= 0) {
      // Update existing subscription
      updatedSubscriptions = [...existingSubscriptions];
      updatedSubscriptions[existingIndex] = subscription;
    } else {
      // Add new subscription
      updatedSubscriptions = [...existingSubscriptions, subscription];
    }

    // ✅ FIX: Use profile.id instead of userId for the database update
    await db.profile.update({
      where: { id: profile.id }, // Use profile.id instead of userId
      data: { pushSubscriptions: updatedSubscriptions },
    });

    return true;
  } catch (error) {
    console.error('❌ [PUSH] Error saving push subscription:', error);
    console.error('❌ [PUSH] Full error details:', error);
    return false;
  }
}

export async function unsubscribeFromPushNotifications(
  userId: string,
  endpoint: string
): Promise<boolean> {
  try {
    const profile = await db.profile.findFirst({
      where: { userId },
    });

    if (!profile) {
      return false;
    }

    const existingSubscriptions = (profile.pushSubscriptions as any[]) || [];
    const updatedSubscriptions = existingSubscriptions.filter(
      (sub: PushSubscription) => sub.endpoint !== endpoint
    );

    // ✅ FIX: Use profile.id instead of userId for the database update
    await db.profile.update({
      where: { id: profile.id }, // Use profile.id instead of userId
      data: { pushSubscriptions: updatedSubscriptions },
    });

    return true;
  } catch (error) {
    console.error(
      '❌ [PUSH] Error unsubscribing from push notifications:',
      error
    );
    return false;
  }
}

export function generateVAPIDKeys() {
  return webpush.generateVAPIDKeys();
}
