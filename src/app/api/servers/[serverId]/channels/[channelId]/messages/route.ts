import { NextRequest, NextResponse } from 'next/server';
import { withAuth, authHelpers } from '@/middleware/auth-middleware';
import { MessageService } from '@/services/database/message-service';
import { apiLogger } from '@/lib/enhanced-logger';
import { ValidationError } from '@/lib/error-handling';
import { z } from 'zod';
import { sendMessageNotifications } from '@/trigger/send-message-notifications';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Schema for message creation
const messageSchema = z.object({
  content: z.string().min(1).max(10000),
  fileUrl: z.string().url().optional(),
});

/**
 * Get Messages from Channel
 * Returns paginated messages with cursor-based pagination
 */
export const GET = withAuth(async (req: NextRequest, { user }) => {
  // Extract serverId and channelId from URL path
  const url = new URL(req.url);
  const pathSegments = url.pathname.split('/');
  const serverId = pathSegments[pathSegments.indexOf('servers') + 1];
  const channelId = pathSegments[pathSegments.indexOf('channels') + 1];
  const cursor = url.searchParams.get('cursor');

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
    serverId: serverId.substring(0, 8) + '***',
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

  // Extract serverId and channelId from URL path
  const url = new URL(req.url);
  const pathSegments = url.pathname.split('/');
  const serverId = pathSegments[pathSegments.indexOf('servers') + 1];
  const channelId = pathSegments[pathSegments.indexOf('channels') + 1];

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

  // First get the member ID for this user in this server
  const memberService = new (
    await import('@/services/database/member-service')
  ).MemberService();
  const member = await memberService.findMemberByUserAndServer(
    user.id,
    serverId
  );

  if (!member) {
    return new NextResponse('Member not found', { status: 404 });
  }

  // Step 2: Create message using service layer (includes access verification)
  const message = await messageService.createMessage({
    content: validatedData.content,
    channelId,
    memberId: member.id,
  });

  apiLogger.databaseOperation('message_created_via_api', true, {
    messageId: message.id.substring(0, 8) + '***',
    channelId: channelId.substring(0, 8) + '***',
    serverId: serverId.substring(0, 8) + '***',
    userId: user.id.substring(0, 8) + '***',
    hasFileUrl: !!validatedData.fileUrl,
    contentLength: validatedData.content.length,
  });

  // Trigger enhanced notification processing via Trigger.dev
  let notificationJobId: string | null = null;
  try {
    const handle = await sendMessageNotifications.trigger({
      messageId: message.id,
      content: validatedData.content,
      channelId: channelId,
      serverId: serverId,
      senderId: user.id,
      senderName: user.name || user.email,
    });

    notificationJobId = handle.id;

    apiLogger.databaseOperation('notification_job_triggered', true, {
      messageId: message.id.substring(0, 8) + '***',
      jobId: handle.id.substring(0, 8) + '***',
      channelId: channelId.substring(0, 8) + '***',
      serverId: serverId.substring(0, 8) + '***',
    });
  } catch (error) {
    // Log the error but don't fail the message creation
    apiLogger.databaseOperation('notification_job_trigger_failed', false, {
      messageId: message.id.substring(0, 8) + '***',
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return NextResponse.json({
    ...message,
    notificationJobId, // Include job ID for tracking (null if failed)
  });
}, authHelpers.adminOnly('CREATE_MESSAGE'));
