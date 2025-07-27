import { BaseDatabaseService } from './base-service';
import { Member, User } from '../types';
import { apiLogger } from '@/lib/enhanced-logger';
import {
  NotFoundError,
  AuthorizationError,
  ValidationError,
  maskId,
} from '@/lib/error-handling';

/**
 * MemberService
 *
 * Consolidates member operations including role management, server membership verification,
 * and member administration. Handles the complex relationships between users, servers, and roles.
 */
export class MemberService extends BaseDatabaseService {
  /**
   * Find member by ID with server and user details
   */
  async findMemberById(
    memberId: string
  ): Promise<(Member & { user: User; server: any; role: any }) | null> {
    try {
      this.validateId(memberId, 'memberId');

      const member = await this.prisma.member.findFirst({
        where: { id: memberId },
        include: {
          user: true,
          server: true,
          role: true,
        },
      });

      if (member) {
        this.logSuccess('member_found_by_id', {
          memberId: maskId(memberId),
          userId: maskId(member.userId),
          serverId: maskId(member.serverId),
        });
      }

      return member as any;
    } catch (error) {
      return await this.handleError(error, 'find_member_by_id', {
        memberId: maskId(memberId),
      });
    }
  }

  /**
   * Find member by user and server
   */
  async findMemberByUserAndServer(
    userId: string,
    serverId: string
  ): Promise<(Member & { user: User; role: any }) | null> {
    try {
      this.validateId(userId, 'userId');
      this.validateId(serverId, 'serverId');

      const member = await this.prisma.member.findFirst({
        where: {
          userId,
          serverId,
        },
        include: {
          user: true,
          role: true,
        },
      });

      return member as any;
    } catch (error) {
      return await this.handleError(error, 'find_member_by_user_and_server', {
        userId: maskId(userId),
        serverId: maskId(serverId),
      });
    }
  }

  /**
   * Update member role
   * Admin-only operation with comprehensive verification
   */
  async updateMemberRole(
    memberId: string,
    newRoleName: string,
    adminUserId: string
  ): Promise<Member> {
    try {
      this.validateId(memberId, 'memberId');
      this.validateRequired(newRoleName, 'role name');
      this.validateId(adminUserId, 'adminUserId');

      // Step 1: Verify admin permissions
      const adminUser = await this.prisma.user.findFirst({
        where: { id: adminUserId },
      });

      if (!adminUser?.isAdmin) {
        throw new AuthorizationError(
          'Only global administrators can change member roles'
        );
      }

      // Step 2: Get member details
      const member = await this.findMemberById(memberId);
      if (!member) {
        throw new NotFoundError('Member not found');
      }

      // Step 3: Find the target role
      const targetRole = await this.prisma.role.findFirst({
        where: {
          name: newRoleName,
          serverId: member.serverId,
        },
      });

      if (!targetRole) {
        throw new NotFoundError(
          `Role '${newRoleName}' not found in this server`
        );
      }

      // Step 4: Prevent admin from demoting themselves
      if (member.userId === adminUserId && newRoleName !== 'ADMIN') {
        throw new AuthorizationError('Administrators cannot demote themselves');
      }

      // Step 5: Update member role
      const updatedMember = await this.prisma.member.update({
        where: { id: memberId },
        data: { roleId: targetRole.id },
        include: {
          user: true,
          role: true,
        },
      });

      this.logSuccess('member_role_updated', {
        memberId: maskId(memberId),
        userId: maskId(member.userId),
        serverId: maskId(member.serverId),
        adminId: maskId(adminUserId),
        oldRole: member.role.name,
        newRole: newRoleName,
      });

      return updatedMember as Member;
    } catch (error) {
      return await this.handleError(error, 'update_member_role', {
        memberId: maskId(memberId),
        newRole: newRoleName,
        adminUserId: maskId(adminUserId),
      });
    }
  }

  /**
   * Remove member from server
   * Admin-only operation with safety checks
   */
  async removeMemberFromServer(
    memberId: string,
    adminUserId: string
  ): Promise<boolean> {
    try {
      this.validateId(memberId, 'memberId');
      this.validateId(adminUserId, 'adminUserId');

      // Step 1: Verify admin permissions
      const adminUser = await this.prisma.user.findFirst({
        where: { id: adminUserId },
      });

      if (!adminUser?.isAdmin) {
        throw new AuthorizationError(
          'Only global administrators can remove members'
        );
      }

      // Step 2: Get member details
      const member = await this.findMemberById(memberId);
      if (!member) {
        throw new NotFoundError('Member not found');
      }

      // Step 3: Prevent server owner removal
      if (member.server.ownerId === member.userId) {
        throw new AuthorizationError(
          'Cannot remove server owner. Transfer ownership first.'
        );
      }

      // Step 4: Prevent admin from removing themselves
      if (member.userId === adminUserId) {
        throw new AuthorizationError('Administrators cannot remove themselves');
      }

      // Step 5: Remove member
      await this.prisma.member.delete({
        where: { id: memberId },
      });

      this.logSuccess('member_removed_from_server', {
        memberId: maskId(memberId),
        userId: maskId(member.userId),
        serverId: maskId(member.serverId),
        adminId: maskId(adminUserId),
        memberRole: member.role.name,
      });

      return true;
    } catch (error) {
      await this.handleError(error, 'remove_member_from_server', {
        memberId: maskId(memberId),
        adminUserId: maskId(adminUserId),
      });
      return false;
    }
  }

