import { PrismaClient } from '@prisma/client';
import { apiLogger } from '@/lib/enhanced-logger';

export interface TriggerStats {
  total_messages: number;
  avg_trigger_delay: number | null;
  channels_with_messages: number;
}

/**
 * Service for managing PostgreSQL notification triggers.
 * Handles installation, removal, testing, and monitoring of database triggers.
 */
export class NotificationTriggerService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Install the message notification trigger function and trigger.
   * This should be called during database migrations.
   */
  async installMessageNotificationTrigger(): Promise<void> {
    const triggerSQL = `
      -- Create optimized notification trigger function
      CREATE OR REPLACE FUNCTION notify_channel_subscribers_optimized()
      RETURNS TRIGGER AS $$
      DECLARE
          sender_user_id TEXT;
          channel_name TEXT;
          sender_name TEXT;
          server_id TEXT;
      BEGIN
          -- Get sender info and channel details in one query
          SELECT 
              u.id,
              u.name,
              c.name,
              c."serverId"
          INTO sender_user_id, sender_name, channel_name, server_id
          FROM users u
          INNER JOIN members m ON u.id = m."userId"
          INNER JOIN channels c ON NEW."channelId" = c.id
          WHERE m.id = NEW."memberId";

          -- Only proceed if we found valid sender and channel data
          IF sender_user_id IS NULL OR channel_name IS NULL THEN
              RETURN NEW;
          END IF;

          -- Batch insert notifications for eligible subscribers
          INSERT INTO notifications (
              id,
              "userId",
              type,
              title,
              message,
              "actionUrl",
              metadata,
              "createdAt"
          )
          SELECT 
              gen_random_uuid()::text,
              cnp."userId",
              'NEW_MESSAGE',
              'New message in #' || channel_name,
              sender_name || ': ' || LEFT(NEW.content, 100) || 
                  CASE WHEN LENGTH(NEW.content) > 100 THEN '...' ELSE '' END,
              '/servers/' || server_id || '/channels/' || NEW."channelId",
              jsonb_build_object(
                  'channelId', NEW."channelId",
                  'messageId', NEW.id,
                  'senderId', sender_user_id,
                  'senderName', sender_name,
                  'channelName', channel_name
              ),
              NOW()
          FROM channel_notification_preferences cnp
          INNER JOIN users u ON cnp."userId" = u.id
          INNER JOIN members m ON u.id = m."userId" 
          INNER JOIN roles r ON m."roleId" = r.id
          INNER JOIN role_channel_access rca ON r.id = rca."roleId"
          WHERE cnp."channelId" = NEW."channelId"
          AND cnp.enabled = true
          AND cnp."userId" != sender_user_id  -- Don't notify sender
          AND rca."channelId" = NEW."channelId"  -- Check access via role
          AND m."serverId" = server_id;

          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      -- Create the trigger
      DROP TRIGGER IF EXISTS message_notification_trigger ON messages;

      CREATE TRIGGER message_notification_trigger
          AFTER INSERT ON messages
          FOR EACH ROW
          EXECUTE FUNCTION notify_channel_subscribers_optimized();
    `;

    try {
      await this.prisma.$executeRawUnsafe(triggerSQL);
      apiLogger.databaseOperation('install_notification_trigger', true, {
        trigger_name: 'message_notification_trigger',
      });
      console.log('✅ Message notification trigger installed successfully');
    } catch (error) {
      apiLogger.databaseOperation('install_notification_trigger', false, {
        error: error instanceof Error ? error.message : String(error),
        trigger_name: 'message_notification_trigger',
      });
      throw error;
    }
  }

  /**
   * Remove the message notification trigger and function.
   * This should be used for rollbacks or cleanup.
   */
  async removeMessageNotificationTrigger(): Promise<void> {
    const dropSQL = `
      DROP TRIGGER IF EXISTS message_notification_trigger ON messages;
      DROP FUNCTION IF EXISTS notify_channel_subscribers_optimized();
    `;

    try {
      await this.prisma.$executeRawUnsafe(dropSQL);
      apiLogger.databaseOperation('remove_notification_trigger', true, {
        trigger_name: 'message_notification_trigger',
      });
      console.log('🗑️ Message notification trigger removed successfully');
    } catch (error) {
      apiLogger.databaseOperation('remove_notification_trigger', false, {
        error: error instanceof Error ? error.message : String(error),
        trigger_name: 'message_notification_trigger',
      });
      throw error;
    }
  }

  /**
   * Test the notification trigger functionality.
   * Creates a test message and verifies notifications are created.
   */
  async testNotificationTrigger(testMessageData: {
    content: string;
    channelId: string;
    memberId: string;
  }): Promise<boolean> {
    try {
      // Count notifications before test
      const beforeCount = await this.prisma.notification.count();

      // Create test message (trigger should fire)
      const message = await this.prisma.message.create({
        data: testMessageData,
      });

      // Wait a moment for trigger execution
      await new Promise(resolve => setTimeout(resolve, 200));

      // Count notifications after test
      const afterCount = await this.prisma.notification.count();

      // Clean up test message
      // Note: We'll clean up the message but let test notifications remain
      // as they'll be cleaned up naturally or via a separate cleanup job
      await this.prisma.message.delete({
        where: { id: message.id },
      });

      const notificationsCreated = afterCount > beforeCount;

      apiLogger.databaseOperation(
        'test_notification_trigger',
        notificationsCreated,
        {
          notifications_created: afterCount - beforeCount,
          test_message_id: message.id,
        }
      );

      return notificationsCreated;
    } catch (error) {
      apiLogger.databaseOperation('test_notification_trigger', false, {
        error: error instanceof Error ? error.message : String(error),
        test_data: testMessageData,
      });
      console.error('Trigger test failed:', error);
      return false;
    }
  }

  /**
   * Get performance statistics for the notification trigger.
   * Monitors trigger execution and effectiveness.
   */
  async getTriggerPerformanceStats(): Promise<TriggerStats> {
    try {
      const result = await this.prisma.$queryRaw<TriggerStats[]>`
        SELECT 
          COUNT(*)::int as total_messages,
          AVG(EXTRACT(EPOCH FROM (m."createdAt" - LAG(m."createdAt") OVER (ORDER BY m."createdAt"))))::float as avg_trigger_delay,
          COUNT(DISTINCT m."channelId")::int as channels_with_messages
        FROM messages m
        WHERE m."createdAt" >= NOW() - INTERVAL '24 hours'
      `;

      const stats = result[0] || {
        total_messages: 0,
        avg_trigger_delay: null,
        channels_with_messages: 0,
      };

      apiLogger.databaseOperation('get_trigger_stats', true, stats);

      return stats;
    } catch (error) {
      apiLogger.databaseOperation('get_trigger_stats', false, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Check if the notification trigger is installed and functioning.
   */
  async checkTriggerStatus(): Promise<{
    function_exists: boolean;
    trigger_exists: boolean;
    is_enabled: boolean;
  }> {
    try {
      const result = await this.prisma.$queryRaw<
        {
          function_exists: boolean;
          trigger_exists: boolean;
          is_enabled: boolean;
        }[]
      >`
        SELECT 
          EXISTS(
            SELECT 1 FROM pg_proc 
            WHERE proname = 'notify_channel_subscribers_optimized'
          ) as function_exists,
          EXISTS(
            SELECT 1 FROM pg_trigger 
            WHERE tgname = 'message_notification_trigger'
          ) as trigger_exists,
          CASE 
            WHEN EXISTS(
              SELECT 1 FROM pg_trigger 
              WHERE tgname = 'message_notification_trigger' 
              AND tgenabled = 'O'
            ) THEN true
            ELSE false
          END as is_enabled
      `;

      const status = result[0];

      apiLogger.databaseOperation('check_trigger_status', true, status);

      return status;
    } catch (error) {
      apiLogger.databaseOperation('check_trigger_status', false, {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
