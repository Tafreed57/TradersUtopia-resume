import { logger, task } from '@trigger.dev/sdk/v3';
import { ServerService } from '@/services/database/server-service';
import { ChannelService } from '@/services/database/channel-service';
import { NotificationService } from '@/services/database/notification-service';
import { UserService } from '@/services/database/user-service';
import { sendPushNotification } from '@/lib/push-notifications';
import type { NotificationType } from '@prisma/client';

// Type definition for the task payload
type MessageNotificationPayload = {
  messageId: string;
  senderId: string;
  senderName: string;
  channelId: string;
  serverId: string;
  content: string;
};

// Type for eligible users with push subscriptions
type EligibleUser = {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  pushSubscriptions: Array<{
    id: string;
    endpoint: string;
    keys: { p256dh: string; auth: string };
    isActive: boolean;
    failureCount: number;
  }>;
};

export const sendMessageNotifications = task({
  id: 'send-message-notifications',
  // AWS Amplify optimized configuration
  maxDuration: 300, // 5 minutes max for notifications
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 10000,
    factor: 2,
    randomize: true,
  },
  machine: 'small-2x',
  run: async (payload: MessageNotificationPayload) => {
    const { messageId, senderId, senderName, channelId, serverId, content } =
      payload;

    logger.info('Starting optimized notification processing', {
      messageId,
      senderId,
      channelId,
      serverId,
    });

    try {
      // Initialize database services
      const serverService = new ServerService();
      const channelService = new ChannelService();
      const notificationService = new NotificationService();
      const userService = new UserService();

      // Get server and channel information in parallel (keep validation)
      const [serverInfo, channelInfo] = await Promise.all([
        serverService.findServerWithMemberAccess(serverId, senderId),
        channelService.findChannelWithAccess(channelId, senderId),
      ]);

      if (!serverInfo) {
        logger.error('Server not found or no access', { serverId, senderId });
        return { success: false, error: 'Server not found or no access' };
      }

      if (!channelInfo) {
        logger.error('Channel not found or no access', { channelId, senderId });
        return { success: false, error: 'Channel not found or no access' };
      }

      // 🚀 OPTIMIZED: Single query to get only users who need notifications
      const eligibleUsers =
        await userService.getUsersEligibleForChannelNotifications(
          serverId,
          channelId,
          senderId
        );

      logger.info('Optimized user targeting', {
        serverName: serverInfo.name,
        channelName: channelInfo.name,
        senderName,
        eligibleUsers: eligibleUsers.length,
        totalPushSubscriptions: eligibleUsers.reduce(
          (acc, user) => acc + user.pushSubscriptions.length,
          0
        ),
      });

      if (eligibleUsers.length === 0) {
        logger.info('No users eligible for notifications');
        return { success: true, notificationsSent: 0 };
      }

      // Prepare notification content
      const truncatedContent =
        content.length > 100 ? content.substring(0, 100) + '...' : content;
      const title = `New message in ${serverInfo.name} #${channelInfo.name}`;
      const message = `${senderName}: ${truncatedContent}`;
      const actionUrl = `/servers/${serverId}?channelId=${channelId}`;

      // 🚀 OPTIMIZED: Send all push notifications in parallel FIRST
      logger.info('Sending push notifications in parallel');
      const pushNotificationPromises = eligibleUsers.flatMap(user =>
        user.pushSubscriptions.map(async subscription => {
          try {
            const success = await sendPushNotification({
              userId: user.id,
              title,
              message,
              type: 'NEW_MESSAGE',
              actionUrl,
              notificationId: undefined, // Will be set later from bulk creation
              isMentioned: false, // Removed mention detection
            });

            return {
              userId: user.id,
              userName: user.name,
              subscriptionId: subscription.id,
              success,
            };
          } catch (error) {
            logger.warn('Push notification failed', {
              userId: user.id,
              subscriptionId: subscription.id,
              error: error instanceof Error ? error.message : String(error),
            });
            return {
              userId: user.id,
              userName: user.name,
              subscriptionId: subscription.id,
              success: false,
            };
          }
        })
      );

      // Wait for all push notifications to complete
      const pushResults = await Promise.allSettled(pushNotificationPromises);
      const pushSuccesses = pushResults
        .filter(result => result.status === 'fulfilled')
        .map(result => (result as PromiseFulfilledResult<any>).value)
        .filter(result => result.success);

      logger.info('Push notification results', {
        totalAttempted: pushResults.length,
        successful: pushSuccesses.length,
        failed: pushResults.length - pushSuccesses.length,
      });

      // 🚀 OPTIMIZED: Bulk create database notifications
      logger.info('Creating bulk database notifications');
      const notificationData = {
        type: 'NEW_MESSAGE' as NotificationType,
        title,
        message,
        actionUrl,
      };

      const userIds = eligibleUsers.map(user => user.id);
      const bulkCreateResult =
        await notificationService.createBulkNotifications(
          userIds,
          notificationData
        );

      logger.info('Notification processing completed', {
        eligibleUsers: eligibleUsers.length,
        pushNotificationsSent: pushSuccesses.length,
        databaseNotificationsCreated: bulkCreateResult,
        messageId,
        channelId,
        serverId,
      });

      return {
        success: true,
        notificationsSent: bulkCreateResult,
        pushNotificationsSent: pushSuccesses.length,
        totalEligible: eligibleUsers.length,
        messageId,
        channelId,
        serverId,
      };
    } catch (error) {
      logger.error('Error processing notifications', {
        error: error instanceof Error ? error.message : String(error),
        messageId,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});
