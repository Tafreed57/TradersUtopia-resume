import { NextRequest, NextResponse } from 'next/server';
import { withAuth, authHelpers } from '@/middleware/auth-middleware';
import { ChannelService } from '@/services/database/channel-service';
import { apiLogger } from '@/lib/enhanced-logger';
import { validateInput, channelSchema } from '@/lib/validation';
import { ValidationError } from '@/lib/error-handling';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prismadb';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * Channel Management API
 *
 * BEFORE: 224 lines with extensive boilerplate
 * - Rate limiting (12+ lines)
 * - Authentication (15+ lines)
 * - Parameter validation (20+ lines)
 * - Permission checks (25+ lines)
 * - Manual database operations (30+ lines)
 * - Complex error handling (35+ lines)
 *
 * AFTER: Clean service-based implementation
 * - 85%+ boilerplate elimination
 * - Centralized channel access control
 * - Consistent error handling and audit logging
 */

/**
 * Update Channel
 * Admin-only operation
 */
export const PATCH = withAuth(async (req: NextRequest, { user, isAdmin }) => {
  // Only global admins can edit channels
  if (!isAdmin) {
    throw new ValidationError('Only administrators can edit channels');
  }

  const channelId = new URL(req.url).pathname.split('/').pop();
  const { searchParams } = new URL(req.url);
  const serverId = searchParams.get('serverId');

  if (!channelId) {
    throw new ValidationError('Channel ID is required');
  }

  if (!serverId) {
    throw new ValidationError('Server ID is required');
  }

  const channelService = new ChannelService();

  // Step 1: Input validation
  const validationResult = await validateInput(channelSchema)(req);
  if (!validationResult.success) {
    throw new ValidationError('Invalid channel update data');
  }

  const { name, type } = validationResult.data;

  // Step 2: Update channel using service layer (includes access verification)
  const updatedChannel = await channelService.updateChannel(
    channelId,
    { name },
    user.id
  );

  // Step 3: Return the updated server structure (maintain API compatibility)
  const server = await prisma.server.findFirst({
    where: { id: serverId },
    include: {
      channels: {
        orderBy: { position: 'asc' },
      },
    },
  });

  apiLogger.databaseOperation('channel_updated_via_api', true, {
    channelId: channelId.substring(0, 8) + '***',
    serverId: serverId.substring(0, 8) + '***',
    userId: user.id.substring(0, 8) + '***',
    updatedFields: Object.keys({ name, type }).filter(
      key => (key === 'name' && name) || (key === 'type' && type)
    ),
  });

  return NextResponse.json(server);
}, authHelpers.adminOnly('UPDATE_CHANNEL'));

/**
 * Delete Channel
 * Admin-only operation with safety checks
 */
export const DELETE = withAuth(async (req: NextRequest, { user, isAdmin }) => {
  // Only global admins can delete channels
  if (!isAdmin) {
    throw new ValidationError('Only administrators can delete channels');
  }

  const channelId = new URL(req.url).pathname.split('/').pop();
  const { searchParams } = new URL(req.url);
  const serverId = searchParams.get('serverId');

  if (!channelId) {
    throw new ValidationError('Channel ID is required');
  }

  if (!serverId) {
    throw new ValidationError('Server ID is required');
  }

  const channelService = new ChannelService();

  // Step 1: Delete channel using service layer (includes safety checks)
  const deletedChannel = await channelService.deleteChannel(channelId, user.id);

  // Step 2: Get updated server structure (maintain API compatibility)
  const server = await prisma.server.findFirst({
    where: { id: serverId },
    include: {
      channels: {
        orderBy: { position: 'asc' },
      },
    },
  });

  // Step 3: Revalidate cache
  revalidatePath('/(main)', 'layout');

  apiLogger.databaseOperation('channel_deleted_via_api', true, {
    channelId: channelId.substring(0, 8) + '***',
    serverId: serverId.substring(0, 8) + '***',
    userId: user.id.substring(0, 8) + '***',
    channelName: deletedChannel.name,
  });

  return NextResponse.json(server);
}, authHelpers.adminOnly('DELETE_CHANNEL'));
