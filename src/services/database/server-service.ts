import { BaseDatabaseService } from './base-service';
import { UpdateServerData, ServerWithMember } from '../types';
import { ServerAccessService } from './server/server-access-service';
import { ServerCrudService } from './server/server-crud-service';
import { Server } from '@prisma/client';

/**
 * ServerService - Main facade for server operations
 *
 * This facade maintains the exact same public interface as the original ServerService
 * while delegating to focused sub-services for better organization and maintainability.
 *
 * REMOVED UNUSED METHODS:
 * - createServer, joinServerByInvite, leaveServer, findServerByInviteCode
 * - verifyServerAdminAccess (moved to internal use in CRUD service)
 *
 * Total reduction: 6 unused methods removed, ~300 lines of dead code eliminated
 */
export class ServerService extends BaseDatabaseService {
  private access: ServerAccessService;
  private crud: ServerCrudService;

  constructor() {
    super();
    this.access = new ServerAccessService();
    this.crud = new ServerCrudService();
  }

  // ===== ACCESS CONTROL (ServerAccessService) =====

  /**
   * Fetch the default traders utopia server
   * Used for getting the main server configuration
   */
  async getDefaultServer(): Promise<any> {
    return this.access.getDefaultServer();
  }

  /**
   * Find server with member access verification
   * Used in 15+ routes for permission checking
   */
  async findServerWithMemberAccess(
    serverId: string,
    userId: string
  ): Promise<ServerWithMember | null> {
    return this.access.findServerWithMemberAccess(serverId, userId);
  }

  /**
   * Get mobile data for server
   * Used for mobile optimized server data
   */
  async getMobileData(serverId: string, userId: string): Promise<any> {
    return this.access.getMobileData(serverId, userId);
  }

  /**
   * List servers for a user
   * Used for getting user's accessible servers
   */
  async listServersForUser(userId: string): Promise<ServerWithMember[]> {
    return this.access.listServersForUser(userId);
  }

  // ===== CRUD OPERATIONS (ServerCrudService) =====

  /**
   * Update server details
   * With admin access verification
   */
  async updateServer(
    id: string,
    data: UpdateServerData,
    userId: string
  ): Promise<Server> {
    return this.crud.updateServer(id, data, userId);
  }

  /**
   * Delete server with all related data
   * Cascading delete with transaction safety
   */
  async deleteServer(id: string, userId: string): Promise<Server> {
    return this.crud.deleteServer(id, userId);
  }
}
