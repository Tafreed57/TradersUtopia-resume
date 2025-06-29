import webpush from 'web-push';
import { db } from '@/lib/db';

// Flag to track if VAPID is configured
let vapidConfigured = false;

// Configure VAPID details only when needed
function ensureVapidConfigured(): boolean {
  if (vapidConfigured) return true;

  // Skip configuration during build time if environment variables are not properly set
  if (
    !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
    !process.env.VAPID_PRIVATE_KEY
  ) {
    console.warn(
      '⚠️ [PUSH] VAPID keys not found - push notifications disabled'
    );
    return false;
  }

  try {
    let vapidSubject: string;

    if (process.env.NODE_ENV === 'production') {
      // In production, use HTTPS URL - fallback to mailto if URL not set
      const appUrl = process.env.NEXT_PUBLIC_APP_URL;
      if (appUrl && appUrl.startsWith('https://')) {
        vapidSubject = appUrl;
      } else {
        vapidSubject = 'mailto:notifications@tradersutopia.com';
      }
    } else {
      // In development, use a simple mailto format that web-push accepts
      vapidSubject = 'mailto:admin@example.com';
    }

    webpush.setVapidDetails(
      vapidSubject,
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );

    vapidConfigured = true;
    console.log('✅ [PUSH] VAPID details configured successfully');
    return true;
  } catch (error) {
    console.error('❌ [PUSH] Failed to configure VAPID details:', error);
    return false;
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
    // Ensure VAPID is configured before sending
    if (!ensureVapidConfigured()) {
      console.warn('⚠️ [PUSH] Cannot send notification - VAPID not configured');
      return false;
    }

    // Get user's profile with push subscriptions
    const profile = await db.profile.findFirst({
      where: { userId: data.userId },
    });

    if (
      !profile ||
      !profile.pushSubscriptions ||
      profile.pushSubscriptions.length === 0
    ) {
      console.log(
        `ℹ️ [PUSH] No push subscriptions found for user: ${data.userId}`
      );
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

          console.log(
            `✅ [PUSH] Notification sent to subscription ${index + 1} for user: ${data.userId}`
          );
          successCount++;
          return true;
        } catch (error: any) {
          console.error(
            `❌ [PUSH] Failed to send to subscription ${index + 1}:`,
            error
          );

          // If subscription is invalid (410 Gone), remove it
          if (error.statusCode === 410 || error.statusCode === 404) {
            console.log(
              `🗑️ [PUSH] Removing invalid subscription ${index + 1} for user: ${data.userId}`
            );

            // Remove invalid subscription from database
            const updatedSubscriptions = pushSubscriptions.filter(
              (_, i) => i !== index
            );
            await db.profile.update({
              where: { userId: data.userId },
              data: { pushSubscriptions: updatedSubscriptions },
            });
          }

          failureCount++;
          return false;
        }
      }
    );

    await Promise.all(sendPromises);

    console.log(
      `📊 [PUSH] Results for user ${data.userId}: ${successCount} success, ${failureCount} failures`
    );
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
      console.log(
        `🔄 [PUSH] Updated existing subscription for user: ${userId}`
      );
    } else {
      // Add new subscription
      updatedSubscriptions = [...existingSubscriptions, subscription];
      console.log(`➕ [PUSH] Added new subscription for user: ${userId}`);
    }

    await db.profile.update({
      where: { userId },
      data: { pushSubscriptions: updatedSubscriptions },
    });

    console.log(`✅ [PUSH] Subscription saved for user: ${userId}`);
    return true;
  } catch (error) {
    console.error('❌ [PUSH] Error saving push subscription:', error);
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

    await db.profile.update({
      where: { userId },
      data: { pushSubscriptions: updatedSubscriptions },
    });

    console.log(`🗑️ [PUSH] Unsubscribed from endpoint for user: ${userId}`);
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
