# WebPush Notification System Implementation Plan
## Using Trigger.dev for Queue Management

### 📋 Overview
This implementation leverages [Trigger.dev](https://trigger.dev/) for reliable background job processing, replacing database triggers with a more scalable and maintainable solution.

### 🎯 Architecture Benefits
- **No Database Triggers**: All logic in application code
- **Automatic Retries**: Built-in retry logic with exponential backoff
- **Observability**: Real-time monitoring and tracing
- **No Infrastructure**: Trigger.dev handles scaling and deployment
- **Timeout-Free**: Long-running tasks without Lambda/Vercel timeouts

### 🏗️ Architecture Flow
```
Message Created → API Endpoint → Trigger.dev Job → Process Notifications → Send Push
                                       ↓
                              Check Channel Preferences
                                       ↓
                              Create DB Notifications
                                       ↓
                              Queue Push Notifications
```

---

## Phase 1: Database Schema Updates (3 days)

### 1.0 Existing Schema (No Changes Needed)
Your existing schema already has everything needed:
- `channel_notification_preferences` - Per-channel settings
- `push_subscriptions` - Push endpoints and keys
- `notifications` - Notification records

### 1.1 Update Push Subscription Table
```sql
-- Migration: 001_update_push_subscriptions.sql
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS device_info JSONB;
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS last_active TIMESTAMP DEFAULT NOW();
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS failure_count INTEGER DEFAULT 0;
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Add indexes for performance
CREATE INDEX idx_push_subscriptions_user_active ON push_subscriptions(user_id, is_active);
CREATE INDEX idx_push_subscriptions_last_active ON push_subscriptions(last_active);
```

---

## Phase 2: Trigger.dev Setup (2 days)

### 2.1 Install Trigger.dev
```bash
pnpm add @trigger.dev/sdk @trigger.dev/nextjs
pnpm add -D @trigger.dev/cli
```

### 2.2 Configure Trigger.dev
```typescript
// trigger.config.ts
import { defineConfig } from "@trigger.dev/sdk/v3";

export default defineConfig({
  project: "tradersutopia",
  runtime: "node",
  logLevel: "info",
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
  dirs: ["./src/trigger"],
});
```

### 2.3 Setup Environment Variables
```env
# .env.local
TRIGGER_PUBLIC_API_KEY=your_public_key
TRIGGER_SECRET_KEY=your_secret_key
TRIGGER_PROJECT_ID=your_project_id
```

---

## Phase 3: Create Trigger.dev Jobs (3 days)

### 3.1 Message Notification Job
```typescript
// src/trigger/process-message-notifications.ts
import { task } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import { DatabaseService } from "@/services/database";
import { sendPushNotification } from "@/lib/push-notifications";

// Input schema for the job
const messageNotificationSchema = z.object({
  messageId: z.string(),
  content: z.string(),
  channelId: z.string(),
  serverId: z.string(),
  senderId: z.string(),
  senderName: z.string(),
});

export const processMessageNotifications = task({
  id: "process-message-notifications",
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 10000,
  },
  run: async (payload: z.infer<typeof messageNotificationSchema>, { ctx }) => {
    const { messageId, content, channelId, serverId, senderId, senderName } = payload;
    
    console.log(`[Task ${ctx.attempt.number}] Processing notifications for message ${messageId}`);
    
    // Initialize services
    const channelService = new DatabaseService.ChannelService();
    const memberService = new DatabaseService.MemberService();
    const notificationService = new DatabaseService.NotificationService();
    const userService = new DatabaseService.UserService();
    
    // Step 1: Get channel and server info
    const [channel, server] = await Promise.all([
      channelService.getChannel(channelId),
      channelService.getServer(serverId),
    ]);
    
    if (!channel || !server) {
      throw new Error("Channel or server not found");
    }
    
    // Step 2: Get eligible members (excluding sender)
    const members = await memberService.getServerMembers(serverId);
    const eligibleMembers = members.filter(member => {
      // Exclude sender
      if (member.userId === senderId) return false;
      
      // Must be admin or have active subscription
      const isAdmin = member.user.isAdmin;
      const hasActiveSubscription = member.user.subscription?.status === 'active';
      
      return isAdmin || hasActiveSubscription;
    });
    
    console.log(`Found ${eligibleMembers.length} eligible members`);
    
    // Step 3: Check channel notification preferences
    const notificationPromises = eligibleMembers.map(async (member) => {
      try {
        // Get channel preference
        const preference = await notificationService.getChannelNotificationPreference(
          member.userId,
          channelId
        );
        
        // Skip if notifications disabled for this channel
        if (!preference.enabled) {
          console.log(`Notifications disabled for user ${member.userId} in channel ${channelId}`);
          return null;
        }
        
        // Create notification
        const notification = await notificationService.createNotification({
          userId: member.userId,
          type: 'NEW_MESSAGE',
          title: `New message in ${server.name} #${channel.name}`,
          message: `${senderName}: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`,
          actionUrl: `/servers/${serverId}/channels/${channelId}`,
          metadata: {
            messageId,
            channelId,
            serverId,
            senderName,
            isMentioned,
          }
        });
        
        return {
          userId: member.userId,
          notificationId: notification.id,
          isMentioned,
        };
      } catch (error) {
        console.error(`Failed to create notification for user ${member.userId}:`, error);
        return null;
      }
    });
    
    const notificationResults = await Promise.all(notificationPromises);
    const successfulNotifications = notificationResults.filter(Boolean);
    
    console.log(`Created ${successfulNotifications.length} notifications`);
    
    // Step 4: Send push notifications
    const pushPromises = successfulNotifications.map(async (notif) => {
      if (!notif) return null;
      
      try {
        // Get user's push subscriptions
        const user = await userService.getUserWithPushSubscriptions(notif.userId);
        
        if (!user || user.pushSubscriptions.length === 0) {
          console.log(`No push subscriptions for user ${notif.userId}`);
          return null;
        }
        
        // Send push notification
        const success = await sendPushNotification({
          userId: notif.userId,
          title: `New message in ${server.name} #${channel.name}`,
          message: `${senderName}: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`,
          type: 'NEW_MESSAGE',
          actionUrl: `/servers/${serverId}/channels/${channelId}`,
        });
        
        return { userId: notif.userId, success };
      } catch (error) {
        console.error(`Failed to send push notification to user ${notif.userId}:`, error);
        return { userId: notif.userId, success: false };
      }
    });
    
    const pushResults = await Promise.all(pushPromises);
    const successfulPushes = pushResults.filter(r => r?.success).length;
    
    return {
      totalMembers: eligibleMembers.length,
      notificationsCreated: successfulNotifications.length,
      pushNotificationsSent: successfulPushes,
      messageId,
      channelId,
      serverId,
    };
  },
});
```

### 3.2 Batch Notification Job (for announcements)
```typescript
// src/trigger/batch-notifications.ts
import { task } from "@trigger.dev/sdk/v3";
import { z } from "zod";

