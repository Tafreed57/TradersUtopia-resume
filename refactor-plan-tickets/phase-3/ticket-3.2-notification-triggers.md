# Ticket 3.2: Message Notification Database Trigger Implementation
**Priority:** HIGH | **Effort:** 2 days | **Risk:** MEDIUM

## Description
Implement PostgreSQL database triggers to automatically create notifications when messages are sent, ensuring real-time notifications even if application code fails.

## Current Problem
- Notification creation depends on application logic
- Inconsistent notification delivery if app crashes during message creation
- Manual notification logic scattered across different endpoints

## Implementation

### Database Trigger Function
```sql
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
```

### Application Integration
```typescript
// src/lib/notifications/trigger-integration.ts
export class NotificationTriggerService {
  private prisma: PrismaClient;
  
  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }
  
  // Install trigger (for migrations)
  async installMessageNotificationTrigger(): Promise<void> {
    const triggerSQL = `
      -- Trigger function code here (from above)
    `;
    
    await this.prisma.$executeRawUnsafe(triggerSQL);
    console.log('✅ Message notification trigger installed');
  }
  
  // Remove trigger (for rollback)
  async removeMessageNotificationTrigger(): Promise<void> {
    await this.prisma.$executeRawUnsafe(`
      DROP TRIGGER IF EXISTS message_notification_trigger ON messages;
      DROP FUNCTION IF EXISTS notify_channel_subscribers_optimized();
    `);
    console.log('🗑️ Message notification trigger removed');
  }
  
  // Test trigger functionality
  async testNotificationTrigger(testMessageData: any): Promise<boolean> {
    try {
      // Count notifications before
      const beforeCount = await this.prisma.notification.count();
      
      // Create test message (trigger should fire)
      const message = await this.prisma.message.create({
        data: testMessageData,
      });
      
      // Wait a moment for trigger execution
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Count notifications after
      const afterCount = await this.prisma.notification.count();
      
      // Clean up test message
      await this.prisma.message.delete({
        where: { id: message.id },
      });
      
      return afterCount > beforeCount;
    } catch (error) {
      console.error('Trigger test failed:', error);
      return false;
    }
  }
  
  // Monitor trigger performance
  async getTriggerPerformanceStats(): Promise<TriggerStats> {
    const result = await this.prisma.$queryRaw`
      SELECT 
        COUNT(*) as total_messages,
        AVG(EXTRACT(EPOCH FROM (created_at - LAG(created_at) OVER (ORDER BY created_at)))) as avg_trigger_delay,
        COUNT(DISTINCT "channelId") as channels_with_messages
      FROM messages 
      WHERE created_at >= NOW() - INTERVAL '24 hours'
    `;
    
    return result[0];
  }
}

interface TriggerStats {
  total_messages: number;
  avg_trigger_delay: number;
  channels_with_messages: number;
}
```

### Trigger Migration
```typescript
-- Add to Prisma migration file
-- migrations/add_message_notification_trigger/migration.sql

-- Install the notification trigger
CREATE OR REPLACE FUNCTION notify_channel_subscribers_optimized()
RETURNS TRIGGER AS $$
-- (Full trigger function code)
$$ LANGUAGE plpgsql;

CREATE TRIGGER message_notification_trigger
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION notify_channel_subscribers_optimized();
```

## Acceptance Criteria
- [ ] Create optimized PostgreSQL trigger function
- [ ] Install trigger via Prisma migration
- [ ] Test trigger creates notifications for eligible users
- [ ] Verify trigger respects role-based access control
- [ ] Ensure trigger excludes message sender from notifications
- [ ] Validate trigger performance under load (< 50ms execution time)
- [ ] Create monitoring and testing utilities
- [ ] Document trigger behavior and edge cases

## Files to Create/Modify
- `src/lib/notifications/trigger-integration.ts` (new)
- `prisma/migrations/add_message_notification_trigger/migration.sql` (new)
- `src/app/api/messages/route.ts` (remove manual notification logic)
- `scripts/test-notification-trigger.ts` (new testing script)

## Dependencies
- Ticket 3.1 (Database Schema Migration)
- New User and Role models in place

## Testing Strategy
- Unit tests for trigger function logic
- Integration tests with role-based access
- Performance tests with multiple subscribers
- Edge case testing (deleted users, invalid channels) 