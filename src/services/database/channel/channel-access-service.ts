import { BaseDatabaseService } from '../base-service';
import { Channel, ChannelWithAccess, ChannelAccessResult } from '../../types';
import {
  NotFoundError,
  AuthorizationError,
  maskId,
} from '@/lib/error-handling';

/**
 * ChannelAccessService - Handles channel access verification and permissions
 *
 * Consolidates channel access verification (15+ instances) with comprehensive
 * audit logging for security compliance. Contains only methods actively used.
 */
export class ChannelAccessService extends BaseDatabaseService {
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
        };
      }

      // Step 3: Check if user is server admin or global admin
      const member = channelAccess.server.members[0];
      // Note: Role permissions checking would need to be implemented based on your schema
      const isServerAdmin = member?.role?.name === 'ADMIN' || false;

      const hasAdminAccess = isGlobalAdmin || isServerAdmin;

      this.logSuccess('channel_admin_access_check', {
        channelId: maskId(channelId),
        userId: maskId(userId),
        isGlobalAdmin,
        isServerAdmin,
        hasAdminAccess,
      });

      return {
        hasAccess: hasAdminAccess,
        reason: hasAdminAccess ? undefined : 'Admin privileges required',
        channel: channelAccess,
      };
    } catch (error) {
      return this.handleError(error, 'verify_channel_admin_access', {
        channelId: maskId(channelId),
        userId: maskId(userId),
      });
    }
  }

  /**
   * Find track record channel
   * Used for track record operations
   */
  async findTrackRecordChannel(): Promise<Channel | null> {
    try {
      const channel = await this.prisma.channel.findFirst({
        where: {
          name: 'track-record',
          type: 'TEXT',
        },
      });

      if (channel) {
        this.logSuccess('track_record_channel_found', {
          channelId: maskId(channel.id),
          serverId: maskId(channel.serverId),
        });
      }

      return channel
        ? ({
            ...channel,
            topic: channel.topic ?? undefined,
          } as Channel)
        : null;
    } catch (error) {
      return this.handleError(error, 'find_track_record_channel', {});
    }
  }
}
