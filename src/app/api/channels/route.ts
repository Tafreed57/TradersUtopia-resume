import { NextRequest, NextResponse } from 'next/server';
import { withAuth, authHelpers } from '@/middleware/auth-middleware';
import { ChannelService } from '@/services/database/channel-service';
import { ServerService } from '@/services/database/server-service';
import { apiLogger } from '@/lib/enhanced-logger';
import { ValidationError } from '@/lib/error-handling';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * Create Channel
 * Admin-only operation with automatic positioning and validation
 */
export const POST = withAuth(async (req: NextRequest, { user, isAdmin }) => {
  // Only global admins can create channels
  if (!isAdmin) {
    throw new ValidationError('Only administrators can create channels');
  }

  const { searchParams } = new URL(req.url);
  const serverId = searchParams.get('serverId');

  if (!serverId) {
    throw new ValidationError('Server ID is required');
  }

  const { name, type, sectionId } = await req.json();

  if (!name) {
    throw new ValidationError('Channel name is required');
  }

  const channelService = new ChannelService();
  const serverService = new ServerService();

  // Step 1: Create channel using service layer (includes validation, positioning, and access checks)
  const channelData = {
    name,
    type: type || 'TEXT',
    serverId,
    sectionId: sectionId || null,
    topic: undefined, // Can be added later via update
  };

  const createdChannel = await channelService.createChannel(
    channelData,
    user.id
  );

  // Step 2: Return the updated server structure using ServerService
  const server = await serverService.findServerWithMemberAccess(
    serverId,
    user.id
  );

  apiLogger.databaseOperation('channel_created_via_api', true, {
    channelId: createdChannel.id.substring(0, 8) + '***',
    serverId: serverId.substring(0, 8) + '***',
    userId: user.id.substring(0, 8) + '***',
    channelName: name,
    channelType: type || 'TEXT',
    sectionId: sectionId ? sectionId.substring(0, 8) + '***' : null,
  });

  return NextResponse.json(server);
}, authHelpers.adminOnly('CREATE_CHANNEL'));
