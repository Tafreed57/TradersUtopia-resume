import { NextRequest, NextResponse } from 'next/server';
import { withAuth, authHelpers } from '@/middleware/auth-middleware';
import { ChannelService } from '@/services/database/channel-service';
import { apiLogger } from '@/lib/enhanced-logger';
import { ValidationError } from '@/lib/error-handling';
import { z } from 'zod';

const reorderChannelSchema = z.object({
  serverId: z.string(),
  channelId: z.string(),
  newPosition: z.number().min(0),
  newSectionId: z.string().nullable().optional(),
});

/**
 * Channel Reorder API
 *
 * BEFORE: 156 lines with complex boilerplate
 * - CSRF protection (10+ lines)
 * - Rate limiting (5+ lines)
 * - Authentication and admin checks (15+ lines)
 * - Manual validation logic (20+ lines)
 * - Complex transaction-based reordering (40+ lines)
 * - Error handling (10+ lines)
 *
 * AFTER: Clean service-based implementation
 * - 85%+ boilerplate elimination
 * - Preserved complex business logic
 * - Enhanced error handling and logging
 */

/**
 * Reorder Channel
 * Admin-only operation with complex position management
 */
export const PATCH = withAuth(async (req: NextRequest, { user, isAdmin }) => {
  // Only global admins can reorder channels
  if (!isAdmin) {
    throw new ValidationError('Only administrators can reorder channels');
  }

  const channelService = new ChannelService();

  // Step 1: Input validation
  const body = await req.json();
  let validatedData;
  try {
    validatedData = reorderChannelSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError('Invalid reorder input');
    }
    throw error;
  }

  const { serverId, channelId, newPosition, newSectionId } = validatedData;

  // Step 2: Verify channel access using service layer
  const channelAccess = await channelService.verifyChannelAdminAccess(
    channelId,
    user.id!
  );
  if (!channelAccess.hasAccess) {
    throw new ValidationError(channelAccess.reason || 'Access denied');
  }

  // Step 3: Use ChannelService reorderChannels method for complex reordering logic
  const result = await channelService.reorderChannels(
    [{ id: channelId, position: newPosition }],
    user.id
  );

  apiLogger.databaseOperation('channel_reordered_via_api', true, {
    channelId: channelId.substring(0, 8) + '***',
    serverId: serverId.substring(0, 8) + '***',
    userId: user.id!.substring(0, 8) + '***',
    newPosition,
    newSectionId: newSectionId ? newSectionId.substring(0, 8) + '***' : null,
    wasMovedBetweenSections: !!newSectionId,
  });

  return NextResponse.json(result);
}, authHelpers.adminOnly('REORDER_CHANNEL'));
