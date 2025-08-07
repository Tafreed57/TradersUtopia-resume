import { BaseDatabaseService } from '../base-service';
import { ServerWithMember } from '../../types';
import { NotFoundError, maskId } from '@/lib/error-handling';

/**
 * ServerAccessService - Handles server access verification and lookups
 *
 * Contains only the server access methods that are actively used in the codebase.
 * Focuses on permission verification and server discovery.
 */
export class ServerAccessService extends BaseDatabaseService {
  private static readonly DEFAULT_SERVER_NAME = 'TradersUtopia HQ';

  /**
   * Fetch the default traders utopia server
   * Used for getting the main server configuration
   */
  async getDefaultServer(): Promise<any> {
    try {
      const server = await this.prisma.server.findFirst({
        where: { name: ServerAccessService.DEFAULT_SERVER_NAME },
        include: {
          channels: true,
        },
      });

      if (!server) {
        throw new NotFoundError('Default server not found');
      }

      return server;
    } catch (error) {
      return this.handleError(error, 'get_default_server', {
        serverName: ServerAccessService.DEFAULT_SERVER_NAME,
      });
    }
  }

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
      });

      if (server) {
        this.logSuccess('server_member_access_verified', {
          serverId: maskId(serverId),
          userId: maskId(userId),
          memberRole: server.members[0]?.role?.name,
        });
      }

      return server as ServerWithMember | null;
    } catch (error) {
      return this.handleError(error, 'find_server_with_member_access', {
        serverId: maskId(serverId),
        userId: maskId(userId),
      });
    }
  }

  /**
   * Get mobile data for server
   * Used for mobile optimized server data
   */
  async getMobileData(serverId: string, userId: string): Promise<any> {
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
              user: {
                select: {
                  id: true,
                  name: true,
                  imageUrl: true,
                  isAdmin: true,
                },
              },
              role: true,
            },
          },
          channels: {
            orderBy: { position: 'asc' },
            select: {
              id: true,
              name: true,
              type: true,
              position: true,
              sectionId: true,
            },
          },
          sections: {
            orderBy: { position: 'asc' },
            include: {
              channels: {
                orderBy: { position: 'asc' },
                select: {
                  id: true,
                  name: true,
                  type: true,
                  position: true,
                },
              },
            },
          },
        },
      });

      if (server) {
        this.logSuccess('server_mobile_data_retrieved', {
          serverId: maskId(serverId),
          userId: maskId(userId),
          channelCount: server.channels.length,
          sectionCount: server.sections.length,
        });
      }

      return server;
    } catch (error) {
      return this.handleError(error, 'get_mobile_data', {
        serverId: maskId(serverId),
        userId: maskId(userId),
      });
    }
  }

  /**
   * List servers for a user
   * Used for getting user's accessible servers
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
        orderBy: {
          createdAt: 'asc',
        },
      });

      this.logSuccess('servers_listed_for_user', {
        userId: maskId(userId),
        serverCount: servers.length,
      });

      return servers as ServerWithMember[];
    } catch (error) {
      return this.handleError(error, 'list_servers_for_user', {
        userId: maskId(userId),
      });
    }
  }
}
