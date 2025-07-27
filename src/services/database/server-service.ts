import { BaseDatabaseService } from './base-service';
import {
  Server,
  CreateServerData,
  UpdateServerData,
  ServerWithMember,
  ServerWithDetails,
  AccessControlCheck,
  ServerAccessResult,
} from '../types';
import { apiLogger } from '@/lib/enhanced-logger';
import {
  NotFoundError,
  AuthorizationError,
  maskId,
} from '@/lib/error-handling';
import { nanoid } from 'nanoid';

/**
 * ServerService
 *
 * Consolidates server permission checks (20+ instances) and CRUD operations
 * with comprehensive audit logging for security compliance.
 */
export class ServerService extends BaseDatabaseService {
  /**
   * Find server with member access verification
   * Used in 15+ routes for permission checking
   */
  async findServerWithMemberAccess(
    serverId: string,
    userId: string
  ): Promise<ServerWithMember | null> {
    try {
      this.validateId(serverId, 'serverId');
      this.validateId(userId, 'userId');

      const server = await this.prisma.server.findFirst({
        where: {
          id: serverId,
          members: {
            some: {
              userId,
            },
          },
        },
        include: {
          members: {
            where: { userId },
            include: {
              user: true,
              role: true,
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

      if (server) {
        this.logSuccess('server_member_access_verified', {
          serverId: maskId(serverId),
          userId: maskId(userId),
          memberRole: server.members[0]?.role?.name,
        });
      }

      return server as ServerWithMember;
    } catch (error) {
      return await this.handleError(error, 'find_server_with_member_access', {
        serverId: maskId(serverId),
        userId: maskId(userId),
      });
    }
  }

  /**
   * Verify if user has admin access to server
   * Used in 10+ admin-only operations
   */
  async verifyServerAdminAccess(
    serverId: string,
    userId: string
  ): Promise<ServerAccessResult> {
    try {
      const serverAccess = await this.findServerWithMemberAccess(
        serverId,
        userId
      );

      if (!serverAccess) {
        return {
          hasAccess: false,
          reason: 'Not a member of this server',
          server: undefined,
        };
      }

      const member = serverAccess.members[0];
      const isAdmin =
        member?.role?.name === 'ADMIN' || member?.role?.name === 'MODERATOR';

      if (!isAdmin) {
        apiLogger.databaseOperation('server_admin_access_denied', false, {
          serverId: maskId(serverId),
          userId: maskId(userId),
          memberRole: member?.role?.name || 'GUEST',
        });

        return {
          hasAccess: false,
          reason: 'Admin privileges required',
          server: serverAccess,
        };
      }

      apiLogger.databaseOperation('server_admin_access_granted', true, {
        serverId: maskId(serverId),
        userId: maskId(userId),
        memberRole: member.role.name,
      });

      return {
        hasAccess: true,
        reason: 'Admin access verified',
        server: serverAccess,
      };
    } catch (error) {
      return await this.handleError(error, 'verify_server_admin_access', {
        serverId: maskId(serverId),
        userId: maskId(userId),
      });
    }
  }

  /**
   * Create server with default setup
   * Includes default section, channel, and admin member
   */
  async createServer(data: CreateServerData): Promise<Server> {
    try {
      this.validateRequired(data.name, 'server name');
      this.validateRequired(data.ownerId, 'owner ID');

      return await this.executeTransaction(async tx => {
        // Generate unique invite code
        const inviteCode = data.inviteCode || nanoid(10);

        // Create the server
        const server = await tx.server.create({
          data: {
            name: data.name,
            imageUrl: data.imageUrl || '',
            inviteCode,
            ownerId: data.ownerId,
          },
        });

        // Create admin role for this server
        const adminRole = await tx.role.create({
          data: {
            name: 'ADMIN',
            color: '#FF0000',
            isDefault: false,
            serverId: server.id,
            creatorId: data.ownerId,
          },
        });

        // Create member role for this server
        const memberRole = await tx.role.create({
          data: {
            name: 'MEMBER',
            color: '#99AAB5',
            isDefault: true,
            serverId: server.id,
            creatorId: data.ownerId,
          },
        });

        // Create default member for creator with admin role
        await tx.member.create({
          data: {
            userId: data.ownerId,
            serverId: server.id,
            roleId: adminRole.id,
          },
        });

        // Create default section
        const defaultSection = await tx.section.create({
          data: {
            name: 'General',
            serverId: server.id,
            creatorId: data.ownerId,
            position: 0,
          },
        });

        // Create default channel
        await tx.channel.create({
          data: {
            name: 'general',
            type: 'TEXT',
            serverId: server.id,
            sectionId: defaultSection.id,
            creatorId: data.ownerId,
            position: 0,
          },
        });

        this.logSuccess('server_created_with_defaults', {
          serverId: maskId(server.id),
          ownerId: maskId(data.ownerId),
          serverName: data.name,
        });

        // Convert null to undefined for imageUrl to match Server type
        return {
          ...server,
          imageUrl: server.imageUrl || undefined,
        } as Server;
      });
    } catch (error) {
      return await this.handleError(error, 'create_server', {
        ownerId: maskId(data.ownerId),
        serverName: data.name,
      });
    }
  }

  /**
   * Update server details
   * With admin access verification
   */
  async updateServer(
    id: string,
    data: UpdateServerData,
    userId: string
  ): Promise<Server> {
    try {
      this.validateId(id, 'serverId');

      // Verify admin access
      const accessCheck = await this.verifyServerAdminAccess(id, userId);
      if (!accessCheck.hasAccess) {
        throw new AuthorizationError(accessCheck.reason);
      }

      const server = await this.prisma.server.update({
        where: { id },
        data,
      });

      this.logSuccess('server_updated', {
        serverId: maskId(id),
        userId: maskId(userId),
        updatedFields: Object.keys(data),
      });

      // Convert null to undefined for imageUrl to match Server type
      return {
        ...server,
        imageUrl: server.imageUrl || undefined,
      } as Server;
    } catch (error) {
      return await this.handleError(error, 'update_server', {
        serverId: maskId(id),
        userId: maskId(userId),
      });
    }
  }

  /**
   * Delete server with all related data
   * Cascading delete with transaction safety
   */
  async deleteServer(id: string, userId: string): Promise<Server> {
    try {
      this.validateId(id, 'serverId');

      // Verify owner access (only server owner can delete)
      const server = await this.prisma.server.findFirst({
        where: {
          id,
          ownerId: userId,
        },
      });

      if (!server) {
        throw new NotFoundError('Server not found or insufficient permissions');
      }

      return await this.executeTransaction(async tx => {
        // Delete in correct order to handle foreign key constraints
        // Note: Most cascading should be handled by Prisma schema, but we're explicit here
        await tx.message.deleteMany({ where: { channel: { serverId: id } } });
        await tx.channel.deleteMany({ where: { serverId: id } });
        await tx.section.deleteMany({ where: { serverId: id } });
        await tx.member.deleteMany({ where: { serverId: id } });
        await tx.role.deleteMany({ where: { serverId: id } });

        const deletedServer = await tx.server.delete({
          where: { id },
        });

        this.logSuccess('server_deleted_with_cascade', {
          serverId: maskId(id),
          userId: maskId(userId),
          serverName: deletedServer.name,
        });

        // Convert null to undefined for imageUrl to match Server type
        return {
          ...deletedServer,
          imageUrl: deletedServer.imageUrl || undefined,
        } as Server;
      });
    } catch (error) {
      return await this.handleError(error, 'delete_server', {
        serverId: maskId(id),
        userId: maskId(userId),
      });
    }
  }

  /**
   * Find server by invite code
   * Used for join operations
   */
  async findServerByInviteCode(inviteCode: string): Promise<Server | null> {
    try {
      this.validateRequired(inviteCode, 'invite code');

      const server = await this.prisma.server.findFirst({
        where: { inviteCode },
        include: {
          members: {
            include: {
              user: true,
            },
          },
        },
      });

      if (!server) {
        return null;
      }

      // Convert null to undefined for imageUrl to match Server type
      return {
        ...server,
        imageUrl: server.imageUrl || undefined,
      } as Server;
    } catch (error) {
      return await this.handleError(error, 'find_server_by_invite_code', {
        inviteCode: inviteCode.substring(0, 3) + '***',
      });
    }
  }

  /**
   * Join server via invite code
   * Creates member relationship
   */
  async joinServerByInvite(
    inviteCode: string,
    userId: string
  ): Promise<ServerWithMember> {
    try {
      const server = await this.findServerByInviteCode(inviteCode);

      if (!server) {
        throw new NotFoundError('Invalid invite code');
      }

      // Check if already a member
      const existingMember = await this.prisma.member.findFirst({
        where: {
          serverId: server.id,
          userId,
        },
      });

      if (existingMember) {
        // Return the server with existing membership
        return (await this.findServerWithMemberAccess(
          server.id,
          userId
        )) as ServerWithMember;
      }

      // Get default member role
      const defaultRole = await this.prisma.role.findFirst({
        where: {
          serverId: server.id,
          isDefault: true,
        },
      });

      if (!defaultRole) {
        throw new NotFoundError('Server configuration error: no default role');
      }

      return await this.executeTransaction(async tx => {
        // Create new member
        await tx.member.create({
          data: {
            userId,
            serverId: server.id,
            roleId: defaultRole.id,
          },
        });

        this.logSuccess('server_joined_via_invite', {
          serverId: maskId(server.id),
          userId: maskId(userId),
          inviteCode: inviteCode.substring(0, 3) + '***',
        });

        // Return server with new member access
        return (await this.findServerWithMemberAccess(
          server.id,
          userId
        )) as ServerWithMember;
      });
    } catch (error) {
      return await this.handleError(error, 'join_server_by_invite', {
        inviteCode: inviteCode.substring(0, 3) + '***',
        userId: maskId(userId),
      });
    }
  }

  /**
   * Leave server
   * Removes member relationship
   */
  async leaveServer(serverId: string, userId: string): Promise<boolean> {
    try {
      this.validateId(serverId, 'serverId');
      this.validateId(userId, 'userId');

      // Prevent server owner from leaving
      const server = await this.prisma.server.findFirst({
        where: { id: serverId },
      });

      if (server?.ownerId === userId) {
        throw new AuthorizationError(
          'Server owner cannot leave server. Transfer ownership or delete the server instead.'
        );
      }

      const member = await this.prisma.member.findFirst({
        where: {
          serverId,
          userId,
        },
      });

      if (!member) {
        throw new NotFoundError('Not a member of this server');
      }

      await this.prisma.member.delete({
        where: { id: member.id },
      });

      this.logSuccess('server_left', {
        serverId: maskId(serverId),
        userId: maskId(userId),
      });

      return true;
    } catch (error) {
      return await this.handleError(error, 'leave_server', {
        serverId: maskId(serverId),
        userId: maskId(userId),
      });
    }
  }

  /**
   * Generate new invite code
   * Admin operation
   */
  async generateNewInviteCode(
    serverId: string,
    userId: string
  ): Promise<string> {
    try {
      // Verify admin access
      const accessCheck = await this.verifyServerAdminAccess(serverId, userId);
      if (!accessCheck.hasAccess) {
        throw new AuthorizationError(accessCheck.reason);
      }

      const newInviteCode = nanoid(10);

      await this.prisma.server.update({
        where: { id: serverId },
        data: { inviteCode: newInviteCode },
      });

      this.logSuccess('server_invite_code_regenerated', {
        serverId: maskId(serverId),
        userId: maskId(userId),
      });

      return newInviteCode;
    } catch (error) {
      return await this.handleError(error, 'generate_new_invite_code', {
        serverId: maskId(serverId),
        userId: maskId(userId),
      });
    }
  }

  /**
   * List servers for a user
   * With member information
   */
  async listServersForUser(userId: string): Promise<ServerWithMember[]> {
    try {
      this.validateId(userId, 'userId');

      const servers = await this.prisma.server.findMany({
        where: {
          members: {
            some: {
              userId,
            },
          },
        },
        include: {
          members: {
            where: { userId },
            include: {
              user: true,
              role: true,
            },
          },
          channels: {
            orderBy: { position: 'asc' },
          },
          sections: {
            orderBy: { position: 'asc' },
            include: {
              channels: {
                orderBy: { position: 'asc' },
              },
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      this.logSuccess('servers_listed_for_user', {
        userId: maskId(userId),
        serverCount: servers.length,
      });

      // Convert the results to match ServerWithMember type
      return servers.map(server => ({
        ...server,
        imageUrl: server.imageUrl || undefined,
      })) as ServerWithMember[];
    } catch (error) {
      return await this.handleError(error, 'list_servers_for_user', {
        userId: maskId(userId),
      });
    }
  }

  /**
   * Get optimized mobile data for a server
   * Includes conditional requests with If-Modified-Since support
   */
  async getMobileData(
    serverId: string,
    userId: string,
    ifModifiedSince?: string
  ): Promise<{
    data?: any;
    notModified?: boolean;
    lastModified: string;
  }> {
    try {
      this.validateId(serverId, 'serverId');
      this.validateId(userId, 'userId');

      // Check if user is a member of this server
      const member = await this.prisma.member.findFirst({
        where: {
          serverId,
          userId,
        },
      });

      if (!member) {
        throw new AuthorizationError(
          'Access denied - not a member of this server'
        );
      }

      // Get the latest modification time for this server
      const serverModified = await this.prisma.server.findUnique({
        where: { id: serverId },
        select: {
          updatedAt: true,
        },
      });

      if (!serverModified) {
        throw new NotFoundError('Server not found');
      }

      const lastModifiedTime = serverModified.updatedAt.toISOString();

      // Check if client has the latest version
      if (ifModifiedSince && ifModifiedSince === lastModifiedTime) {
        apiLogger.databaseOperation('mobile_data_not_modified', true, {
          serverId: maskId(serverId),
          userId: maskId(userId),
          lastModified: lastModifiedTime,
        });

        return {
          notModified: true,
          lastModified: lastModifiedTime,
        };
      }

      // Fetch comprehensive server data with sections and channels
      const server = await this.prisma.server.findUnique({
        where: { id: serverId },
        include: {
          sections: {
            include: {
              channels: {
                orderBy: { position: 'asc' },
              },
              children: {
                include: {
                  channels: {
                    orderBy: { position: 'asc' },
                  },
                },
                orderBy: { position: 'asc' },
              },
            },
            orderBy: { position: 'asc' },
          },
          channels: {
            where: { sectionId: null },
            orderBy: { position: 'asc' },
          },
          members: {
            include: {
              user: true,
              role: true,
            },
            orderBy: {
              role: {
                name: 'asc',
              },
            },
          },
        },
      });

      if (!server) {
        throw new NotFoundError('Server not found');
      }

      // Build nested section structure for mobile optimization
      const buildSectionTree = (
        sections: any[],
        parentId: string | null = null
      ): any[] => {
        return sections
          .filter(section => section.parentId === parentId)
          .map(section => ({
            ...section,
            children: buildSectionTree(sections, section.id),
          }));
      };

      const sectionsWithChannels = buildSectionTree(server.sections);

      // Return the structured data optimized for mobile consumption
      const mobileData = {
        server: {
          id: server.id,
          name: server.name,
          imageUrl: server.imageUrl,
          inviteCode: server.inviteCode,
        },
        sections: sectionsWithChannels,
        channels: server.channels, // Channels not in any section
        members: server.members,
        lastModified: lastModifiedTime,
      };

      apiLogger.databaseOperation('mobile_data_retrieved', true, {
        serverId: maskId(serverId),
        userId: maskId(userId),
        sectionCount: sectionsWithChannels.length,
        channelCount: server.channels.length,
        memberCount: server.members.length,
        lastModified: lastModifiedTime,
      });

      return {
        data: mobileData,
        lastModified: lastModifiedTime,
      };
    } catch (error) {
      throw this.handleError(error, 'Failed to retrieve mobile data', {
        serverId: maskId(serverId),
        userId: maskId(userId),
      });
    }
  }
}
