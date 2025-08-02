import { BaseDatabaseService } from './base-service';
import { Notification } from '../types';
import { apiLogger } from '@/lib/enhanced-logger';
import { NotFoundError, ValidationError, maskId } from '@/lib/error-handling';
import { NotificationType } from '@prisma/client';

/**
 * NotificationService
 *
 * Consolidates notification operations including fetching, creating, updating,
 * and managing user notification preferences.
 */
export class NotificationService extends BaseDatabaseService {
  /**
   * Get unread notifications for a user
   */
  async getUnreadNotifications(userId: string): Promise<Notification[]> {
    try {
      this.validateId(userId, 'userId');

      const notifications = await this.prisma.notification.findMany({
        where: {
          userId,
          read: false,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 50, // Limit to prevent large payloads
      });

      this.logSuccess('notifications_fetched', {
        userId: maskId(userId),
        notificationCount: notifications.length,
      });

      return notifications as Notification[];
    } catch (error) {
      return await this.handleError(error, 'get_unread_notifications', {
        userId: maskId(userId),
      });
    }
  }

  /**
   * Get all notifications for a user with pagination
   */
  async getNotifications(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      includeRead?: boolean;
    } = {}
  ): Promise<{
    notifications: Notification[];
    total: number;
    unreadCount: number;
    hasMore: boolean;
  }> {
    try {
      this.validateId(userId, 'userId');

      const { limit = 20, offset = 0, includeRead = true } = options;
      const whereClause: any = { userId };

      if (!includeRead) {
        whereClause.read = false;
      }

      // Get notifications with pagination
      const [notifications, total, unreadCount] = await Promise.all([
        this.prisma.notification.findMany({
          where: whereClause,
          orderBy: { createdAt: 'desc' },
          take: Math.min(limit, 50),
          skip: offset,
        }),
        this.prisma.notification.count({
          where: whereClause,
        }),
        this.prisma.notification.count({
          where: {
            userId,
            read: false,
          },
        }),
      ]);

      const hasMore = offset + notifications.length < total;

      this.logSuccess('notifications_paginated_fetch', {
        userId: maskId(userId),
        limit,
        offset,
        total,
        unreadCount,
        hasMore,
      });

      return {
        notifications: notifications as Notification[],
        total,
        unreadCount,
        hasMore,
      };
    } catch (error) {
      return await this.handleError(error, 'get_notifications_paginated', {
        userId: maskId(userId),
      });
    }
  }

