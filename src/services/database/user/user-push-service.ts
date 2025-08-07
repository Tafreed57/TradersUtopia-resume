import { BaseDatabaseService } from '../base-service';
import { maskId } from '@/lib/error-handling';

/**
 * UserPushService - Handles push notification subscriptions for users
 *
 * Contains only push notification-related methods that are actively used in the codebase.
 * Manages push subscription lifecycle and failure handling.
 */
export class UserPushService extends BaseDatabaseService {
  /**
   * Get user with push subscriptions
   * Used for push notification targeting - now filters by active subscriptions
   */
  async getUserWithPushSubscriptions(userId: string): Promise<{
    id: string;
    pushSubscriptions: Array<{
      id: string;
      endpoint: string;
      keys: {
        p256dh: string;
        auth: string;
      };
      isActive: boolean;
      failureCount: number;
      lastActive: Date;
    }>;
  } | null> {
    this.validateRequired(userId, 'userId');

    try {
      const user = await this.prisma.user.findFirst({
        where: { id: userId },
        select: {
          id: true,
          pushSubscriptions: {
            where: {
              isActive: true,
              failureCount: { lt: 5 }, // Skip subscriptions with too many failures
            },
            select: {
              id: true,
              endpoint: true,
              keys: true,
              isActive: true,
              failureCount: true,
              lastActive: true,
            },
          },
        },
      });

      if (!user) {
        return null;
      }

      // Transform the data to match expected format
      return {
        id: user.id,
        pushSubscriptions: user.pushSubscriptions.map((sub: any) => ({
          id: sub.id,
          endpoint: sub.endpoint,
          keys: sub.keys as { p256dh: string; auth: string },
          isActive: sub.isActive,
          failureCount: sub.failureCount,
          lastActive: sub.lastActive,
        })),
      };
    } catch (error) {
      return await this.handleError(error, 'get_user_with_push_subscriptions', {
        userId: maskId(userId),
      });
    }
  }

