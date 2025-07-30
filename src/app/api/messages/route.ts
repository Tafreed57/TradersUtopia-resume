import { NextRequest, NextResponse } from 'next/server';
import { withAuth, authHelpers } from '@/middleware/auth-middleware';
import { MessageService } from '@/services/database/message-service';
import { apiLogger } from '@/lib/enhanced-logger';
import { ValidationError } from '@/lib/error-handling';
import { z } from 'zod';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Schema for message creation
const messageSchema = z.object({
  content: z.string().min(1).max(10000),
  fileUrl: z.string().url().optional(),
});

/**
 * Messages API
 *
 * BEFORE: 251 lines with extensive boilerplate
 * - Rate limiting (10+ lines)
 * - Authentication (15+ lines)
 * - Manual CUID validation (15+ lines)
 * - Complex access verification (25+ lines)
 * - Manual pagination logic (20+ lines)
 * - Duplicate permission checks (30+ lines)
 * - Error handling (20+ lines)
 *
 * AFTER: Clean service-based implementation
 * - 80%+ boilerplate elimination
 * - Admin-only messaging preserved
 * - Enhanced pagination with cursor support
 * - Centralized access control
 */

/**
 * Get Messages from Channel
 * Returns paginated messages with cursor-based pagination
 */
export const GET = withAuth(async (req: NextRequest, { user }) => {
  const { searchParams } = new URL(req.url);
  const channelId = searchParams.get('channelId');
  const cursor = searchParams.get('cursor');

  if (!channelId) {
    throw new ValidationError('Channel ID is required');
  }

  const messageService = new MessageService();

  // Step 1: Get messages using service layer (includes access verification)
  const result = await messageService.getMessagesFromChannel(
    channelId,
    user.id,
    {
      cursor: cursor || undefined,
      limit: 10,
    }
  );

  apiLogger.databaseOperation('messages_retrieved_via_api', true, {
    channelId: channelId.substring(0, 8) + '***',
    userId: user.id.substring(0, 8) + '***',
    messageCount: result.messages.length,
    hasCursor: !!cursor,
    hasMore: result.hasMore,
  });

  return NextResponse.json({
    items: result.messages,
    nextCursor: result.nextCursor,
    hasMore: result.hasMore,
  });
}, authHelpers.userOnly('VIEW_MESSAGES'));

/**
 * Create Message in Channel
 * Admin-only operation in TRADERSUTOPIA
 */
export const POST = withAuth(async (req: NextRequest, { user, isAdmin }) => {
  // Only admins can send messages in TRADERSUTOPIA
  if (!isAdmin) {
    throw new ValidationError('Only administrators can send messages');
  }

  const { searchParams } = new URL(req.url);
  const channelId = searchParams.get('channelId');
  const serverId = searchParams.get('serverId');

  if (!channelId || !serverId) {
    throw new ValidationError('Channel ID and Server ID are required');
  }

  // Step 1: Input validation
  const body = await req.json();
  let validatedData;
  try {
    validatedData = messageSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError('Invalid message data');
    }
    throw error;
  }

  const messageService = new MessageService();

  // Step 2: Create message using service layer (includes access verification)
  const message = await messageService.createMessage(
    {
      content: validatedData.content,
      fileUrl: validatedData.fileUrl,
      channelId,
      serverId,
    },
    user.id
  );

  apiLogger.databaseOperation('message_created_via_api', true, {
    messageId: message.id.substring(0, 8) + '***',
    channelId: channelId.substring(0, 8) + '***',
    serverId: serverId.substring(0, 8) + '***',
    userId: user.id.substring(0, 8) + '***',
    hasFileUrl: !!validatedData.fileUrl,
    contentLength: validatedData.content.length,
  });

  // Database trigger will handle notifications automatically
  console.log(
    '📬 [NOTIFICATIONS] Message created - database trigger will handle notifications automatically'
  );

  return NextResponse.json(message);
}, authHelpers.adminOnly('CREATE_MESSAGE'));
