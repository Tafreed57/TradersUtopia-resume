# Message Notification Database Trigger

## Overview

This document outlines the PostgreSQL trigger implementation that automatically creates notifications for users when new messages are sent to channels they're subscribed to.

## Trigger Logic

The trigger will:
1. Execute after a new message is inserted
2. Find users who have notifications enabled for the channel
3. Verify users have access to the channel via their role
4. Create notification records for eligible users
5. Exclude the message sender from receiving their own notification

## SQL Implementation

### 1. Trigger Function

```sql
-- Function to create notifications when messages are sent
CREATE OR REPLACE FUNCTION notify_channel_subscribers()
RETURNS TRIGGER AS $$
DECLARE
    subscriber_record RECORD;
    sender_user_id TEXT;
BEGIN
    -- Get the user ID of the message sender
    SELECT u.id INTO sender_user_id
    FROM users u
    INNER JOIN members m ON u.id = m."userId"
    WHERE m.id = NEW."memberId";

    -- Find users who should receive notifications for this channel
    FOR subscriber_record IN
        SELECT DISTINCT 
            cnp."userId",
            u.name as user_name,
            c.name as channel_name,
            sender.name as sender_name
        FROM channel_notification_preferences cnp
        INNER JOIN users u ON cnp."userId" = u.id
        INNER JOIN channels c ON cnp."channelId" = c.id
        INNER JOIN members m ON u.id = m."userId" AND c."serverId" = m."serverId"
        INNER JOIN roles r ON m."roleId" = r.id
        INNER JOIN role_channel_access rca ON r.id = rca."roleId" AND c.id = rca."channelId"
        INNER JOIN members sender_member ON NEW."memberId" = sender_member.id
        INNER JOIN users sender ON sender_member."userId" = sender.id
        WHERE cnp."channelId" = NEW."channelId"
        AND cnp.enabled = true
        AND cnp."userId" != sender_user_id  -- Don't notify the sender
    LOOP
        -- Insert notification for each eligible subscriber
        INSERT INTO notifications (
            id,
            "userId",
            type,
            title,
            message,
            "actionUrl",
            metadata,
            "createdAt"
        ) VALUES (
            gen_random_uuid()::text,
            subscriber_record."userId",
            'NEW_MESSAGE',
            'New message in #' || subscriber_record.channel_name,
            subscriber_record.sender_name || ': ' || LEFT(NEW.content, 100) || 
                CASE WHEN LENGTH(NEW.content) > 100 THEN '...' ELSE '' END,
            '/servers/' || (SELECT "serverId" FROM channels WHERE id = NEW."channelId") || 
                '/channels/' || NEW."channelId",
            jsonb_build_object(
                'channelId', NEW."channelId",
                'messageId', NEW.id,
                'senderId', sender_user_id,
                'senderName', subscriber_record.sender_name,
                'channelName', subscriber_record.channel_name
            ),
            NOW()
        );
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### 2. Create the Trigger

```sql
-- Create trigger that fires after message insert
DROP TRIGGER IF EXISTS message_notification_trigger ON messages;

CREATE TRIGGER message_notification_trigger
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION notify_channel_subscribers();
```

### 3. Enhanced Version with Performance Optimization

```sql
-- Optimized version with better performance for large datasets
CREATE OR REPLACE FUNCTION notify_channel_subscribers_optimized()
RETURNS TRIGGER AS $$
DECLARE
    sender_user_id TEXT;
    channel_name TEXT;
    sender_name TEXT;
    server_id TEXT;
    notification_batch RECORD[];
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

    -- Batch insert notifications for all eligible subscribers
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
    AND cnp."userId" != sender_user_id
    AND rca."channelId" = NEW."channelId"
    AND m."serverId" = server_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update trigger to use optimized function
DROP TRIGGER IF EXISTS message_notification_trigger ON messages;

CREATE TRIGGER message_notification_trigger
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION notify_channel_subscribers_optimized();
```

## Integration with Prisma

### Add to Migration File

Create a new Prisma migration:

```bash
npx prisma migrate dev --create-only --name add_message_notification_trigger
```

Then add the SQL to the generated migration file:

```sql
-- Add this to your migration file
-- migrations/[timestamp]_add_message_notification_trigger/migration.sql

-- Create the trigger function
CREATE OR REPLACE FUNCTION notify_channel_subscribers_optimized()
RETURNS TRIGGER AS $$
DECLARE
    sender_user_id TEXT;
    channel_name TEXT;
    sender_name TEXT;
    server_id TEXT;
BEGIN
    -- Get sender info and channel details
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

    -- Batch insert notifications
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
    AND cnp."userId" != sender_user_id
    AND rca."channelId" = NEW."channelId"
    AND m."serverId" = server_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
CREATE TRIGGER message_notification_trigger
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION notify_channel_subscribers_optimized();
```

## Alternative: Application-Level Implementation

If you prefer handling this in your application code instead of database triggers:

```typescript
// src/lib/notifications/message-notifications.ts
export async function createMessageNotifications(messageId: string) {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: {
      channel: {
        include: {
          server: true
        }
      },
      member: {
        include: {
          user: true
        }
      }
    }
  });

  if (!message) return;

  // Find users who should receive notifications
  const subscribers = await prisma.channelNotificationPreference.findMany({
    where: {
      channelId: message.channelId,
      enabled: true,
      userId: {
        not: message.member.userId // Exclude sender
      }
    },
    include: {
      user: {
        include: {
          members: {
            where: {
              serverId: message.channel.serverId
            },
            include: {
              role: {
                include: {
                  channelAccess: {
                    where: {
                      channelId: message.channelId
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  });

  // Create notifications for eligible users
  const notifications = subscribers
    .filter(sub => 
      sub.user.members.some(member => 
        member.role.channelAccess.length > 0
      )
    )
    .map(sub => ({
      userId: sub.userId,
      type: 'NEW_MESSAGE' as const,
      title: `New message in #${message.channel.name}`,
      message: `${message.member.user.name}: ${message.content.substring(0, 100)}${message.content.length > 100 ? '...' : ''}`,
      actionUrl: `/servers/${message.channel.serverId}/channels/${message.channelId}`,
      metadata: {
        channelId: message.channelId,
        messageId: message.id,
        senderId: message.member.userId,
        senderName: message.member.user.name,
        channelName: message.channel.name
      }
    }));

  if (notifications.length > 0) {
    await prisma.notification.createMany({
      data: notifications
    });
  }
}

// Use in your message creation API
export async function POST(req: Request) {
  // ... create message logic ...
  
  const message = await prisma.message.create({
    data: messageData
  });

  // Create notifications
  await createMessageNotifications(message.id);

  return NextResponse.json(message);
}
```

## Benefits of Database Trigger Approach

1. **Automatic**: Notifications are created regardless of how messages are inserted
2. **Performance**: Single database operation, no additional API calls
3. **Consistency**: Always happens, even if application logic fails
4. **Atomic**: Part of the same transaction as message creation

## Benefits of Application-Level Approach

1. **Flexibility**: Easier to add complex business logic
2. **Debugging**: Easier to test and debug
3. **Error Handling**: Better error handling and logging
4. **Integration**: Easier to integrate with push notifications, emails, etc.

## Recommendation

I recommend starting with the **database trigger** for automatic notification creation, and then using application-level code for additional features like:
- Push notifications
- Email notifications  
- Webhook integrations
- Complex filtering logic

The trigger ensures notifications are always created, while application code handles the delivery mechanisms. 