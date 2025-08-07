import { NextRequest, NextResponse } from 'next/server';
import { withAuth, authHelpers } from '@/middleware/auth-middleware';
import { MessageService } from '@/services/database/message-service';
import { apiLogger } from '@/lib/enhanced-logger';
import { ValidationError } from '@/lib/error-handling';
import { z } from 'zod';

const messageEditSchema = z.object({
  content: z.string().min(1, 'Content is required').max(10000),
});

/**
 * Delete Message
 * Soft delete with author/admin permission verification
 */
export const DELETE = withAuth(async (req: NextRequest, { user }) => {
  // Extract serverId, channelId, and messageId from URL path
  const url = new URL(req.url);
  const pathSegments = url.pathname.split('/');
  const serverId = pathSegments[pathSegments.indexOf('servers') + 1];
  const channelId = pathSegments[pathSegments.indexOf('channels') + 1];
  const messageId = pathSegments[pathSegments.length - 1];

  if (!channelId || !serverId || !messageId) {
    throw new ValidationError(
      'Channel ID, Server ID, and Message ID are required'
    );
  }

  const messageService = new MessageService();

  // Step 1: Delete message using service layer (includes permission verification)
  const deletedMessage = await messageService.deleteMessage(messageId, user.id);

  apiLogger.databaseOperation('message_deleted_via_api', true, {
    messageId: messageId.substring(0, 8) + '***',
    channelId: channelId.substring(0, 8) + '***',
    serverId: serverId.substring(0, 8) + '***',
    userId: user.id.substring(0, 8) + '***',
  });

  return NextResponse.json(deletedMessage);
}, authHelpers.userOnly('DELETE_MESSAGE'));

/**
 * Update Message
 * Edit message content with author-only permission verification
 */
export const PATCH = withAuth(async (req: NextRequest, { user }) => {
  // Extract serverId, channelId, and messageId from URL path
  const url = new URL(req.url);
  const pathSegments = url.pathname.split('/');
  const serverId = pathSegments[pathSegments.indexOf('servers') + 1];
  const channelId = pathSegments[pathSegments.indexOf('channels') + 1];
  const messageId = pathSegments[pathSegments.length - 1];

  if (!channelId || !serverId || !messageId) {
    throw new ValidationError(
      'Channel ID, Server ID, and Message ID are required'
    );
  }

  // Step 1: Input validation
  const body = await req.json();
  const validationResult = messageEditSchema.safeParse(body);
  if (!validationResult.success) {
    throw new ValidationError(
      'Invalid message content: ' +
        validationResult.error.issues.map(i => i.message).join(', ')
    );
  }

  const { content } = validationResult.data;
  const messageService = new MessageService();

  // Step 2: Update message using service layer (includes permission verification)
  const updatedMessage = await messageService.updateMessage(
    messageId,
    { content },
    user.id
  );

  apiLogger.databaseOperation('message_updated_via_api', true, {
    messageId: messageId.substring(0, 8) + '***',
    channelId: channelId.substring(0, 8) + '***',
    serverId: serverId.substring(0, 8) + '***',
    userId: user.id.substring(0, 8) + '***',
    contentLength: content.length,
  });

  return NextResponse.json(updatedMessage);
}, authHelpers.userOnly('UPDATE_MESSAGE'));
