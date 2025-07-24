import { logger, task } from '@trigger.dev/sdk/v3';
import { prisma } from '@/lib/prismadb';
import { createNotification } from '@/lib/notifications';

// Type definition for the task payload
type MessageNotificationPayload = {
  messageId: string;
  senderId: string;
  senderName: string;
  channelId: string;
  serverId: string;
  content: string;
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
  run: async (payload: MessageNotificationPayload) => {
    const { messageId, senderId, senderName, channelId, serverId, content } =
      payload;

    logger.info('Starting notification processing', {
      messageId,
      senderId,
      channelId,
      serverId,
    });

    try {
      // Get other members for notifications and server info (ACTIVE subscriptions OR admin users)
      // Also include their channel notification preferences
      const [otherMembers, serverInfo, channel] = await Promise.all([
        prisma.member.findMany({
          where: {
            serverId: serverId,
            profileId: { not: senderId },
            profile: {
              OR: [
                { subscriptionStatus: 'ACTIVE' }, // ✅ SUBSCRIPTION CHECK: Users with active subscriptions
                { isAdmin: true }, // ✅ ADMIN CHECK: Admin users (regardless of subscription status)
              ],
            },
          },
          include: {
            profile: {
              select: {
                id: true,
                userId: true,
                name: true,
                email: true,
                subscriptionStatus: true, // Include for logging/debugging
                isAdmin: true, // Include admin status for logging
              },
            },
          },
        }),
        prisma.server.findUnique({
          where: { id: serverId },
          select: { name: true },
        }),
        prisma.channel.findUnique({
          where: { id: channelId },
          select: { name: true },
        }),
      ]);

      if (!serverInfo || !channel) {
        logger.error('Server or channel not found', { serverId, channelId });
        return { success: false, error: 'Server or channel not found' };
      }

      // ✅ CHANNEL NOTIFICATION FILTERING: Get channel notification preferences for all members
      const channelNotificationPrefs =
        await prisma.channelNotificationPreference.findMany({
          where: {
            channelId: channelId,
            profileId: {
              in: otherMembers.map(member => member.profile.id),
            },
          },
        });

      // Create a map for quick lookup of notification preferences
      const notificationPrefsMap = new Map(
        channelNotificationPrefs.map(pref => [pref.profileId, pref.enabled])
      );

      // Filter members based on channel notification preferences
      // If no preference exists, default to enabled (true)
      const membersToNotify = otherMembers.filter(member => {
        const preference = notificationPrefsMap.get(member.profile.id);
        return preference !== false; // Default to true if no preference set
      });

      // ✅ ENHANCED FILTERING: Log notification targeting for eligible users
      logger.info(`Message from ${senderName} in ${serverInfo.name}`);

      // Count different types of eligible users
      const activeSubscriptionUsers = otherMembers.filter(
        m => m.profile.subscriptionStatus === 'ACTIVE'
      );
      const adminUsers = otherMembers.filter(m => m.profile.isAdmin);

      logger.info('Notification targeting stats', {
        totalEligibleMembers: otherMembers.length,
        activeSubscriptionUsers: activeSubscriptionUsers.length,
        adminUsers: adminUsers.length,
        membersWithNotificationsEnabled: membersToNotify.length,
      });

      if (membersToNotify.length === 0) {
        logger.info(
          'No members to notify (either no active subscriptions/admin users or channel notifications disabled)'
        );
        return { success: true, notificationsSent: 0 };
      }

      // Detect mentions in the message content (@username pattern)
      const mentionRegex = /@(\w+)/g;
      const mentions = Array.from(content.matchAll(mentionRegex));
      const mentionedUsernames = mentions.map(match => match[1].toLowerCase());

      const truncatedContent =
        content.length > 100 ? content.substring(0, 100) + '...' : content;

      const serverName = serverInfo.name;

      // Process notifications in batches for better performance on AWS Amplify
      const BATCH_SIZE = 10;
      const notificationBatches = [];

      for (let i = 0; i < membersToNotify.length; i += BATCH_SIZE) {
        const batch = membersToNotify.slice(i, i + BATCH_SIZE);
        notificationBatches.push(batch);
      }

      let totalSuccessCount = 0;
      let totalFailureCount = 0;

      // Process batches sequentially to avoid overwhelming the system
      for (const [batchIndex, batch] of notificationBatches.entries()) {
        logger.info(
          `Processing notification batch ${batchIndex + 1}/${notificationBatches.length}`,
          {
            batchSize: batch.length,
          }
        );

        // Create notifications for each member in the batch
        const notificationPromises = batch.map(async serverMember => {
          const isMentioned = mentionedUsernames.some(
            username =>
              serverMember.profile.name.toLowerCase().includes(username) ||
              serverMember.profile.email.toLowerCase().includes(username)
          );

          const userType = serverMember.profile.isAdmin
            ? 'Admin'
            : serverMember.profile.subscriptionStatus === 'ACTIVE'
              ? 'Active Subscription'
              : 'Unknown';

          logger.info('Creating notification', {
            userId: serverMember.profile.userId,
            userName: serverMember.profile.name,
            userType,
            isMentioned,
          });

          try {
            const notification = await createNotification({
              userId: serverMember.profile.userId,
              type: isMentioned ? 'MENTION' : 'MESSAGE',
              title: isMentioned
                ? `You were mentioned in ${serverName} #${channel.name}`
                : `New message in ${serverName} #${channel.name}`,
              message: `${senderName}: ${truncatedContent}`,
              actionUrl: `/servers/${serverId}/channels/${channelId}`,
            });

            if (notification) {
              logger.info('Successfully created notification', {
                userId: serverMember.profile.userId,
                userName: serverMember.profile.name,
              });
              return { success: true, userId: serverMember.profile.userId };
            } else {
              logger.error('Failed to create notification', {
                userId: serverMember.profile.userId,
                userName: serverMember.profile.name,
              });
              return { success: false, userId: serverMember.profile.userId };
            }
          } catch (error) {
            logger.error('Error creating notification', {
              userId: serverMember.profile.userId,
              userName: serverMember.profile.name,
              error: error instanceof Error ? error.message : String(error),
            });
            return { success: false, userId: serverMember.profile.userId };
          }
        });

        // Wait for the current batch to complete
        const batchResults = await Promise.all(notificationPromises);
        const batchSuccessCount = batchResults.filter(r => r.success).length;
        const batchFailureCount = batchResults.filter(r => !r.success).length;

        totalSuccessCount += batchSuccessCount;
        totalFailureCount += batchFailureCount;

        logger.info(`Batch ${batchIndex + 1} completed`, {
          successful: batchSuccessCount,
          failed: batchFailureCount,
        });

        // Small delay between batches to prevent rate limiting
        if (batchIndex < notificationBatches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      logger.info('Notification processing completed', {
        total: membersToNotify.length,
        successful: totalSuccessCount,
        failed: totalFailureCount,
      });

      return {
        success: true,
        notificationsSent: totalSuccessCount,
        totalEligible: membersToNotify.length,
        batchesProcessed: notificationBatches.length,
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
