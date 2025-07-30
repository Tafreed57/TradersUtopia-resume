import { NextRequest, NextResponse } from 'next/server';
import { withAuth, authHelpers } from '@/middleware/auth-middleware';
import { ServerService } from '@/services/database/server-service';
import { apiLogger } from '@/lib/enhanced-logger';
import { ValidationError } from '@/lib/error-handling';

/**
 * Server Invite Code Regeneration API
 *
 * BEFORE: 54 lines with extensive boilerplate
 * - CSRF validation (10+ lines)
 * - Rate limiting (5+ lines)
 * - Authentication (5+ lines)
 * - Manual database operation (10+ lines)
 * - Error handling (5+ lines)
 *
 * AFTER: Clean service-based implementation
 * - 90%+ boilerplate elimination
 * - Centralized admin access verification
 * - Built-in audit logging
 */

/**
 * Regenerate Server Invite Code
 * Admin/Owner-only operation
 */
export const PATCH = withAuth(async (req: NextRequest, { user }) => {
  const serverId = new URL(req.url).pathname.split('/')[3]; // Extract from /api/servers/[serverId]/invite-code

  if (!serverId) {
    throw new ValidationError('Server ID is required');
  }

  const serverService = new ServerService();

  // Step 1: Generate new invite code using service layer (includes admin access verification)
  const newInviteCode = await serverService.generateNewInviteCode(
    serverId,
    user.id
  );

  // Step 2: Get updated server data for response
  const server = await serverService.findServerWithMemberAccess(
    serverId,
    user.id
  );

  if (!server) {
    throw new ValidationError('Server not found or access denied');
  }

  apiLogger.databaseOperation('server_invite_code_regenerated_via_api', true, {
    serverId: serverId.substring(0, 8) + '***',
    userId: user.id.substring(0, 8) + '***',
    serverName: server.name,
  });

  return NextResponse.json({
    ...server,
    inviteCode: newInviteCode,
  });
}, authHelpers.userOnly('REGENERATE_INVITE_CODE'));