  /**
   * Create a new notification
   */
  async createNotification(data: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    actionUrl?: string;
    metadata?: Record<string, any>;
  }): Promise<Notification> {
    try {
      this.validateId(data.userId, 'userId');
      this.validateRequired(data.type, 'notification type');
      this.validateRequired(data.title, 'notification title');
      this.validateRequired(data.message, 'notification message');

      // Validate message length
      if (data.title.length > 200) {
        throw new ValidationError(
          'Notification title too long (max 200 characters)'
        );
      }
      if (data.message.length > 1000) {
        throw new ValidationError(
          'Notification message too long (max 1000 characters)'
        );
      }

      const notification = await this.prisma.notification.create({
        data: {
          userId: data.userId,
          type: data.type,
          title: data.title,
          message: data.message,
          actionUrl: data.actionUrl,
          metadata: data.metadata || {},
          read: false,
        },
      });

      this.logSuccess('notification_created', {
        notificationId: maskId(notification.id),
        userId: maskId(data.userId),
        type: data.type,
        hasActionUrl: !!data.actionUrl,
      });

      return notification as Notification;
    } catch (error) {
      return await this.handleError(error, 'create_notification', {
        userId: maskId(data.userId),
        type: data.type,
      });
    }
  }

  /**
   * Mark a notification as read
   */
  async markNotificationAsRead(
    notificationId: string,
    userId?: string
  ): Promise<boolean> {
    try {
      this.validateId(notificationId, 'notificationId');

      const whereClause: any = { id: notificationId };
      if (userId) {
        whereClause.userId = userId; // Ensure user can only mark their own notifications
      }

      const notification = await this.prisma.notification.findFirst({
        where: whereClause,
      });

      if (!notification) {
        throw new NotFoundError('Notification not found');
      }

      await this.prisma.notification.update({
        where: { id: notificationId },
        data: {
          read: true,
        },
      });

      this.logSuccess('notification_marked_read', {
        notificationId: maskId(notificationId),
        userId: maskId(notification.userId),
      });

      return true;
    } catch (error) {
      await this.handleError(error, 'mark_notification_read', {
        notificationId: maskId(notificationId),
        userId: userId ? maskId(userId) : undefined,
      });
      return false;
    }
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllNotificationsAsRead(userId: string): Promise<boolean> {
    try {
      this.validateId(userId, 'userId');

      const result = await this.prisma.notification.updateMany({
        where: {
          userId,
          read: false,
        },
        data: {
          read: true,
        },
      });

      this.logSuccess('all_notifications_marked_read', {
        userId: maskId(userId),
        updatedCount: result.count,
      });

      return true;
    } catch (error) {
      await this.handleError(error, 'mark_all_notifications_read', {
        userId: maskId(userId),
      });
      return false;
    }
  }

  /**
   * Delete a notification
   */
  async deleteNotification(
    notificationId: string,
    userId?: string
  ): Promise<boolean> {
    try {
      this.validateId(notificationId, 'notificationId');

      const whereClause: any = { id: notificationId };
      if (userId) {
        whereClause.userId = userId; // Ensure user can only delete their own notifications
      }

      const notification = await this.prisma.notification.findFirst({
        where: whereClause,
      });

      if (!notification) {
        throw new NotFoundError('Notification not found');
      }

      await this.prisma.notification.delete({
        where: { id: notificationId },
      });

      this.logSuccess('notification_deleted', {
        notificationId: maskId(notificationId),
        userId: maskId(notification.userId),
      });

      return true;
    } catch (error) {
      await this.handleError(error, 'delete_notification', {
        notificationId: maskId(notificationId),
        userId: userId ? maskId(userId) : undefined,
      });
      return false;
    }
  }

  /**
   * Delete all read notifications for a user (cleanup)
   */
  async deleteReadNotifications(userId: string): Promise<number> {
    try {
      this.validateId(userId, 'userId');

      const result = await this.prisma.notification.deleteMany({
        where: {
          userId,
          read: true,
        },
      });

      this.logSuccess('read_notifications_deleted', {
        userId: maskId(userId),
        deletedCount: result.count,
      });

      return result.count;
    } catch (error) {
      await this.handleError(error, 'delete_read_notifications', {
        userId: maskId(userId),
      });
      return 0;
    }
  }

  /**
   * Get notification statistics for a user
   */
  async getNotificationStats(userId: string): Promise<{
    total: number;
    unread: number;
    byType: Record<string, number>;
    recentCount: number;
  }> {
    try {
      this.validateId(userId, 'userId');

      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const [total, unread, byType, recent] = await Promise.all([
        this.prisma.notification.count({
          where: { userId },
        }),
        this.prisma.notification.count({
          where: { userId, read: false },
        }),
        this.prisma.notification.groupBy({
          by: ['type'],
          where: { userId },
          _count: { type: true },
        }),
        this.prisma.notification.count({
          where: {
            userId,
            createdAt: { gte: oneDayAgo },
          },
        }),
      ]);

      const typeStats: Record<string, number> = {};
      byType.forEach(item => {
        typeStats[item.type] = item._count.type;
      });

      this.logSuccess('notification_stats_fetched', {
        userId: maskId(userId),
        total,
        unread,
        typeCount: Object.keys(typeStats).length,
      });

      return {
        total,
        unread,
        byType: typeStats,
        recentCount: recent,
      };
    } catch (error) {
      return await this.handleError(error, 'get_notification_stats', {
        userId: maskId(userId),
      });
    }
  }

  /**
   * Bulk operations for notifications
   */
  async bulkMarkAsRead(
    notificationIds: string[],
    userId: string
  ): Promise<number> {
    try {
      this.validateId(userId, 'userId');

      if (notificationIds.length === 0) {
        return 0;
      }

      const result = await this.prisma.notification.updateMany({
        where: {
          id: { in: notificationIds },
          userId, // Security: ensure user owns these notifications
        },
        data: {
          read: true,
        },
      });

      this.logSuccess('bulk_notifications_marked_read', {
        userId: maskId(userId),
        requestedCount: notificationIds.length,
        updatedCount: result.count,
      });

      return result.count;
    } catch (error) {
      await this.handleError(error, 'bulk_mark_notifications_read', {
        userId: maskId(userId),
        requestedCount: notificationIds.length,
      });
      return 0;
    }
  }

  /**
   * Create bulk notifications (for system-wide announcements)
   */
  async createBulkNotifications(
    userIds: string[],
    notificationData: {
      type:
        | 'NEW_MESSAGE'
        | 'ADMIN_ANNOUNCEMENT'
        | 'SUBSCRIPTION_CANCELLED'
        | 'SUBSCRIPTION_RENEWED'
        | 'SUBSCRIPTION_PAST_DUE'
        | 'DISCOUNT_APPLIED'
        | 'PAYMENT_FAILED'
        | 'TRIAL_ENDING'
        | 'SYSTEM';
      title: string;
      message: string;
      actionUrl?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<number> {
    try {
      this.validateRequired(notificationData.type, 'notification type');
      this.validateRequired(notificationData.title, 'notification title');
      this.validateRequired(notificationData.message, 'notification message');

      if (userIds.length === 0) {
        return 0;
      }

      const notifications = userIds.map(userId => ({
        userId,
        type: notificationData.type,
        title: notificationData.title,
        message: notificationData.message,
        actionUrl: notificationData.actionUrl,
        metadata: notificationData.metadata || {},
        read: false,
      }));

      const result = await this.prisma.notification.createMany({
        data: notifications,
        skipDuplicates: false,
      });

      this.logSuccess('bulk_notifications_created', {
        userCount: userIds.length,
        createdCount: result.count,
        type: notificationData.type,
      });

      return result.count;
    } catch (error) {
      await this.handleError(error, 'create_bulk_notifications', {
        userCount: userIds.length,
        type: notificationData.type,
      });
      return 0;
    }
  }

  /**
   * Get channel notification preference
   * Returns existing preference or creates default if none exists
   */
  async getChannelNotificationPreference(
    userId: string,
    channelId: string
  ): Promise<{ enabled: boolean; channelId: string }> {
    try {
      this.validateId(userId, 'userId');
      this.validateId(channelId, 'channelId');

      // Verify user has access to the channel
      const channel = await this.prisma.channel.findUnique({
        where: { id: channelId },
        include: {
          server: {
            include: {
              members: {
                where: { userId },
              },
            },
          },
        },
      });

      if (!channel || !channel.server.members.length) {
        throw new NotFoundError('Channel not found or no access');
      }

      // Get or create notification preference
      let preference =
        await this.prisma.channelNotificationPreference.findUnique({
          where: {
            userId_channelId: {
              userId: userId,
              channelId: channelId,
            },
          },
        });

      apiLogger.databaseOperation(
        'channel_notification_preference_retrieved',
        true,
        {
          userId: maskId(userId),
          channelId: maskId(channelId),
          enabled: preference?.enabled || false,
        }
      );

      return {
        enabled: preference?.enabled || false,
        channelId: channelId,
      };
    } catch (error) {
      throw this.handleError(
        error,
        'Failed to get channel notification preference',
        {
          userId: maskId(userId),
          channelId: maskId(channelId),
        }
      );
    }
  }

  /**
   * Update channel notification preference
   * Creates or updates the preference setting
   */
  async updateChannelNotificationPreference(
    userId: string,
    channelId: string,
    enabled: boolean
  ): Promise<{ enabled: boolean; channelId: string; message: string }> {
    try {
      this.validateId(userId, 'userId');
      this.validateId(channelId, 'channelId');

      // Verify user has access to the channel
      const channel = await this.prisma.channel.findUnique({
        where: { id: channelId },
        include: {
          server: {
            include: {
              members: {
                where: { userId },
              },
            },
          },
        },
      });

      if (!channel || !channel.server.members.length) {
        throw new NotFoundError('Channel not found or no access');
      }

      // Update or create notification preference
      const preference = await this.prisma.channelNotificationPreference.upsert(
        {
          where: {
            userId_channelId: {
              userId: userId,
              channelId: channelId,
            },
          },
          update: {
            enabled: enabled,
          },
          create: {
            userId: userId,
            channelId: channelId,
            enabled: enabled,
          },
        }
      );

      apiLogger.databaseOperation(
        'channel_notification_preference_updated',
        true,
        {
          userId: maskId(userId),
          channelId: maskId(channelId),
          enabled: preference.enabled,
          action: enabled ? 'enabled' : 'disabled',
        }
      );

      return {
        enabled: preference.enabled,
        channelId: channelId,
        message: `Notifications ${enabled ? 'enabled' : 'disabled'} for ${
          channel.name
        }`,
      };
    } catch (error) {
      throw this.handleError(
        error,
        'Failed to update channel notification preference',
        {
          userId: maskId(userId),
          channelId: maskId(channelId),
          enabled,
        }
      );
    }
  }
}
