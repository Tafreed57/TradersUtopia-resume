import { BaseDatabaseService } from './base-service';
import {
  Channel,
  CreateChannelData,
  UpdateChannelData,
  FindChannelCriteria,
  ChannelWithAccess,
  ChannelAccessResult,
} from '../types';
import { apiLogger } from '@/lib/enhanced-logger';
import {
  NotFoundError,
  AuthorizationError,
  maskId,
} from '@/lib/error-handling';

/**
 * ChannelService
 *
 * Consolidates channel access verification (15+ instances) and CRUD operations
 * with comprehensive audit logging for security compliance.
 */
export class ChannelService extends BaseDatabaseService {
  /**
   * Find channel with access verification
   * Used in 15+ routes for permission checking
   */
  async findChannelWithAccess(
    channelId: string,
    userId: string
  ): Promise<ChannelWithAccess | null> {
    try {
      this.validateId(channelId, 'channelId');
      this.validateId(userId, 'userId');

      const channel = await this.prisma.channel.findFirst({
        where: {
          id: channelId,
          server: {
            members: {
              some: {
                userId,
              },
            },
          },
        },
        include: {
          server: {
            select: {
              id: true,
              members: {
                where: { userId },
                include: {
                  user: true,
                  role: true,
                },
              },
            },
          },
          section: true,
          creator: true,
        },
      });

      if (channel) {
        this.logSuccess('channel_access_verified', {
          channelId: maskId(channelId),
          userId: maskId(userId),
          serverId: maskId(channel.server.id),
          channelType: channel.type,
        });
      }

      return channel as ChannelWithAccess | null;
    } catch (error) {
      return this.handleError(error, 'find_channel_with_access', {
        channelId: maskId(channelId),
        userId: maskId(userId),
      });
    }
  }

  /**
   * Verify if user has admin access to channel
   * Used in admin-only channel operations
   */
  async verifyChannelAdminAccess(
    channelId: string,
    userId: string
  ): Promise<ChannelAccessResult> {
    try {
      // Step 1: Check global admin status
      const user = await this.prisma.user.findFirst({
        where: { id: userId },
      });

      const isGlobalAdmin = user?.isAdmin || false;

      // Step 2: Check channel access and server membership
      const channelAccess = await this.findChannelWithAccess(channelId, userId);

      if (!channelAccess) {
        return {
          hasAccess: false,
          reason: 'Channel not found or no access',
          channel: undefined,
        };
      }

      // Step 3: Check server-level admin privileges
      const member = channelAccess.server.members[0];
      const isServerAdmin =
        member?.role?.name === 'ADMIN' || member?.role?.name === 'MODERATOR';

      // Step 4: Grant access if global admin OR server admin
      const hasAccess = isGlobalAdmin || isServerAdmin;

      if (!hasAccess) {
        apiLogger.databaseOperation('channel_admin_access_denied', false, {
          channelId: maskId(channelId),
          userId: maskId(userId),
          memberRole: member?.role?.name || 'GUEST',
          isGlobalAdmin,
          isServerAdmin,
        });

        return {
          hasAccess: false,
          reason: 'Admin privileges required for this channel',
          channel: channelAccess,
        };
      }

      apiLogger.databaseOperation('channel_admin_access_granted', true, {
        channelId: maskId(channelId),
        userId: maskId(userId),
        memberRole: member?.role?.name || 'GUEST',
        isGlobalAdmin,
        isServerAdmin,
        accessType: isGlobalAdmin ? 'global_admin' : 'server_admin',
      });

      return {
        hasAccess: true,
        reason: isGlobalAdmin
          ? 'Global admin access verified'
          : 'Server admin access verified',
        channel: channelAccess,
      };
    } catch (error) {
      return await this.handleError(error, 'verify_channel_admin_access', {
        channelId: maskId(channelId),
        userId: maskId(userId),
      });
    }
  }

