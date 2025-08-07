import { BaseDatabaseService } from '../base-service';
import { Channel, CreateChannelData, UpdateChannelData } from '../../types';
import {
  NotFoundError,
  AuthorizationError,
  maskId,
} from '@/lib/error-handling';

/**
 * ChannelCrudService - Handles channel CRUD operations
 *
 * Contains only the channel create, update, and delete operations that are actively used.
 * Focuses on data persistence with proper permission checks.
 */
export class ChannelCrudService extends BaseDatabaseService {
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
   * Update channel data
   * Admin-only operation with access verification
   */
  async updateChannel(
    id: string,
    data: UpdateChannelData,
    userId: string
  ): Promise<Channel> {
    try {
      this.validateId(id, 'channelId');

      // Verify admin access to the channel
      const user = await this.prisma.user.findFirst({
        where: { id: userId },
      });

      const isGlobalAdmin = user?.isAdmin || false;

      if (!isGlobalAdmin) {
        throw new AuthorizationError(
          'Admin access required to update channels'
        );
      }

      // Check if channel exists
      const existingChannel = await this.prisma.channel.findFirst({
        where: { id },
      });

      if (!existingChannel) {
        throw new NotFoundError('Channel not found');
      }

      const channel = await this.prisma.channel.update({
        where: { id },
        data: {
          ...(data.name && { name: data.name }),
          ...(data.topic !== undefined && { topic: data.topic }),
        },
      });

      this.logSuccess('channel_updated', {
        channelId: maskId(id),
        userId: maskId(userId),
        updatedFields: Object.keys(data),
        isGlobalAdmin,
      });

      return {
        ...channel,
        topic: channel.topic ?? undefined,
        sectionId: channel.sectionId ?? undefined,
      } as Channel;
    } catch (error) {
      return this.handleError(error, 'update_channel', {
        channelId: maskId(id),
        userId: maskId(userId),
        updateData: Object.keys(data),
      });
    }
  }

  /**
   * Delete channel
   * Admin-only operation with cascade handling
   */
  async deleteChannel(id: string, userId: string): Promise<Channel> {
    try {
      this.validateId(id, 'channelId');

      // Verify admin access
      const user = await this.prisma.user.findFirst({
        where: { id: userId },
      });

      const isGlobalAdmin = user?.isAdmin || false;

      if (!isGlobalAdmin) {
        throw new AuthorizationError(
          'Admin access required to delete channels'
        );
      }

      // Get channel before deletion for logging
      const channel = await this.prisma.channel.findFirst({
        where: { id },
      });

      if (!channel) {
        throw new NotFoundError('Channel not found');
      }

      // Execute deletion in transaction
      const deletedChannel = await this.executeTransaction(async tx => {
        // 1. Soft delete all messages in the channel
        await tx.message.updateMany({
          where: { channelId: id },
          data: {
            deleted: true,
            content: '[Channel Deleted]',
          },
        });

        // 2. Delete channel notification preferences
        await tx.channelNotificationPreference.deleteMany({
          where: { channelId: id },
        });

        // 3. Delete the channel
        return await tx.channel.delete({
          where: { id },
        });
      });

      this.logSuccess('channel_deleted', {
        channelId: maskId(id),
        userId: maskId(userId),
        channelName: channel.name,
        serverId: maskId(channel.serverId),
        isGlobalAdmin,
        cascadeDeleted: true,
      });

      return {
        ...deletedChannel,
        topic: deletedChannel.topic ?? undefined,
        sectionId: deletedChannel.sectionId ?? undefined,
      } as Channel;
    } catch (error) {
      return this.handleError(error, 'delete_channel', {
        channelId: maskId(id),
        userId: maskId(userId),
      });
    }
  }
}