  /**
   * List all members in a server
   */
  async listServerMembers(
    serverId: string,
    requestingUserId: string,
    options: {
      limit?: number;
      offset?: number;
      includeRoles?: boolean;
    } = {}
  ): Promise<{
    members: Array<Member & { user: User; role?: any }>;
    total: number;
    hasMore: boolean;
  }> {
    try {
      this.validateId(serverId, 'serverId');
      this.validateId(requestingUserId, 'requestingUserId');

      const { limit = 50, offset = 0, includeRoles = true } = options;

      // Step 1: Verify user has access to server
      const userMember = await this.findMemberByUserAndServer(
        requestingUserId,
        serverId
      );
      if (!userMember) {
        throw new AuthorizationError(
          'You must be a member of this server to view members'
        );
      }

      // Step 2: Get members with pagination
      const [members, total] = await Promise.all([
        this.prisma.member.findMany({
          where: { serverId },
          include: {
            user: true,
            ...(includeRoles && { role: true }),
          },
          orderBy: [
            { role: { name: 'asc' } }, // Admins first
            { joinedAt: 'asc' },
          ],
          take: Math.min(limit, 100),
          skip: offset,
        }),
        this.prisma.member.count({
          where: { serverId },
        }),
      ]);

      const hasMore = offset + members.length < total;

      this.logSuccess('server_members_listed', {
        serverId: maskId(serverId),
        requestingUserId: maskId(requestingUserId),
        memberCount: members.length,
        total,
        hasMore,
      });

      return {
        members: members as any,
        total,
        hasMore,
      };
    } catch (error) {
      return await this.handleError(error, 'list_server_members', {
        serverId: maskId(serverId),
        requestingUserId: maskId(requestingUserId),
      });
    }
  }

  /**
   * Verify member admin access to server
   */
  async verifyMemberAdminAccess(
    userId: string,
    serverId: string
  ): Promise<{
    hasAccess: boolean;
    isGlobalAdmin: boolean;
    isServerAdmin: boolean;
    member?: Member & { user: User; role: any };
  }> {
    try {
      this.validateId(userId, 'userId');
      this.validateId(serverId, 'serverId');

      // Step 1: Check global admin status
      const user = await this.prisma.user.findFirst({
        where: { id: userId },
      });

      const isGlobalAdmin = user?.isAdmin || false;

      // Step 2: Check server membership and role
      const member = await this.findMemberByUserAndServer(userId, serverId);

      if (!member) {
        return {
          hasAccess: false,
          isGlobalAdmin,
          isServerAdmin: false,
        };
      }

      const isServerAdmin =
        member.role?.name === 'ADMIN' || member.role?.name === 'MODERATOR';
      const hasAccess = isGlobalAdmin || isServerAdmin;

      this.logSuccess('member_admin_access_verified', {
        userId: maskId(userId),
        serverId: maskId(serverId),
        hasAccess,
        isGlobalAdmin,
        isServerAdmin,
        memberRole: member.role?.name || 'UNKNOWN',
      });

      return {
        hasAccess,
        isGlobalAdmin,
        isServerAdmin,
        member: member as any,
      };
    } catch (error) {
      return await this.handleError(error, 'verify_member_admin_access', {
        userId: maskId(userId),
        serverId: maskId(serverId),
      });
    }
  }

  /**
   * Update member nickname
   */
  async updateMemberNickname(
    memberId: string,
    nickname: string,
    requestingUserId: string
  ): Promise<Member> {
    try {
      this.validateId(memberId, 'memberId');
      this.validateId(requestingUserId, 'requestingUserId');

      if (nickname && nickname.length > 50) {
        throw new ValidationError('Nickname cannot exceed 50 characters');
      }

      // Step 1: Get member details
      const member = await this.findMemberById(memberId);
      if (!member) {
        throw new NotFoundError('Member not found');
      }

      // Step 2: Verify permissions (self or admin)
      const isSelf = member.userId === requestingUserId;
      const adminAccess = await this.verifyMemberAdminAccess(
        requestingUserId,
        member.serverId
      );

      if (!isSelf && !adminAccess.hasAccess) {
        throw new AuthorizationError(
          'You can only change your own nickname or must be an admin'
        );
      }

      // Step 3: Update nickname
      const updatedMember = await this.prisma.member.update({
        where: { id: memberId },
        data: { nickname: nickname || null },
        include: {
          user: true,
          role: true,
        },
      });

      this.logSuccess('member_nickname_updated', {
        memberId: maskId(memberId),
        userId: maskId(member.userId),
        requestingUserId: maskId(requestingUserId),
        isSelf,
        hasNickname: !!nickname,
      });

      return updatedMember as Member;
    } catch (error) {
      return await this.handleError(error, 'update_member_nickname', {
        memberId: maskId(memberId),
        requestingUserId: maskId(requestingUserId),
      });
    }
  }

  /**
   * Get member statistics for a server
   */
  async getServerMemberStats(serverId: string): Promise<{
    total: number;
    admins: number;
    moderators: number;
    members: number;
    guests: number;
    recentJoins: number;
  }> {
    try {
      this.validateId(serverId, 'serverId');

      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      const [total, byRole, recentJoins] = await Promise.all([
        this.prisma.member.count({
          where: { serverId },
        }),
        this.prisma.member.groupBy({
          by: ['roleId'],
          where: { serverId },
          _count: { roleId: true },
        }),
        this.prisma.member.count({
          where: {
            serverId,
            joinedAt: { gte: oneDayAgo },
          },
        }),
      ]);

      // Count by role type (simplified - would need role lookup for accurate counts)
      const roleStats = {
        admins: 0,
        moderators: 0,
        members: 0,
        guests: 0,
      };

      this.logSuccess('server_member_stats_fetched', {
        serverId: maskId(serverId),
        total,
        recentJoins,
      });

      return {
        total,
        ...roleStats,
        recentJoins,
      };
    } catch (error) {
      return await this.handleError(error, 'get_server_member_stats', {
        serverId: maskId(serverId),
      });
    }
  }
}