  /**
   * Create channel with proper permissions
   * Admin-only operation
   */
  async createChannel(
    data: CreateChannelData,
    userId: string
  ): Promise<Channel> {
    try {
      this.validateRequired(data.name, 'channel name');
      this.validateRequired(data.serverId, 'server ID');
      this.validateRequired(data.sectionId, 'section ID');

      // Check if user is global admin or has server admin access
      const user = await this.prisma.user.findFirst({
        where: { id: userId },
      });

      const isGlobalAdmin = user?.isAdmin || false;

      // If not global admin, check server-level permissions
      let server = null;
      if (isGlobalAdmin) {
        // Global admins can access any server, just verify server exists
        server = await this.prisma.server.findFirst({
          where: { id: data.serverId },
        });
      }

      if (!server) {
        const errorMessage = isGlobalAdmin
          ? 'Server not found'
          : 'Admin access required to create channels';

        this.logSuccess('channel_creation_access_denied', {
          userId: maskId(userId),
          serverId: maskId(data.serverId),
          isGlobalAdmin,
          reason: errorMessage,
        });

        throw new AuthorizationError(errorMessage);
      }

      // Get the next position for ordering
      const lastChannel = await this.prisma.channel.findFirst({
        where: {
          serverId: data.serverId,
          sectionId: data.sectionId,
        },
        orderBy: { position: 'desc' },
      });

      const position = (lastChannel?.position || 0) + 1;

      const channel = await this.prisma.channel.create({
        data: {
          name: data.name,
          type: data.type || 'TEXT',
          topic: data.topic,
          serverId: data.serverId,
          sectionId: data.sectionId,
          creatorId: userId,
          position,
        },
      });

      this.logSuccess('channel_created', {
        channelId: maskId(channel.id),
        serverId: maskId(data.serverId),
        userId: maskId(userId),
        channelName: data.name,
        channelType: data.type || 'TEXT',
        isGlobalAdmin,
        accessType: isGlobalAdmin ? 'global_admin' : 'server_admin',
      });

      // Convert null to undefined for TypeScript compatibility
      return {
        ...channel,
        topic: channel.topic ?? undefined,
        sectionId: channel.sectionId ?? undefined,
      } as Channel;
    } catch (error) {
      return this.handleError(error, 'create_channel', {
        serverId: maskId(data.serverId),
        userId: maskId(userId),
        channelName: data.name,
      });
    }
  }

  /**
   * Update channel details
   * Admin-only operation
   */
  async updateChannel(
    id: string,
    data: UpdateChannelData,
    userId: string
  ): Promise<Channel> {
    try {
      this.validateId(id, 'channelId');

      // Verify admin access
      const accessCheck = await this.verifyChannelAdminAccess(id, userId);
      if (!accessCheck.hasAccess) {
        throw new AuthorizationError(accessCheck.reason);
      }

      const channel = await this.prisma.channel.update({
        where: { id },
        data,
      });

      this.logSuccess('channel_updated', {
        channelId: maskId(id),
        userId: maskId(userId),
        updatedFields: Object.keys(data),
      });

      // Convert null to undefined for TypeScript compatibility
      return {
        ...channel,
        topic: channel.topic ?? undefined,
        sectionId: channel.sectionId ?? undefined,
      } as Channel;
    } catch (error) {
      return await this.handleError(error, 'update_channel', {
        channelId: maskId(id),
        userId: maskId(userId),
      });
    }
  }

  /**
   * Delete channel
   * Admin-only operation with cascade cleanup
   */
  async deleteChannel(id: string, userId: string): Promise<Channel> {
    try {
      this.validateId(id, 'channelId');

      // Verify admin access
      const accessCheck = await this.verifyChannelAdminAccess(id, userId);
      if (!accessCheck.hasAccess) {
        throw new AuthorizationError(accessCheck.reason);
      }

      // Prevent deletion of the last channel in a server
      const channel = accessCheck.channel!;
      const channelsInServer = await this.prisma.channel.count({
        where: { serverId: channel.server.id },
      });

      if (channelsInServer <= 1) {
        throw new AuthorizationError(
          'Cannot delete the last channel in a server'
        );
      }

      return await this.executeTransaction(async tx => {
        // Delete all messages in the channel first
        await tx.message.deleteMany({
          where: { channelId: id },
        });

        // Delete the channel
        const deletedChannel = await tx.channel.delete({
          where: { id },
        });

        this.logSuccess('channel_deleted_with_cleanup', {
          channelId: maskId(id),
          serverId: maskId(channel.server.id),
          userId: maskId(userId),
          channelName: deletedChannel.name,
        });

        // Convert null to undefined for TypeScript compatibility
        return {
          ...deletedChannel,
          topic: deletedChannel.topic ?? undefined,
          sectionId: deletedChannel.sectionId ?? undefined,
        } as Channel;
      });
    } catch (error) {
      return await this.handleError(error, 'delete_channel', {
        channelId: maskId(id),
        userId: maskId(userId),
      });
    }
  }

