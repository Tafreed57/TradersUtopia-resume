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
