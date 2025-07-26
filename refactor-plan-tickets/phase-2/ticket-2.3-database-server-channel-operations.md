# Ticket 2.3: Database Service Layer - Server & Channel Operations
**Priority:** MEDIUM | **Effort:** 3 days | **Risk:** Low

## Description
Implement ServerService and ChannelService to consolidate server permission checks (20+ instances) and channel access verification (15+ instances) with audit logging for security compliance.

## Current Problem
Server permission checks repeated across 20+ routes:
```typescript
const server = await prisma.server.findFirst({
  where: {
    id: serverId,
    members: {
      some: {
        profileId: profile.id,
      },
    },
  },
});
```

Channel access verification repeated 15+ times:
```typescript
const channel = await prisma.channel.findFirst({
  where: {
    id: channelId,
    server: {
      members: {
        some: {
          profileId: profile.id,
        },
      },
    },
  },
});
```

## Implementation

### ServerService
```typescript
// src/services/database/server-service.ts
export class ServerService extends BaseService {
  // Permission checks - used 15+ times
  async findServerWithMemberAccess(serverId: string, profileId: string): Promise<ServerWithMember | null> {
    try {
      this.validateId(serverId, 'serverId');
      this.validateId(profileId, 'profileId');
      
      return await this.prisma.server.findFirst({
        where: {
          id: serverId,
          members: {
            some: {
              profileId,
            },
          },
        },
        include: {
          members: {
            where: { profileId },
            include: {
              profile: true,
            },
          },
          channels: {
            orderBy: { createdAt: 'asc' },
          },
          sections: {
            orderBy: { createdAt: 'asc' },
            include: {
              channels: {
                orderBy: { createdAt: 'asc' },
              },
            },
          },
        },
      });
    } catch (error) {
      this.handleError(error, 'find server with member access', { serverId, profileId });
    }
  }
  
  // Server management
  async createServer(data: CreateServerData): Promise<Server> {
    try {
      return await this.executeTransaction(async (tx) => {
        const server = await tx.server.create({
          data: {
            name: data.name,
            imageUrl: data.imageUrl,
            inviteCode: data.inviteCode,
            profileId: data.profileId,
          },
        });
        
        // Create default member for creator
        await tx.member.create({
          data: {
            role: 'ADMIN',
            profileId: data.profileId,
            serverId: server.id,
          },
        });
        
        // Create default section and channel
        const defaultSection = await tx.section.create({
          data: {
            name: 'General',
            serverId: server.id,
          },
        });
        
        await tx.channel.create({
          data: {
            name: 'general',
            type: 'TEXT',
            serverId: server.id,
            sectionId: defaultSection.id,
          },
        });
        
        return server;
      });
    } catch (error) {
      this.handleError(error, 'create server', data);
    }
  }
  
  async updateServer(id: string, data: UpdateServerData): Promise<Server> {
    try {
      this.validateId(id, 'serverId');
      
      return await this.prisma.server.update({
        where: { id },
        data,
      });
    } catch (error) {
      this.handleError(error, 'update server', { id, data });
    }
  }
  
  async deleteServer(id: string): Promise<Server> {
    try {
      this.validateId(id, 'serverId');
      
      return await this.prisma.server.delete({
        where: { id },
      });
    } catch (error) {
      this.handleError(error, 'delete server', { id });
    }
  }
  
  // Member-related server operations
  async findServersForProfile(profileId: string): Promise<Server[]> {
    try {
      this.validateId(profileId, 'profileId');
      
      return await this.prisma.server.findMany({
        where: {
          members: {
            some: {
              profileId,
            },
          },
        },
        include: {
          channels: {
            where: {
              name: 'general',
            },
            orderBy: {
              createdAt: 'asc',
            },
          },
        },
      });
    } catch (error) {
      this.handleError(error, 'find servers for profile', { profileId });
    }
  }
  
  // Admin operations
  async findServerByIdWithDetails(id: string): Promise<ServerWithDetails | null> {
    try {
      this.validateId(id, 'serverId');
      
      return await this.prisma.server.findUnique({
        where: { id },
        include: {
          channels: {
            orderBy: { createdAt: 'asc' },
          },
          members: {
            include: {
              profile: true,
            },
            orderBy: {
              role: 'asc',
            },
          },
          sections: {
            orderBy: { createdAt: 'asc' },
            include: {
              channels: {
                orderBy: { createdAt: 'asc' },
              },
            },
          },
        },
      });
    } catch (error) {
      this.handleError(error, 'find server with details', { id });
    }
  }
  
  async ensureDefaultServer(): Promise<Server> {
    try {
      let server = await this.prisma.server.findFirst({
        where: { name: 'Traders Utopia' },
      });
      
      if (!server) {
        // Create default server
        const defaultProfile = await this.prisma.profile.findFirst({
          where: { isAdmin: true },
        });
        
        if (!defaultProfile) {
          throw new Error('No admin profile found to create default server');
        }
        
        server = await this.createServer({
          name: 'Traders Utopia',
          imageUrl: '',
          inviteCode: '',
          profileId: defaultProfile.id,
        });
      }
      
      return server;
    } catch (error) {
      this.handleError(error, 'ensure default server');
    }
  }
  
  async addMembersToServer(serverId: string, memberIds: string[]): Promise<void> {
    try {
      this.validateId(serverId, 'serverId');
      
      await this.executeTransaction(async (tx) => {
        const memberData = memberIds.map(profileId => ({
          profileId,
          serverId,
          role: 'GUEST' as const,
        }));
        
        await tx.member.createMany({
          data: memberData,
          skipDuplicates: true,
        });
      });
    } catch (error) {
      this.handleError(error, 'add members to server', { serverId, memberIds });
    }
  }
}
```

