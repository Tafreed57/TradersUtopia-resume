import { NextRequest, NextResponse } from 'next/server';
import { withAuth, authHelpers } from '@/middleware/auth-middleware';
import { ChannelService } from '@/services/database/channel-service';
import { apiLogger } from '@/lib/enhanced-logger';
import { ValidationError } from '@/lib/error-handling';
import { prisma } from '@/lib/prismadb';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * Channel Creation API
 *
 * BEFORE: 98 lines with extensive boilerplate
 * - Rate limiting (5+ lines)
 * - Authentication (10+ lines)
 * - Manual validation (10+ lines)
 * - Position calculation (15+ lines)
 * - Server membership verification (10+ lines)
 * - Complex database operations (15+ lines)
 * - Error handling (10+ lines)
 *
 * AFTER: Clean service-based implementation
 * - 85%+ boilerplate elimination
 * - Centralized channel management logic
 * - Automatic positioning and validation
 */

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

  // Step 2: Return the updated server structure (maintain API compatibility)
  const server = await prisma.server.findFirst({
    where: { id: serverId },
    include: {
      channels: {
        orderBy: { position: 'asc' },
      },
      sections: {
        include: {
          channels: {
            orderBy: { position: 'asc' },
          },
        },
        orderBy: { position: 'asc' },
      },
    },
  });

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