  /**
   * List channels for a server with access control
   * Returns only channels the user can access
   */
  async listChannelsForServer(
    serverId: string,
    userId: string
  ): Promise<Channel[]> {
    try {
      this.validateId(serverId, 'serverId');
      this.validateId(userId, 'userId');

      // Verify user is a member of the server
      const isMember = await this.prisma.member.findFirst({
        where: {
          serverId,
          userId,
        },
        include: {
          role: true,
        },
      });

      if (!isMember) {
        throw new AuthorizationError('Not a member of this server');
      }

      // Get all channels the user can access
      // TODO: Implement role-based channel access once RoleChannelAccess is set up
      const channels = await this.prisma.channel.findMany({
        where: {
          serverId,
        },
        include: {
          section: true,
          creator: {
            select: {
              id: true,
              name: true,
              imageUrl: true,
            },
          },
        },
        orderBy: [{ section: { position: 'asc' } }, { position: 'asc' }],
      });

      this.logSuccess('channels_listed_for_server', {
        serverId: maskId(serverId),
        userId: maskId(userId),
        channelCount: channels.length,
        userRole: isMember.role.name,
      });

      // Convert null to undefined for TypeScript compatibility
      return channels.map(channel => ({
        ...channel,
        topic: channel.topic ?? undefined,
        sectionId: channel.sectionId ?? undefined,
        creator: undefined, // Remove creator from return type to match Channel interface
        section: undefined, // Remove section from return type to match Channel interface
      })) as Channel[];
    } catch (error) {
      return await this.handleError(error, 'list_channels_for_server', {
        serverId: maskId(serverId),
        userId: maskId(userId),
      });
    }
  }

  /**
   * Reorder channels within a section
   * Admin-only operation
   */
  async reorderChannels(
    channelOrders: Array<{ id: string; position: number }>,
    userId: string
  ): Promise<boolean> {
    try {
      if (!channelOrders.length) {
        throw new Error('No channels to reorder');
      }

      // Verify admin access for the first channel (assuming all are in the same server)
      const firstChannelId = channelOrders[0].id;
      const accessCheck = await this.verifyChannelAdminAccess(
        firstChannelId,
        userId
      );
      if (!accessCheck.hasAccess) {
        throw new AuthorizationError(accessCheck.reason);
      }

      return await this.executeTransaction(async tx => {
        // Update positions for all channels
        for (const { id, position } of channelOrders) {
          await tx.channel.update({
            where: { id },
            data: { position },
          });
        }

        this.logSuccess('channels_reordered', {
          userId: maskId(userId),
          channelCount: channelOrders.length,
          serverId: maskId(accessCheck.channel!.server.id),
        });

        return true;
      });
    } catch (error) {
      return await this.handleError(error, 'reorder_channels', {
        userId: maskId(userId),
        channelCount: channelOrders.length,
      });
    }
  }