const batchNotificationSchema = z.object({
  userIds: z.array(z.string()),
  notification: z.object({
    type: z.enum(['ADMIN_ANNOUNCEMENT', 'SYSTEM']),
    title: z.string(),
    message: z.string(),
    actionUrl: z.string().optional(),
  }),
});

export const processBatchNotifications = task({
  id: "process-batch-notifications",
  queue: {
    name: "batch-notifications",
    concurrencyLimit: 5, // Process 5 batches at a time
  },
  run: async (payload: z.infer<typeof batchNotificationSchema>) => {
    // Implementation for batch notifications
    // Similar to message notifications but for system-wide announcements
  },
});
```

---

## Phase 4: Update API Routes (2 days)

### 4.1 Update Message Creation API
```typescript
// src/app/api/servers/[serverId]/channels/[channelId]/messages/route.ts
import { processMessageNotifications } from "@/trigger/process-message-notifications";
import { tasks } from "@trigger.dev/sdk/v3";

export const POST = withAuth(async (req: NextRequest, { user, isAdmin }) => {
  // Only admins can send messages
  if (!isAdmin) {
    throw new ValidationError('Only administrators can send messages');
  }
  
  // ... existing validation code ...
  
  // Create message using service layer
  const message = await messageService.createMessage(
    {
      content: validatedData.content,
      fileUrl: validatedData.fileUrl,
      channelId,
      serverId,
    },
    user.id
  );
  
  // Trigger notification processing via Trigger.dev
  const handle = await tasks.trigger(
    "process-message-notifications",
    {
      messageId: message.id,
      content: message.content,
      channelId: message.channelId,
      serverId: serverId,
      senderId: user.id,
      senderName: user.name || user.email,
    }
  );
  
  console.log(`🚀 [TRIGGER.DEV] Notification job triggered: ${handle.id}`);
  
  return NextResponse.json({
    ...message,
    notificationJobId: handle.id, // Include job ID for tracking
  });
});
```

### 4.2 Create Notification Status Endpoint
```typescript
// src/app/api/notifications/jobs/[jobId]/route.ts
import { runs } from "@trigger.dev/sdk/v3";

