# Ticket 4.2: Complete Database Service Migration
**Priority:** HIGH | **Effort:** 3 days | **Risk:** LOW

## Description
Complete the migration of all remaining database operations to the service layer, eliminating the final 50+ duplicate database queries across 25+ API routes.

## Remaining Services to Implement

### MessageService
```typescript
// src/services/database/message-service.ts
export class MessageService extends BaseService {
  // Paginated message retrieval - used 5+ times
  async findMessagesPaginated(
    channelId: string, 
    options: MessagePaginationOptions
  ): Promise<PaginatedMessages> {
    try {
      this.validateId(channelId, 'channelId');
      
      const messages = await this.prisma.message.findMany({
        where: { 
          channelId,
          deleted: false 
        },
        include: {
          attachments: {
            orderBy: { createdAt: 'asc' }
          },
          member: {
            include: { 
              user: { select: { id: true, name: true, imageUrl: true } }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: options.limit || 50,
        cursor: options.cursor ? { id: options.cursor } : undefined,
        skip: options.cursor ? 1 : 0
      });
      
      const nextCursor = messages.length > 0 ? messages[messages.length - 1].id : null;
      
      return {
        data: messages,
        nextCursor,
        hasMore: messages.length === (options.limit || 50)
      };
    } catch (error) {
      this.handleError(error, 'find messages paginated', { channelId, options });
    }
  }
  
  // Message CRUD with relationships
  async createMessage(data: CreateMessageData): Promise<MessageWithRelations> {
    try {
      return await this.executeTransaction(async (tx) => {
        const message = await tx.message.create({
          data: {
            content: data.content,
            channelId: data.channelId,
            memberId: data.memberId,
          },
          include: {
            member: {
              include: { user: true }
            },
            channel: true
          }
        });
        
        // Create attachments if provided
        if (data.attachments && data.attachments.length > 0) {
          const attachmentService = new AttachmentService(tx);
          await attachmentService.createAttachmentsForMessage(message.id, data.attachments);
        }
        
        return message;
      });
    } catch (error) {
      this.handleError(error, 'create message', data);
    }
  }
  
  // Track record messages (special message type)
  async findTrackRecordMessages(options: TrackRecordOptions): Promise<Message[]> {
    try {
      return await this.prisma.message.findMany({
        where: {
          channel: {
            name: 'track-record',
            server: { name: 'Traders Utopia' }
          },
          deleted: false
        },
        include: {
          attachments: true,
          member: {
            include: { user: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: options.limit || 20
      });
    } catch (error) {
      this.handleError(error, 'find track record messages', options);
    }
  }
}
```

### MemberService
```typescript
// src/services/database/member-service.ts
export class MemberService extends BaseService {
  // Permission checks - used 8+ times
  async findMemberInServer(serverId: string, userId: string): Promise<Member | null> {
    try {
      this.validateId(serverId, 'serverId');
      this.validateId(userId, 'userId');
      
      return await this.prisma.member.findFirst({
        where: { 
          serverId,
          userId 
        },
        include: {
          user: true,
          role: {
            include: {
              channelAccess: true,
              sectionAccess: true
            }
          }
        }
      });
    } catch (error) {
      this.handleError(error, 'find member in server', { serverId, userId });
    }
  }
  
  // Bulk operations for ensuring all users are members
  async ensureAllUsersAreMembersOfServer(serverId: string): Promise<void> {
    try {
      this.validateId(serverId, 'serverId');
      
      await this.executeTransaction(async (tx) => {
        // Find users who are not members of this server
        const usersNotInServer = await tx.user.findMany({
          where: {
            members: {
              none: { serverId }
            }
          }
        });
        
        // Get default role for server
        const defaultRole = await tx.role.findFirst({
          where: { 
            serverId,
            isDefault: true 
          }
        });
        
        if (!defaultRole) {
          throw new Error(`No default role found for server ${serverId}`);
        }
        
        // Create member records for all users
        const memberData = usersNotInServer.map(user => ({
          userId: user.id,
          serverId,
          roleId: defaultRole.id,
        }));
        
        if (memberData.length > 0) {
          await tx.member.createMany({
            data: memberData,
            skipDuplicates: true
          });
        }
      });
    } catch (error) {
      this.handleError(error, 'ensure all users are members of server', { serverId });
    }
  }
}
```