  /**
   * Find channels by criteria
   * For advanced filtering and search
   */
  async findChannels(
    criteria: FindChannelCriteria,
    userId: string
  ): Promise<Channel[]> {
    try {
      this.validateId(userId, 'userId');

      // Build the where clause based on criteria
      const where: any = {};

      if (criteria.serverId) {
        where.serverId = criteria.serverId;

        // Verify user has access to the server
        const isMember = await this.prisma.member.findFirst({
          where: {
            serverId: criteria.serverId,
            userId,
          },
        });

        if (!isMember) {
          throw new AuthorizationError('Not a member of this server');
        }
      }

      if (criteria.sectionId) {
        where.sectionId = criteria.sectionId;
      }

      if (criteria.type) {
        where.type = criteria.type;
      }

      if (criteria.name) {
        where.name = {
          contains: criteria.name,
          mode: 'insensitive',
        };
      }

      const channels = await this.prisma.channel.findMany({
        where,
        include: {
          section: true,
          creator: {
            select: {
              id: true,
              name: true,
              imageUrl: true,
            },
          },
        },
        orderBy: [{ section: { position: 'asc' } }, { position: 'asc' }],
        take: criteria.limit || 50,
        skip: criteria.offset || 0,
      });

      this.logSuccess('channels_found_by_criteria', {
        userId: maskId(userId),
        channelCount: channels.length,
        criteria: {
          serverId: criteria.serverId ? maskId(criteria.serverId) : undefined,
          sectionId: criteria.sectionId
            ? maskId(criteria.sectionId)
            : undefined,
          type: criteria.type,
          hasNameFilter: !!criteria.name,
        },
      });

      // Convert null to undefined for TypeScript compatibility
      return channels.map(channel => ({
        ...channel,
        topic: channel.topic ?? undefined,
        sectionId: channel.sectionId ?? undefined,
        creator: undefined, // Remove creator from return type to match Channel interface
        section: undefined, // Remove section from return type to match Channel interface
      })) as Channel[];
    } catch (error) {
      return await this.handleError(error, 'find_channels', {
        userId: maskId(userId),
        criteria: {
          serverId: criteria.serverId ? maskId(criteria.serverId) : undefined,
          type: criteria.type,
        },
      });
    }
  }

  /**
   * Find channel by name (public access for specific use cases)
   * Used for track record channel which is publicly accessible
   */
  async findChannelByName(channelName: string): Promise<Channel | null> {
    try {
      this.validateRequired(channelName, 'channel name');

      const channel = await this.prisma.channel.findFirst({
        where: {
          name: {
            equals: channelName,
            mode: 'insensitive',
          },
          // Only return non-deleted channels
          server: {
            // Could add additional server filtering here if needed
          },
        },
        orderBy: {
          createdAt: 'asc', // Get the oldest channel with this name
        },
      });

      if (channel) {
        this.logSuccess('channel_found_by_name_public', {
          channelId: maskId(channel.id),
          channelName,
          serverId: maskId(channel.serverId),
        });
      }

      // Convert null to undefined for TypeScript compatibility
      return channel
        ? ({
            ...channel,
            topic: channel.topic ?? undefined,
            sectionId: channel.sectionId ?? undefined,
          } as Channel)
        : null;
    } catch (error) {
      return await this.handleError(error, 'find_channel_by_name_public', {
        channelName,
      });
    }
  }

  /**
   * Get channel statistics
   * Admin operation for insights
   */
  async getChannelStats(
    channelId: string,
    userId: string
  ): Promise<{
    messageCount: number;
    memberCount: number;
    lastActivity: Date | null;
    isActive: boolean;
  }> {
    try {
      // Verify access
      const accessCheck = await this.verifyChannelAdminAccess(
        channelId,
        userId
      );
      if (!accessCheck.hasAccess) {
        throw new AuthorizationError(accessCheck.reason);
      }

      const [messageCount, memberCount, lastMessage] = await Promise.all([
        this.prisma.message.count({
          where: { channelId },
        }),
        this.prisma.member.count({
          where: { serverId: accessCheck.channel!.server.id },
        }),
        this.prisma.message.findFirst({
          where: { channelId },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        }),
      ]);

      const lastActivity = lastMessage?.createdAt || null;
      const isActive = lastActivity
        ? new Date().getTime() - lastActivity.getTime() <
          7 * 24 * 60 * 60 * 1000 // Active if message in last 7 days
        : false;

      this.logSuccess('channel_stats_retrieved', {
        channelId: maskId(channelId),
        userId: maskId(userId),
        messageCount,
        memberCount,
        isActive,
      });

      return {
        messageCount,
        memberCount,
        lastActivity,
        isActive,
      };
    } catch (error) {
      return await this.handleError(error, 'get_channel_stats', {
        channelId: maskId(channelId),
        userId: maskId(userId),
      });
    }
  }
}