  /**
   * Add or update push subscription for a user
   * Enhanced with device tracking and activity updates
   */
  async upsertPushSubscription(
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
    this.validateRequired(userId, 'userId');
    this.validateRequired(subscription.endpoint, 'subscription.endpoint');

    try {
      // First, ensure the user exists
      const user = await this.prisma.user.findFirst({
        where: { id: userId },
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Use upsert to create or update the push subscription
      await this.prisma.pushSubscription.upsert({
        where: {
          endpoint: subscription.endpoint,
        },
        update: {
          keys: subscription.keys,
          deviceInfo: deviceInfo || undefined,
          lastActive: new Date(),
          isActive: true, // Reactivate if previously disabled
          failureCount: 0, // Reset failure count on update
        },
        create: {
          userId: user.id, // Use the internal ID
          endpoint: subscription.endpoint,
          keys: subscription.keys,
          deviceInfo: deviceInfo || undefined,
          lastActive: new Date(),
          isActive: true,
          failureCount: 0,
        },
      });

      this.logSuccess('push_subscription_upsert', {
        userId: maskId(userId),
        endpoint: subscription.endpoint.substring(0, 50) + '...',
        hasDeviceInfo: !!deviceInfo,
      });

      return true;
    } catch (error) {
      return await this.handleError(error, 'upsert_push_subscription', {
        userId: maskId(userId),
        endpoint: subscription.endpoint.substring(0, 50) + '...',
      });
    }
  }

  /**
   * Update push subscription activity timestamp
   * Called when a push notification is successfully delivered
   */
  async updatePushSubscriptionActivity(subscriptionId: string): Promise<void> {
    this.validateRequired(subscriptionId, 'subscriptionId');

    try {
      await this.prisma.pushSubscription.update({
        where: { id: subscriptionId },
        data: {
          lastActive: new Date(),
          failureCount: 0, // Reset failure count on successful delivery
        },
      });

      this.logSuccess('push_subscription_activity_updated', {
        subscriptionId: maskId(subscriptionId),
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.handleError(error, 'update_push_subscription_activity', {
        subscriptionId: maskId(subscriptionId),
      });
    }
  }

  /**
   * Increment push notification failure count
   * Called when a push notification fails to deliver
   */
  async incrementPushFailureCount(subscriptionId: string): Promise<void> {
    this.validateRequired(subscriptionId, 'subscriptionId');

    try {
      const subscription = await this.prisma.pushSubscription.findUnique({
        where: { id: subscriptionId },
      });

      if (!subscription) {
        this.logSuccess('push_subscription_not_found_for_failure', {
          subscriptionId: maskId(subscriptionId),
        });
        return;
      }

      const newFailureCount = subscription.failureCount + 1;

      await this.prisma.pushSubscription.update({
        where: { id: subscriptionId },
        data: {
          failureCount: newFailureCount,
          // Deactivate if too many failures
          ...(newFailureCount >= 5 && { isActive: false }),
        },
      });

      this.logSuccess('push_subscription_failure_incremented', {
        subscriptionId: maskId(subscriptionId),
        failureCount: newFailureCount,
        deactivated: newFailureCount >= 5,
      });
    } catch (error) {
      this.handleError(error, 'increment_push_failure_count', {
        subscriptionId: maskId(subscriptionId),
      });
    }
  }

  /**
   * Get users eligible for channel notifications
   * Returns users with active push subscriptions for a specific channel
   */
  async getUsersEligibleForChannelNotifications(
    serverId: string,
    channelId: string,
    excludeUserId?: string
  ): Promise<
    Array<{
      id: string;
      name: string;
      pushSubscriptions: Array<{
        id: string;
        endpoint: string;
        keys: { p256dh: string; auth: string };
        isActive: boolean;
        failureCount: number;
        lastActive: Date;
      }>;
    }>
  > {
    this.validateRequired(serverId, 'serverId');
    this.validateRequired(channelId, 'channelId');

    try {
      const users = await this.prisma.user.findMany({
        where: {
          ...(excludeUserId && { id: { not: excludeUserId } }),
          members: {
            some: {
              serverId,
            },
          },
          pushSubscriptions: {
            some: {
              isActive: true,
              failureCount: { lt: 5 },
            },
          },
        },
        select: {
          id: true,
          name: true,
          pushSubscriptions: {
            where: {
              isActive: true,
              failureCount: { lt: 5 },
            },
            select: {
              id: true,
              endpoint: true,
              keys: true,
              isActive: true,
              failureCount: true,
              lastActive: true,
            },
          },
        },
      });

      this.logSuccess('eligible_users_for_channel_notifications', {
        serverId: maskId(serverId),
        channelId: maskId(channelId),
        excludeUserId: excludeUserId ? maskId(excludeUserId) : undefined,
        userCount: users.length,
        totalSubscriptions: users.reduce(
          (acc, user) => acc + user.pushSubscriptions.length,
          0
        ),
      });

      return users.map(user => ({
        id: user.id,
        name: user.name,
        pushSubscriptions: user.pushSubscriptions.map(sub => ({
          id: sub.id,
          endpoint: sub.endpoint,
          keys: sub.keys as { p256dh: string; auth: string },
          isActive: sub.isActive,
          failureCount: sub.failureCount,
          lastActive: sub.lastActive,
        })),
      }));
    } catch (error) {
      return this.handleError(
        error,
        'get_users_eligible_for_channel_notifications',
        {
          serverId: maskId(serverId),
          channelId: maskId(channelId),
          excludeUserId: excludeUserId ? maskId(excludeUserId) : undefined,
        }
      );
    }
  }

  /**
   * Deactivate push subscription
   * Called when subscription is no longer valid or too many failures
   */
  async deactivatePushSubscription(subscriptionId: string): Promise<void> {
    this.validateRequired(subscriptionId, 'subscriptionId');

    try {
      await this.prisma.pushSubscription.update({
        where: { id: subscriptionId },
        data: {
          isActive: false,
        },
      });

      this.logSuccess('push_subscription_deactivated', {
        subscriptionId: maskId(subscriptionId),
        deactivatedAt: new Date().toISOString(),
      });
    } catch (error) {
      this.handleError(error, 'deactivate_push_subscription', {
        subscriptionId: maskId(subscriptionId),
      });
    }
  }
}