### ChannelService
```typescript
// src/services/database/channel-service.ts
export class ChannelService extends BaseService {
  // Access verification - used 10+ times
  async findChannelWithMemberAccess(channelId: string, profileId: string): Promise<ChannelWithAccess | null> {
    try {
      this.validateId(channelId, 'channelId');
      this.validateId(profileId, 'profileId');
      
      return await this.prisma.channel.findFirst({
        where: {
          id: channelId,
          server: {
            members: {
              some: {
                profileId,
              },
            },
          },
        },
        include: {
          server: {
            include: {
              members: {
                where: { profileId },
                include: { profile: true },
              },
            },
          },
        },
      });
    } catch (error) {
      this.handleError(error, 'find channel with member access', { channelId, profileId });
    }
  }
  
  // Channel hierarchy operations
  async findChannelInSection(sectionId: string, criteria: FindChannelCriteria): Promise<Channel | null> {
    try {
      this.validateId(sectionId, 'sectionId');
      
      return await this.prisma.channel.findFirst({
        where: {
          sectionId,
          ...criteria,
        },
        orderBy: { createdAt: 'asc' },
      });
    } catch (error) {
      this.handleError(error, 'find channel in section', { sectionId, criteria });
    }
  }
  
  async findLastChannelInSection(sectionId: string): Promise<Channel | null> {
    try {
      this.validateId(sectionId, 'sectionId');
      
      return await this.prisma.channel.findFirst({
        where: { sectionId },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      this.handleError(error, 'find last channel in section', { sectionId });
    }
  }
  
  async findLastChannelInServer(serverId: string): Promise<Channel | null> {
    try {
      this.validateId(serverId, 'serverId');
      
      return await this.prisma.channel.findFirst({
        where: { serverId },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      this.handleError(error, 'find last channel in server', { serverId });
    }
  }
  
  // Channel CRUD
  async createChannelInServer(serverId: string, data: CreateChannelData): Promise<Channel> {
    try {
      this.validateId(serverId, 'serverId');
      
      return await this.prisma.channel.create({
        data: {
          name: data.name,
          type: data.type,
          serverId,
          sectionId: data.sectionId,
        },
      });
    } catch (error) {
      this.handleError(error, 'create channel in server', { serverId, data });
    }
  }
  
  async updateChannel(id: string, data: UpdateChannelData): Promise<Channel> {
    try {
      this.validateId(id, 'channelId');
      
      return await this.prisma.channel.update({
        where: { id },
        data,
      });
    } catch (error) {
      this.handleError(error, 'update channel', { id, data });
    }
  }
  
  async deleteChannel(id: string): Promise<void> {
    try {
      this.validateId(id, 'channelId');
      
      await this.prisma.channel.delete({
        where: { id },
      });
    } catch (error) {
      this.handleError(error, 'delete channel', { id });
    }
  }
  
  // Reordering operations
  async reorderChannelsInSection(sectionId: string, reorderData: ChannelReorderData): Promise<Channel[]> {
    try {
      this.validateId(sectionId, 'sectionId');
      
      return await this.executeTransaction(async (tx) => {
        const updatePromises = reorderData.map((item, index) =>
          tx.channel.update({
            where: { id: item.id },
            data: { position: index },
          })
        );
        
        return await Promise.all(updatePromises);
      });
    } catch (error) {
      this.handleError(error, 'reorder channels in section', { sectionId, reorderData });
    }
  }
}
```

## Acceptance Criteria
- [ ] Implement ServerService with permission checks and CRUD operations
- [ ] Implement ChannelService with access verification and management
- [ ] Add proper transaction handling for complex operations
- [ ] Create comprehensive TypeScript interfaces
- [ ] Include detailed error handling and logging
- [ ] Migrate 10 API routes to use new services

## Files to Create/Modify
- `src/services/database/server-service.ts` (new)
- `src/services/database/channel-service.ts` (new)
- Update `src/services/database/types.ts` with new interfaces
- Migrate these routes first:
  - `src/app/api/servers/route.ts`
  - `src/app/api/servers/[serverId]/route.ts`
  - `src/app/api/servers/ensure-default/route.ts`
  - `src/app/api/channels/route.ts`
  - `src/app/api/channels/[channelId]/route.ts`
  - `src/app/api/channels/reorder/route.ts`

### Documentation Requirements
- [ ] Create server/channel architecture diagram showing access control hierarchy
- [ ] Document role-based access patterns in `docs/features/role-based-access.md`
- [ ] Add server management workflow documentation

### Testing Requirements
- [ ] **Unit Tests**: ServerService and ChannelService methods
- [ ] **Integration Tests**: Server and channel operations with access control
- [ ] **Server Access Tests** (CRITICAL):
  - [ ] **Free User Access**: Test access to public channels only
  - [ ] **Premium User Access**: Test access to premium channels and features
  - [ ] **Admin Access**: Test full server administration capabilities
  - [ ] **Role Assignment**: Test role-based channel access
  - [ ] **Access Revocation**: Test access removal when subscription ends
- [ ] **Channel Permission Tests**: Verify channel-level access control works correctly
- [ ] **Server Hierarchy Tests**: Test section/channel organization and permissions

## Dependencies
- Ticket 1.4 (Base Service Architecture)
- Ticket 2.2 (Profile Service)
- Ticket 1.1 (Logger Consolidation) 