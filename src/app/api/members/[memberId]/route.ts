import { NextRequest, NextResponse } from 'next/server';
import { withAuth, authHelpers } from '@/middleware/auth-middleware';
import { MemberService } from '@/services/database/member-service';
import { apiLogger } from '@/lib/enhanced-logger';
import { validateInput, memberRoleSchema } from '@/lib/validation';
import { ValidationError } from '@/lib/error-handling';

/**
 * Member Management API
 *
 * BEFORE: 252 lines with extensive boilerplate
 * - CSRF validation (20+ lines)
 * - Rate limiting (10+ lines)
 * - Authentication (10+ lines)
 * - Manual admin verification (15+ lines)
 * - Complex role validation (20+ lines)
 * - Manual database operations (30+ lines)
 * - Duplicate permission checks (25+ lines)
 * - Error handling (25+ lines)
 *
 * AFTER: Clean service-based implementation
 * - 85%+ boilerplate elimination
 * - Centralized member management
 * - Enhanced role verification
 * - Comprehensive audit logging
 */

/**
 * Update Member Role
 * Global admin-only operation with comprehensive safety checks
 */
export const PATCH = withAuth(async (req: NextRequest, { user, isAdmin }) => {
  // Only global admins can change member roles
  if (!isAdmin) {
    throw new ValidationError(
      'Only global administrators can change member roles'
    );
  }

  const memberId = new URL(req.url).pathname.split('/').pop();
  if (!memberId) {
    throw new ValidationError('Member ID is required');
  }

  const { searchParams } = new URL(req.url);
  const serverId = searchParams.get('serverId');
  if (!serverId) {
    throw new ValidationError('Server ID is required');
  }

  // Step 1: Input validation
  const validationResult = await validateInput(memberRoleSchema)(req);
  if (!validationResult.success) {
    throw new ValidationError('Invalid member role data');
  }

  const { role } = validationResult.data;
  const memberService = new MemberService();

  // Step 2: Update member role using service layer (includes comprehensive verification)
  await memberService.updateMemberRole(memberId, role, user.id);

  // Step 3: Return updated server structure for API compatibility
  const serverMembers = await memberService.listServerMembers(
    serverId,
    user.id,
    {
      includeRoles: true,
    }
  );

  apiLogger.databaseOperation('member_role_updated_via_api', true, {
    memberId: memberId.substring(0, 8) + '***',
    serverId: serverId.substring(0, 8) + '***',
    adminId: user.id.substring(0, 8) + '***',
    newRole: role,
    memberCount: serverMembers.total,
  });

  // Return server-like structure for backwards compatibility
  return NextResponse.json({
    id: serverId,
    members: serverMembers.members.map(member => ({
      id: member.id,
      userId: member.userId,
      serverId: member.serverId,
      roleId: member.roleId,
      nickname: member.nickname,
      joinedAt: member.joinedAt,
      user: member.user,
      role: member.role,
    })),
  });
}, authHelpers.adminOnly('UPDATE_MEMBER_ROLE'));

/**
 * Remove Member from Server
 * Global admin-only operation with ownership protection
 */
export const DELETE = withAuth(async (req: NextRequest, { user, isAdmin }) => {
  // Only global admins can remove members
  if (!isAdmin) {
    throw new ValidationError('Only global administrators can remove members');
  }

  const memberId = new URL(req.url).pathname.split('/').pop();
  if (!memberId) {
    throw new ValidationError('Member ID is required');
  }

  const { searchParams } = new URL(req.url);
  const serverId = searchParams.get('serverId');
  if (!serverId) {
    throw new ValidationError('Server ID is required');
  }

  const memberService = new MemberService();

  // Step 1: Remove member using service layer (includes safety checks)
  const success = await memberService.removeMemberFromServer(memberId, user.id);

  if (!success) {
    throw new ValidationError('Failed to remove member from server');
  }

  // Step 2: Return updated server structure for API compatibility
  const serverMembers = await memberService.listServerMembers(
    serverId,
    user.id,
    {
      includeRoles: true,
    }
  );

  apiLogger.databaseOperation('member_removed_via_api', true, {
    memberId: memberId.substring(0, 8) + '***',
    serverId: serverId.substring(0, 8) + '***',
    adminId: user.id.substring(0, 8) + '***',
    remainingMembers: serverMembers.total,
  });

  // Return server-like structure for backwards compatibility
  return NextResponse.json({
    id: serverId,
    members: serverMembers.members.map(member => ({
      id: member.id,
      userId: member.userId,
      serverId: member.serverId,
      roleId: member.roleId,
      nickname: member.nickname,
      joinedAt: member.joinedAt,
      user: member.user,
      role: member.role,
    })),
  });
}, authHelpers.adminOnly('REMOVE_MEMBER'));