### NotificationService
```typescript
// src/services/database/notification-service.ts
export class NotificationService extends BaseService {
  // Channel notification preferences
  async findChannelNotificationPreference(
    channelId: string, 
    userId: string
  ): Promise<ChannelNotificationPreference | null> {
    try {
      this.validateId(channelId, 'channelId');
      this.validateId(userId, 'userId');
      
      return await this.prisma.channelNotificationPreference.findFirst({
        where: { channelId, userId }
      });
    } catch (error) {
      this.handleError(error, 'find channel notification preference', { channelId, userId });
    }
  }
  
  async upsertChannelNotificationPreference(
    data: UpsertNotificationData
  ): Promise<ChannelNotificationPreference> {
    try {
      return await this.prisma.channelNotificationPreference.upsert({
        where: {
          userId_channelId: {
            userId: data.userId,
            channelId: data.channelId
          }
        },
        create: data,
        update: { enabled: data.enabled }
      });
    } catch (error) {
      this.handleError(error, 'upsert channel notification preference', data);
    }
  }
  
  // Push notification management
  async resetPushNotifications(userId: string): Promise<void> {
    try {
      this.validateId(userId, 'userId');
      
      await this.prisma.pushSubscription.deleteMany({
        where: { userId }
      });
    } catch (error) {
      this.handleError(error, 'reset push notifications', { userId });
    }
  }
}
```

## Migration Progress Tracking
```typescript
// scripts/track-migration-progress.ts
export async function trackDatabaseMigrationProgress() {
  const apiRoutes = await glob('src/app/api/**/*.ts');
  const migrationStats = {
    totalRoutes: apiRoutes.length,
    migratedRoutes: 0,
    remainingRoutes: [],
    duplicateQueryPatterns: []
  };
  
  for (const route of apiRoutes) {
    const content = await fs.readFile(route, 'utf-8');
    
    // Check if route uses service layer
    const usesServiceLayer = content.includes('Service') && 
                            !content.includes('prisma.') && 
                            !content.includes('db.');
    
    if (usesServiceLayer) {
      migrationStats.migratedRoutes++;
    } else {
      migrationStats.remainingRoutes.push(route);
      
      // Find duplicate patterns
      const profileLookups = content.match(/prisma\.profile\.findFirst/g);
      if (profileLookups) {
        migrationStats.duplicateQueryPatterns.push({
          route,
          pattern: 'profile.findFirst',
          count: profileLookups.length
        });
      }
    }
  }
  
  console.log('📊 Database Migration Progress:', migrationStats);
  return migrationStats;
}
```

## Acceptance Criteria
- [ ] Implement remaining database services (Message, Member, Notification)
- [ ] Migrate all remaining API routes to use service layer
- [ ] Eliminate all direct Prisma calls from API routes
- [ ] Create migration progress tracking utility
- [ ] Reduce database query duplication by 90%+
- [ ] Maintain exact same API behavior and performance
- [ ] Add comprehensive error handling and logging

## Files to Create/Modify
- `src/services/database/message-service.ts` (new)
- `src/services/database/member-service.ts` (new)
- `src/services/database/notification-service.ts` (new)
- `src/services/database/index.ts` (main export)
- `scripts/track-migration-progress.ts` (new)
- Migrate all remaining API routes

### Documentation Requirements
- [ ] Create database service architecture diagram showing all relationships
- [ ] Document message and notification patterns in `docs/features/messaging-system.md`
- [ ] Add database optimization guide with query patterns

### Testing Requirements
- [ ] **Unit Tests**: All database services with comprehensive mocking
- [ ] **Integration Tests**: Database operations with real connections
- [ ] **Performance Tests**: Query optimization validation under load
- [ ] **Message Flow Tests**: End-to-end message creation and notification delivery
- [ ] **Member Management Tests**: Role assignments and server access validation

## Dependencies
- Ticket 2.2 and 2.3 (Database Service Layer foundation) 