export const GET = withAuth(async (req: NextRequest, { params }) => {
  const { jobId } = params;
  
  try {
    const run = await runs.retrieve(jobId);
    
    return NextResponse.json({
      id: run.id,
      status: run.status,
      createdAt: run.createdAt,
      finishedAt: run.finishedAt,
      output: run.output,
      error: run.error,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Job not found" },
      { status: 404 }
    );
  }
});
```

---

## Phase 5: Enhanced Push Service (2 days)

### 5.1 Update Push Notification Service
```typescript
// src/lib/push-notifications.ts
import webpush from 'web-push';
import { UserService } from '@/services/database/user-service';

export async function sendPushNotification(
  data: PushNotificationData
): Promise<boolean> {
  try {
    const userService = new UserService();
    const user = await userService.getUserWithPushSubscriptions(data.userId);
    
    if (!user || !user.pushSubscriptions || user.pushSubscriptions.length === 0) {
      return false;
    }
    
    const validSubscriptions = user.pushSubscriptions.filter(
      sub => sub.is_active && sub.failure_count < 5
    );
    
    if (validSubscriptions.length === 0) {
      return false;
    }
    
    const payload = JSON.stringify({
      title: data.title,
      body: data.message,
      icon: '/logo.png',
      badge: '/logo.png',
      data: {
        url: data.actionUrl || '/',
        notificationId: data.notificationId,
        type: data.type,
        timestamp: Date.now(),
      },
      requireInteraction: data.type === 'NEW_MESSAGE' && data.isMentioned,
      tag: `${data.type}-${Date.now()}`,
      renotify: true,
    });
    
    // Send to all valid subscriptions
    const results = await Promise.allSettled(
      validSubscriptions.map(async (subscription) => {
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
```

---

## Phase 6: Monitoring & Deployment (2 days)

### 6.1 Add Trigger.dev Dashboard Integration
```typescript
// src/app/api/admin/trigger-stats/route.ts
import { runs } from "@trigger.dev/sdk/v3";

export const GET = withAuth(async (req: NextRequest, { user, isAdmin }) => {
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  
  // Get recent notification jobs
  const recentRuns = await runs.list({
    taskIdentifier: "process-message-notifications",
    limit: 100,
  });
  
  const stats = {
    total: recentRuns.data.length,
    successful: recentRuns.data.filter(r => r.status === 'COMPLETED').length,
    failed: recentRuns.data.filter(r => r.status === 'FAILED').length,
    pending: recentRuns.data.filter(r => r.status === 'PENDING').length,
    avgDuration: calculateAverageDuration(recentRuns.data),
  };
  
  return NextResponse.json(stats);
});
```

### 6.2 Setup Trigger.dev Alerts
```typescript
// src/trigger/alerts.ts
import { schedules } from "@trigger.dev/sdk/v3";

export const monitorNotificationJobs = schedules.create({
  id: "monitor-notification-jobs",
  cron: "*/15 * * * *", // Every 15 minutes
  run: async (payload, { ctx }) => {
    // Check for failed jobs and alert via Slack/Discord
    const failedRuns = await runs.list({
      status: ["FAILED"],
      createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) },
    });
    
    if (failedRuns.data.length > 5) {
      // Send alert to admin
      await sendAdminAlert({
        message: `⚠️ High failure rate: ${failedRuns.data.length} notification jobs failed in last 15 minutes`,
        severity: 'high',
      });
    }
  },
});
```

---

## Deployment Steps

### 1. Initial Setup (Day 1)
- [ ] Run database migrations
- [ ] Install Trigger.dev packages
- [ ] Configure environment variables
- [ ] Deploy Trigger.dev configuration

### 2. Deploy Jobs (Day 2)
- [ ] Deploy notification processing job
- [ ] Test with a few messages
- [ ] Monitor Trigger.dev dashboard

### 3. Update API Routes (Day 3)
- [ ] Update message creation endpoint
- [ ] Deploy API changes
- [ ] Test end-to-end flow

### 4. Go Live (Day 4)
- [ ] Enable for all users
- [ ] Monitor performance
- [ ] Setup alerts

---

## Key Advantages Over Database Triggers

1. **Better Observability**: Full visibility into job execution in Trigger.dev dashboard
2. **Easier Debugging**: Detailed logs and ability to replay failed jobs
3. **Scalability**: Automatically scales based on load
4. **Flexibility**: Easy to add new notification types or modify logic
5. **No Database Load**: Processing happens outside your database
6. **Built-in Retries**: Automatic retry with exponential backoff
7. **Concurrency Control**: Built-in queue management

---

## Performance Optimization

### 1. Batch Processing
```typescript
// Process notifications in batches for better performance
const BATCH_SIZE = 50;
const batches = chunk(eligibleMembers, BATCH_SIZE);

for (const batch of batches) {
  await Promise.all(batch.map(member => processNotification(member)));
}
```

### 2. Caching
```typescript
// Cache channel preferences for 5 minutes
const preferencesCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
```

### 3. Concurrency Limits
```typescript
// Configure in trigger.config.ts
queue: {
  concurrencyLimit: 10, // Process 10 jobs simultaneously
}
```

---

## Cost Estimation

Based on [Trigger.dev pricing](https://trigger.dev/):
- **Free tier**: 50K runs/month
- **Your volume**: ~30K messages/month = well within free tier
- **Cost**: $0/month initially

As you scale:
- 100K runs/month = ~$29/month
- 500K runs/month = ~$99/month

---

## Migration Path from Database Triggers

1. **Deploy Trigger.dev jobs** alongside existing triggers
2. **Dual-write period**: Send notifications via both systems
3. **Monitor and compare** results
4. **Gradually migrate** traffic to Trigger.dev
5. **Remove database triggers** once confident

This approach ensures zero downtime and safe migration.