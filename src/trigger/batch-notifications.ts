import { logger, task } from '@trigger.dev/sdk/v3';
import { NotificationService } from '@/services/database/notification-service';
import { UserService } from '@/services/database/user-service';
import { sendPushNotification } from '@/lib/push-notifications';
import type { NotificationType } from '@prisma/client';

// Type definition for batch notification payload
type BatchNotificationPayload = {
  userIds: string[];
  notification: {
    type: NotificationType;
    title: string;
    message: string;
    actionUrl?: string;
  };
  metadata?: Record<string, any>;
};

// Type for notification result tracking
type NotificationResult = {
  userId: string;
  success: boolean;
  notificationId?: string;
  pushNotificationSent?: boolean;
  error?: string;
};

export const processBatchNotifications = task({
  id: 'process-batch-notifications',
  // AWS Amplify optimized configuration
  maxDuration: 600, // 10 minutes max for batch processing
  queue: {
    name: 'batch-notifications',
    concurrencyLimit: 5, // Process 5 batches at a time
  },
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 10000,
    factor: 2,
    randomize: true,
  },
  run: async (payload: BatchNotificationPayload) => {
    const { userIds, notification, metadata } = payload;

    logger.info('Starting batch notification processing', {
      totalUsers: userIds.length,
      notificationType: notification.type,
      title: notification.title.substring(0, 50) + '...',
    });

    try {
      // Initialize services
      const notificationService = new NotificationService();
      const userService = new UserService();

      if (userIds.length === 0) {
        logger.warn('No users provided for batch notification');
        return {
          success: true,
          totalUsers: 0,
          notificationsCreated: 0,
          pushNotificationsSent: 0,
          errors: [],
        };
      }

      // Validate users exist (in batches to avoid memory issues)
      const VALIDATION_BATCH_SIZE = 50;
      const validatedUserIds: string[] = [];

      for (let i = 0; i < userIds.length; i += VALIDATION_BATCH_SIZE) {
        const batch = userIds.slice(i, i + VALIDATION_BATCH_SIZE);

        // Quick validation - check if users exist
        const existingUsers = await userService.prisma.user.findMany({
          where: { id: { in: batch } },
          select: { id: true },
        });

        validatedUserIds.push(...existingUsers.map(u => u.id));
      }

      logger.info('User validation completed', {
        requestedUsers: userIds.length,
        validUsers: validatedUserIds.length,
        invalidUsers: userIds.length - validatedUserIds.length,
      });

      if (validatedUserIds.length === 0) {
        logger.warn('No valid users found for batch notification');
        return {
          success: true,
          totalUsers: userIds.length,
          notificationsCreated: 0,
          pushNotificationsSent: 0,
          errors: ['No valid users found'],
        };
      }

      // Process notifications in batches for better performance
      const PROCESSING_BATCH_SIZE = 20;
      const processingBatches: string[][] = [];

      for (let i = 0; i < validatedUserIds.length; i += PROCESSING_BATCH_SIZE) {
        const batch = validatedUserIds.slice(i, i + PROCESSING_BATCH_SIZE);
        processingBatches.push(batch);
      }

      let totalSuccessCount = 0;
      let totalFailureCount = 0;
      let totalPushNotificationSuccesses = 0;
      const allErrors: string[] = [];

      // Process batches sequentially to avoid overwhelming the system
      for (const [batchIndex, batch] of processingBatches.entries()) {
        logger.info(
          `Processing batch ${batchIndex + 1}/${processingBatches.length}`,
          {
            batchSize: batch.length,
          }
        );

        // Create notifications for each user in the batch
        const notificationPromises = batch.map(
          async (userId: string): Promise<NotificationResult> => {
            try {
              // Create database notification
              const dbNotification =
                await notificationService.createNotification({
                  userId,
                  type: notification.type,
                  title: notification.title,
                  message: notification.message,
                  actionUrl: notification.actionUrl,
                  metadata,
                });

              if (dbNotification) {
                logger.info('Database notification created', {
                  userId,
                  notificationId: dbNotification.id,
                  type: notification.type,
                });

                // Send push notification
                try {
                  const pushSuccess = await sendPushNotification({
                    userId,
                    title: notification.title,
                    message: notification.message,
                    type: notification.type,
                    actionUrl: notification.actionUrl,
                    notificationId: dbNotification.id,
                    isMentioned: false, // Batch notifications are not mentions
                  });

                  logger.info('Batch notification result', {
                    userId,
                    notificationId: dbNotification.id,
                    pushSuccess,
                  });

                  return {
                    userId,
                    success: true,
                    notificationId: dbNotification.id,
                    pushNotificationSent: pushSuccess,
                  };
                } catch (pushError) {
                  logger.warn(
                    'Push notification failed for batch notification',
                    {
                      userId,
                      notificationId: dbNotification.id,
                      pushError:
                        pushError instanceof Error
                          ? pushError.message
                          : String(pushError),
                    }
                  );

                  return {
                    userId,
                    success: true,
                    notificationId: dbNotification.id,
                    pushNotificationSent: false,
                  };
                }
              } else {
                const error = 'Failed to create database notification';
                logger.error('Batch notification creation failed', {
                  userId,
                  error,
                });

                return {
                  userId,
                  success: false,
                  error,
                };
              }
            } catch (error) {
              const errorMessage =
                error instanceof Error ? error.message : String(error);
              logger.error('Error in batch notification processing', {
                userId,
                error: errorMessage,
              });

              return {
                userId,
                success: false,
                error: errorMessage,
              };
            }
          }
        );

        // Wait for the current batch to complete
        const batchResults = await Promise.all(notificationPromises);

        const batchSuccessCount = batchResults.filter(r => r.success).length;
        const batchFailureCount = batchResults.filter(r => !r.success).length;
        const pushNotificationSuccesses = batchResults.filter(
          r => r.success && r.pushNotificationSent
        ).length;

        // Collect errors from this batch
        const batchErrors = batchResults
          .filter(r => !r.success && r.error)
          .map(r => r.error!);

        totalSuccessCount += batchSuccessCount;
        totalFailureCount += batchFailureCount;
        totalPushNotificationSuccesses += pushNotificationSuccesses;
        allErrors.push(...batchErrors);

        logger.info(`Batch ${batchIndex + 1} completed`, {
          successful: batchSuccessCount,
          failed: batchFailureCount,
          pushNotificationsSent: pushNotificationSuccesses,
        });

        // Small delay between batches to prevent rate limiting
        if (batchIndex < processingBatches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      logger.info('Batch notification processing completed', {
        totalRequested: userIds.length,
        validUsers: validatedUserIds.length,
        successful: totalSuccessCount,
        failed: totalFailureCount,
        pushNotificationsSent: totalPushNotificationSuccesses,
        batchesProcessed: processingBatches.length,
      });

      return {
        success: true,
        totalUsers: userIds.length,
        validUsers: validatedUserIds.length,
        notificationsCreated: totalSuccessCount,
        pushNotificationsSent: totalPushNotificationSuccesses,
        failed: totalFailureCount,
        batchesProcessed: processingBatches.length,
        errors: allErrors.slice(0, 10), // Limit errors to first 10 to avoid large payloads
        notificationType: notification.type,
      };
    } catch (error) {
      logger.error('Error in batch notification processing', {
        error: error instanceof Error ? error.message : String(error),
        totalUsers: userIds.length,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        totalUsers: userIds.length,
        notificationsCreated: 0,
        pushNotificationsSent: 0,
      };
    }
  },
});

// Helper task for admin announcements to all active users
export const sendAdminAnnouncement = task({
  id: 'send-admin-announcement',
  maxDuration: 300, // 5 minutes
  retry: {
    maxAttempts: 2,
    minTimeoutInMs: 2000,
    maxTimeoutInMs: 5000,
  },
  run: async (payload: {
    title: string;
    message: string;
    actionUrl?: string;
    targetUserType?: 'all' | 'subscribers' | 'admins';
  }) => {
    const { title, message, actionUrl, targetUserType = 'all' } = payload;

    logger.info('Starting admin announcement', {
      title: title.substring(0, 50) + '...',
      targetUserType,
    });

    try {
      const userService = new UserService();

      // Get target users based on type
      let whereClause: any = {};

      switch (targetUserType) {
        case 'subscribers':
          whereClause = {
            subscription: {
              status: 'ACTIVE',
            },
          };
          break;
        case 'admins':
          whereClause = {
            isAdmin: true,
          };
          break;
        case 'all':
        default:
          // All users with active subscriptions or admin access
          whereClause = {
            OR: [
              { isAdmin: true },
              {
                subscription: {
                  status: 'ACTIVE',
                },
              },
            ],
          };
          break;
      }

      // Get all target user IDs
      const targetUsers = await userService.prisma.user.findMany({
        where: whereClause,
        select: { id: true },
      });

      const userIds = targetUsers.map(u => u.id);

      logger.info('Admin announcement targeting', {
        targetUserType,
        totalUsers: userIds.length,
      });

      if (userIds.length === 0) {
        logger.warn('No users found for admin announcement');
        return {
          success: true,
          totalUsers: 0,
          message: 'No target users found',
        };
      }

      // Trigger the batch notification job
      const batchResult = await processBatchNotifications.trigger({
        userIds,
        notification: {
          type: 'ADMIN_ANNOUNCEMENT',
          title,
          message,
          actionUrl,
        },
        metadata: {
          isAdminAnnouncement: true,
          targetUserType,
          timestamp: new Date().toISOString(),
        },
      });

      return {
        success: true,
        totalUsers: userIds.length,
        batchJobId: batchResult.id,
        targetUserType,
      };
    } catch (error) {
      logger.error('Error in admin announcement', {
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});
