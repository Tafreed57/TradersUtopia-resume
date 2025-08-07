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
  notificationId?: string;
  isMentioned?: boolean;
}

interface PushSubscription {
  id: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  isActive: boolean;
  failureCount: number;
  lastActive: Date;
}

// Enhanced notification type definitions
type NotificationPriority = 'low' | 'normal' | 'high';
type NotificationCategory =
  | 'message'
  | 'social'
  | 'reminder'
  | 'system'
  | 'payment';

interface NotificationOptions {
  priority?: NotificationPriority;
  category?: NotificationCategory;
  silent?: boolean;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  image?: string;
  badge?: string;
  icon?: string;
  vibrate?: number[];
}

const getNotificationIcon = (type: string): string => {
  const iconMap: Record<string, string> = {
    SYSTEM: '⚙️',
    SECURITY: '🔒',
    PAYMENT: '💳',
    MESSAGE: '💬',
    NEW_MESSAGE: '💬',
    MENTION: '👤',
    SERVER_UPDATE: '📢',
    ADMIN_ANNOUNCEMENT: '📢',
    TRIAL_ENDING: '⏰',
    SUBSCRIPTION_CANCELLED: '❌',
    SUBSCRIPTION_RENEWED: '✅',
  };
  return iconMap[type] || '📔';
};

const getNotificationPriority = (
  type: string,
  isMentioned?: boolean
): NotificationPriority => {
  if (isMentioned) return 'high';

  const highPriorityTypes = ['SECURITY', 'PAYMENT_FAILED', 'TRIAL_ENDING'];
  const lowPriorityTypes = ['SYSTEM', 'ADMIN_ANNOUNCEMENT'];

  if (highPriorityTypes.includes(type)) return 'high';
  if (lowPriorityTypes.includes(type)) return 'low';

  return 'normal';
};

const buildNotificationPayload = (
  data: PushNotificationData,
  options?: NotificationOptions
): string => {
  const priority = getNotificationPriority(data.type, data.isMentioned);

  return JSON.stringify({
    title: data.title,
    body: data.message,
    icon: options?.icon || getNotificationIcon(data.type),
    badge: options?.badge || '/logo.png',
    image: options?.image,
    data: {
      url: data.actionUrl || '/',
      notificationId: data.notificationId,
      type: data.type,
      timestamp: Date.now(),
      priority,
    },
    actions:
      options?.actions ||
      (data.actionUrl
        ? [
            {
              action: 'open',
              title: 'View',
              icon: '/logo.png',
            },
          ]
        : []),
    requireInteraction: data.type === 'NEW_MESSAGE' && data.isMentioned,
    silent: options?.silent || false,
    tag: `${data.type}-${Date.now()}`,
    renotify: true,
    vibrate: options?.vibrate || (data.isMentioned ? [200, 100, 200] : [100]),
  });
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

    // Filter to only active subscriptions with low failure counts
    const validSubscriptions = user.pushSubscriptions.filter(
      sub => sub.isActive && sub.failureCount < 5
    );

    if (validSubscriptions.length === 0) {
      return false;
    }

    // Prepare notification payload using enhanced builder
    const payload = buildNotificationPayload(data);

    // Send to all valid subscriptions
    const results = await Promise.allSettled(
      validSubscriptions.map(async subscription => {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: subscription.keys,
            },
            payload,
            {
              TTL: 24 * 60 * 60,
              urgency: data.isMentioned ? 'high' : 'normal',
            }
          );

          // Update last active
          await userService.updatePushSubscriptionActivity(subscription.id);

          return { success: true, subscriptionId: subscription.id };
        } catch (error: any) {
          // Handle invalid subscriptions
          if (error.statusCode === 410 || error.statusCode === 404) {
            await userService.deactivatePushSubscription(subscription.id);
          } else {
            await userService.incrementPushFailureCount(subscription.id);
          }

          return { success: false, subscriptionId: subscription.id, error };
        }
      })
    );

    const successCount = results.filter(
      r => r.status === 'fulfilled' && r.value.success
    ).length;

    return successCount > 0;
  } catch (error) {
    console.error('❌ [PUSH] Error sending push notification:', error);
    return false;
  }
}

export async function subscribeToPushNotifications(
  userId: string,
  subscription: {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  },
  deviceInfo?: {
    browser?: string;
    os?: string;
    deviceType?: string;
    userAgent?: string;
  }
): Promise<boolean> {
  try {
    // Initialize UserService
    const userService = new UserService();

    // Use the service to upsert the push subscription with device info
    const success = await userService.upsertPushSubscription(
      userId,
      subscription,
      deviceInfo
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

/**
 * Get push subscription statistics for a user
 */
export async function getPushSubscriptionStats(userId: string): Promise<{
  total: number;
  active: number;
  inactive: number;
  highFailureCount: number;
  recentlyActive: number;
} | null> {
  try {
    const userService = new UserService();
    const user = await userService.getUserWithPushSubscriptions(userId);

    if (!user || !user.pushSubscriptions) {
      return null;
    }

    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const stats = {
      total: user.pushSubscriptions.length,
      active: user.pushSubscriptions.filter(sub => sub.isActive).length,
      inactive: user.pushSubscriptions.filter(sub => !sub.isActive).length,
      highFailureCount: user.pushSubscriptions.filter(
        sub => sub.failureCount >= 3
      ).length,
      recentlyActive: user.pushSubscriptions.filter(
        sub => sub.lastActive > dayAgo
      ).length,
    };

    return stats;
  } catch (error) {
    console.error('❌ [PUSH] Error getting push subscription stats:', error);
    return null;
  }
}
