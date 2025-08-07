import { BaseDatabaseService } from '../base-service';
import { UpdateServerData, ServerAccessResult } from '../../types';
import {
  NotFoundError,
  AuthorizationError,
  maskId,
} from '@/lib/error-handling';
import { Server } from '@prisma/client';

/**
 * ServerCrudService - Handles server CRUD operations
 *
 * Contains only the server update and delete operations that are actively used.
 * Focuses on data persistence with proper permission checks.
 */
export class ServerCrudService extends BaseDatabaseService {
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
   * Verify if user has admin access to server
   * Used internally by update/delete operations
   */
  private async verifyServerAdminAccess(
    serverId: string,
    userId: string
  ): Promise<ServerAccessResult> {
    try {
      // Step 1: Check global admin status
      const user = await this.prisma.user.findFirst({
        where: { id: userId },
      });

      const isGlobalAdmin = user?.isAdmin || false;

      // Step 2: Check server ownership or membership
      const server = await this.prisma.server.findFirst({
        where: {
          id: serverId,
          OR: [
            { ownerId: userId }, // Server owner
            {
              members: {
                some: {
                  userId,
                  role: {
                    name: 'ADMIN',
                  },
                },
              },
            }, // Server admin member
          ],
        },
      });

      const hasAccess = isGlobalAdmin || !!server;

      this.logSuccess('server_admin_access_check', {
        serverId: maskId(serverId),
        userId: maskId(userId),
        hasAccess,
        isGlobalAdmin,
        isServerOwner: server?.ownerId === userId,
      });

      return {
        hasAccess,
        reason: hasAccess ? undefined : 'Admin privileges required',
        server: server as any,
      };
    } catch (error) {
      return this.handleError(error, 'verify_server_admin_access', {
        serverId: maskId(serverId),
        userId: maskId(userId),
      });
    }
  }
}
