import { NextRequest, NextResponse } from 'next/server';
import { withAuth, authHelpers } from '@/middleware/auth-middleware';
import { ChannelService } from '@/services/database/channel-service';
import { apiLogger } from '@/lib/enhanced-logger';
import { ValidationError } from '@/lib/error-handling';
import { z } from 'zod';

const reorderChannelSchema = z.object({
  channelId: z.string(),
  newPosition: z.number().min(0),
  newSectionId: z.string().nullable().optional(),
});

/**
 * Reorder Channel
 * Admin-only operation with complex position management
 */
export const PATCH = withAuth(async (req: NextRequest, { user, isAdmin }) => {
  console.log('[API] Channel reorder - Auth check:', {
    userId: user.id?.substring(0, 8) + '***',
    isAdmin,
  });

  // Only global admins can reorder channels
  if (!isAdmin) {
    console.log('[API] Channel reorder - Access denied: not admin');
    throw new ValidationError('Only administrators can reorder channels');
  }

  // Extract serverId from URL path
  const url = new URL(req.url);
  const pathSegments = url.pathname.split('/');
  const serverId = pathSegments[pathSegments.indexOf('servers') + 1];

  if (!serverId) {
    throw new ValidationError('Server ID is required');
  }

  const channelService = new ChannelService();

  // Step 1: Input validation
  const body = await req.json();
  console.log('[API] Channel reorder - Raw body:', body);

  let validatedData;
  try {
    validatedData = reorderChannelSchema.parse(body);
    console.log('[API] Channel reorder - Validated data:', validatedData);
  } catch (error) {
    console.error('[API] Channel reorder - Validation error:', error);
    if (error instanceof z.ZodError) {
      throw new ValidationError('Invalid reorder input');
    }
    throw error;
  }

  const { channelId, newPosition, newSectionId } = validatedData;
  console.log('newSectionId', validatedData);

  // Step 2: Verify channel access using service layer
  console.log('[API] Channel reorder - Verifying channel access');
  const channelAccess = await channelService.verifyChannelAdminAccess(
    channelId,
    user.id!
  );
  console.log('[API] Channel reorder - Access check result:', {
    hasAccess: channelAccess.hasAccess,
    reason: channelAccess.reason,
    currentSectionId: channelAccess.channel?.sectionId,
  });

  if (!channelAccess.hasAccess) {
    console.log('[API] Channel reorder - Access denied:', channelAccess.reason);
    throw new ValidationError(channelAccess.reason || 'Access denied');
  }

  // Step 3: Handle channel reordering with proper position shifting
  console.log('[API] Channel reorder - Processing reorder request:', {
    channelId: channelId.substring(0, 8) + '***',
    newPosition,
    newSectionId: newSectionId ? newSectionId.substring(0, 8) + '***' : null,
    currentSectionId:
      channelAccess.channel?.sectionId?.substring(0, 8) + '***' || null,
  });

  const result = await channelService.reorderChannel(
    channelId,
    newPosition,
    newSectionId || null,
    user.id!
  );

  console.log('[API] Channel reorder - Operation completed:', {
    success: result,
  });

  apiLogger.databaseOperation('channel_reordered_via_api', result, {
    channelId: channelId.substring(0, 8) + '***',
    serverId: serverId.substring(0, 8) + '***',
    userId: user.id!.substring(0, 8) + '***',
    newPosition,
    newSectionId: newSectionId ? newSectionId.substring(0, 8) + '***' : null,
    wasMovedBetweenSections:
      newSectionId !== undefined &&
      newSectionId !== channelAccess.channel?.sectionId,
  });

  console.log('[API] Channel reorder - Success, returning result');
  return NextResponse.json({
    success: result,
    message: result
      ? 'Channel reordered successfully'
      : 'Channel reorder failed',
  });
}, authHelpers.adminOnly('REORDER_CHANNEL'));
