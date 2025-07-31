import { NextRequest, NextResponse } from 'next/server';
import { withAuth, authHelpers } from '@/middleware/auth-middleware';
import { ChannelService } from '@/services/database/channel-service';
import { ServerService } from '@/services/database/server-service';
import { apiLogger } from '@/lib/enhanced-logger';
import { validateInput, channelSchema } from '@/lib/validation';
import { ValidationError } from '@/lib/error-handling';
import { revalidatePath } from 'next/cache';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * Get Server with Channel Context
 * Retrieve server data with member access validation for a specific channel
 */
export const GET = withAuth(async (req: NextRequest, { user }) => {
  // Extract serverId and channelId from URL path
  const url = new URL(req.url);
  const pathSegments = url.pathname.split('/');
  const serverId = pathSegments[pathSegments.indexOf('servers') + 1];
  const channelId = pathSegments[pathSegments.length - 1];

  if (!serverId) {
    throw new ValidationError('Server ID is required');
  }

  if (!channelId) {
    throw new ValidationError('Channel ID is required');
  }

  const serverService = new ServerService();
  const channelService = new ChannelService();

  // Get server with member access validation
  const server = await serverService.findServerWithMemberAccess(
    serverId,
    user.id
  );

  if (!server) {
    return NextResponse.json(
      { error: 'Server not found or access denied' },
      { status: 404 }
    );
  }

  // Verify channel exists and belongs to this server
  const channel = server.channels?.find(c => c.id === channelId);
  if (!channel) {
    return NextResponse.json(
      { error: 'Channel not found or access denied' },
      { status: 404 }
    );
  }

  apiLogger.databaseOperation('server_channel_retrieved_via_api', true, {
    serverId: serverId.substring(0, 8) + '***',
    channelId: channelId.substring(0, 8) + '***',
    userId: user.id.substring(0, 8) + '***',
    serverName: server.name,
    channelName: channel.name,
  });

  return NextResponse.json(server);
}, authHelpers.userOnly('GET_SERVER_CHANNEL'));

/**
 * Update Channel
 * Admin-only operation
 */
export const PATCH = withAuth(async (req: NextRequest, { user, isAdmin }) => {
  // Only global admins can edit channels
  if (!isAdmin) {
    throw new ValidationError('Only administrators can edit channels');
  }

  // Extract serverId and channelId from URL path
  const url = new URL(req.url);
  const pathSegments = url.pathname.split('/');
  const serverId = pathSegments[pathSegments.indexOf('servers') + 1];
  const channelId = pathSegments[pathSegments.length - 1];

  if (!channelId) {
    throw new ValidationError('Channel ID is required');
  }

  if (!serverId) {
    throw new ValidationError('Server ID is required');
  }

  const channelService = new ChannelService();
  const serverService = new ServerService();

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

  // Step 3: Return the updated server structure using ServerService
  const server = await serverService.findServerWithMemberAccess(
    serverId,
    user.id
  );

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

  // Extract serverId and channelId from URL path
  const url = new URL(req.url);
  const pathSegments = url.pathname.split('/');
  const serverId = pathSegments[pathSegments.indexOf('servers') + 1];
  const channelId = pathSegments[pathSegments.length - 1];

  if (!channelId) {
    throw new ValidationError('Channel ID is required');
  }

  if (!serverId) {
    throw new ValidationError('Server ID is required');
  }

  const channelService = new ChannelService();
  const serverService = new ServerService();

  // Step 1: Delete channel using service layer (includes safety checks)
  const deletedChannel = await channelService.deleteChannel(channelId, user.id);

  // Step 2: Get updated server structure using ServerService
  const server = await serverService.findServerWithMemberAccess(
    serverId,
    user.id
  );

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
