import { logger, task } from '@trigger.dev/sdk/v3';
import { MemberService } from '@/services/database/member-service';
import { ServerService } from '@/services/database/server-service';
import { ChannelService } from '@/services/database/channel-service';
import { NotificationService } from '@/services/database/notification-service';
import type { Member, User, Server, Channel } from '@/services/types';
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

// Extended user type that includes subscription information
type UserWithSubscription = User & {
  subscription?: {
    id: string;
    status: string;
  } | null;
};

// Type for members with user details that have active subscriptions or admin access
type EligibleMember = Member & {
  user: UserWithSubscription;
};

// Type for channel notification preference
type ChannelNotificationPreference = {
  id: string;
  userId: string;
  channelId: string;
  enabled: boolean;
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
      // Initialize database services
      const memberService = new MemberService();
      const serverService = new ServerService();
      const channelService = new ChannelService();
      const notificationService = new NotificationService();

      // Get server and channel information in parallel
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

      // Get all server members (excluding the sender) - need to get with subscription info
      // Since MemberService doesn't include subscription by default, we'll need to get members manually with subscription
      const allServerMembersRaw = await memberService.prisma.member.findMany({
        where: {
          serverId,
          userId: { not: senderId },
        },
        include: {
          user: {
            include: {
              subscription: true,
            },
          },
        },
      });

      // Filter members to only include those with active subscriptions OR admin users
      const eligibleMembers = allServerMembersRaw.filter(member => {
        const hasActiveSubscription =
          member.user.subscription?.status === 'ACTIVE';
        const isAdmin = member.user.isAdmin === true;
        return hasActiveSubscription || isAdmin;
      }) as EligibleMember[];

      logger.info(`Message from ${senderName} in ${serverInfo.name}`);

      // Count different types of eligible users
      const activeSubscriptionUsers = eligibleMembers.filter(
        (m: EligibleMember) => m.user.subscription?.status === 'ACTIVE'
      );
      const adminUsers = eligibleMembers.filter(
        (m: EligibleMember) => m.user.isAdmin
      );

      logger.info('Notification targeting stats', {
        totalEligibleMembers: eligibleMembers.length,
        activeSubscriptionUsers: activeSubscriptionUsers.length,
        adminUsers: adminUsers.length,
      });

      if (eligibleMembers.length === 0) {
        logger.info(
          'No members to notify (no active subscriptions/admin users found)'
        );
        return { success: true, notificationsSent: 0 };
      }

      // ✅ CHANNEL NOTIFICATION FILTERING: Get channel notification preferences
      // We need to get preferences for all eligible members
      const channelNotificationPreferences = await Promise.all(
        eligibleMembers.map(async (member: EligibleMember) => {
          try {
            const preference =
              await notificationService.getChannelNotificationPreference(
                member.userId,
                channelId
              );
            return {
              userId: member.userId,
              enabled: preference.enabled,
            };
          } catch (error) {
            // If we can't get preference, default to enabled
            logger.warn(
              'Failed to get channel notification preference, defaulting to enabled',
              {
                userId: member.userId,
                error: error instanceof Error ? error.message : String(error),
              }
            );
            return {
              userId: member.userId,
              enabled: true,
            };
          }
        })
      );

      // Create a map for quick lookup of notification preferences
      const notificationPrefsMap = new Map(
        channelNotificationPreferences.map(
          (pref: { userId: string; enabled: boolean }) => [
            pref.userId,
            pref.enabled,
          ]
        )
      );

      // Filter members based on channel notification preferences
      // If no preference exists, default to enabled (true)
      const membersToNotify = eligibleMembers.filter(
        (member: EligibleMember) => {
          const preference = notificationPrefsMap.get(member.userId);
          return preference !== false; // Default to true if no preference set
        }
      );

      logger.info('Channel notification filtering', {
        membersWithNotificationsEnabled: membersToNotify.length,
      });

      if (membersToNotify.length === 0) {
        logger.info(
          'No members to notify (channel notifications disabled for all eligible users)'
        );
        return { success: true, notificationsSent: 0 };
      }

      // Detect mentions in the message content (@username pattern)
      const mentionRegex = /@(\w+)/g;
      const mentions = Array.from(content.matchAll(mentionRegex));
      const mentionedUsernames = mentions.map((match: RegExpMatchArray) =>
        match[1].toLowerCase()
      );

      const truncatedContent =
        content.length > 100 ? content.substring(0, 100) + '...' : content;

      const serverName = serverInfo.name;
      const channelName = channelInfo.name;

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
        const notificationPromises = batch.map(
          async (serverMember: EligibleMember) => {
            const isMentioned = mentionedUsernames.some(
              (username: string) =>
                serverMember.user.name.toLowerCase().includes(username) ||
                serverMember.user.email.toLowerCase().includes(username)
            );

            const userType = serverMember.user.isAdmin
              ? 'Admin'
              : serverMember.user.subscription?.status === 'ACTIVE'
                ? 'Active Subscription'
                : 'Unknown';

            logger.info('Creating notification', {
              userId: serverMember.userId,
              userName: serverMember.user.name,
              userType,
              isMentioned,
            });

            try {
              const notification = await notificationService.createNotification(
                {
                  userId: serverMember.userId,
                  type: 'NEW_MESSAGE' as NotificationType,
                  title: isMentioned
                    ? `You were mentioned in ${serverName} #${channelName}`
                    : `New message in ${serverName} #${channelName}`,
                  message: `${senderName}: ${truncatedContent}`,
                  actionUrl: `/servers/${serverId}/channels/${channelId}`,
                }
              );

              if (notification) {
                logger.info('Successfully created notification', {
                  userId: serverMember.userId,
                  userName: serverMember.user.name,
                  notificationId: notification.id,
                });
                return { success: true, userId: serverMember.userId };
              } else {
                logger.error('Failed to create notification', {
                  userId: serverMember.userId,
                  userName: serverMember.user.name,
                });
                return { success: false, userId: serverMember.userId };
              }
            } catch (error) {
              logger.error('Error creating notification', {
                userId: serverMember.userId,
                userName: serverMember.user.name,
                error: error instanceof Error ? error.message : String(error),
              });
              return { success: false, userId: serverMember.userId };
            }
          }
        );

        // Wait for the current batch to complete
        const batchResults = await Promise.all(notificationPromises);
        const batchSuccessCount = batchResults.filter(
          (r: { success: boolean }) => r.success
        ).length;
        const batchFailureCount = batchResults.filter(
          (r: { success: boolean }) => !r.success
        ).length;

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
