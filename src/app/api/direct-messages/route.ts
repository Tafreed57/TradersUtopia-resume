import { prisma } from '@/lib/prismadb';
import { getCurrentProfileForAuth } from '@/lib/query';
import { DirectMessage } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimitMessaging, trackSuspiciousActivity } from '@/lib/rate-limit';
import { z } from 'zod';
import { createNotification } from '@/lib/notifications';

const MESSAGE_BATCH = 10;

// Schema for direct message creation
const directMessageSchema = z.object({
  content: z.string().min(1).max(10000),
  fileUrl: z.string().url().optional(),
});

export async function GET(req: NextRequest) {
  try {
    // ✅ SECURITY: Rate limiting for direct message retrieval
    const rateLimitResult = await rateLimitMessaging()(req);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(
        req,
        'DIRECT_MESSAGE_RETRIEVAL_RATE_LIMIT_EXCEEDED'
      );
      return rateLimitResult.error;
    }

    const profile = await getCurrentProfileForAuth();
    if (!profile) {
      trackSuspiciousActivity(req, 'UNAUTHENTICATED_DIRECT_MESSAGE_ACCESS');
      return new NextResponse('Unauthorized', { status: 401 });
    }
    const { searchParams } = new URL(req.url);

    const conversationId = searchParams.get('conversationId');
    const cursor = searchParams.get('cursor');
    if (!conversationId) {
      return new NextResponse('conversation ID is required', { status: 400 });
    }

    // ✅ SECURITY: Validate conversationId format (CUID)
    try {
      z.string()
        .regex(/^c[a-z0-9]{24}$/)
        .parse(conversationId);
    } catch (error) {
      trackSuspiciousActivity(req, 'INVALID_CONVERSATION_ID_FORMAT');
      return new NextResponse('Invalid conversation ID format', {
        status: 400,
      });
    }

    // ✅ SECURITY: Verify user has access to the conversation
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        OR: [
          {
            memberOne: {
              profileId: profile.id,
            },
          },
          {
            memberTwo: {
              profileId: profile.id,
            },
          },
        ],
      },
    });

    if (!conversation) {
      trackSuspiciousActivity(req, 'UNAUTHORIZED_DIRECT_MESSAGE_ACCESS');
      return new NextResponse('Conversation not found or access denied', {
        status: 404,
      });
    }

    let messages: DirectMessage[] = [];

    if (cursor) {
      messages = await prisma.directMessage.findMany({
        take: MESSAGE_BATCH,
        skip: 1,
        cursor: {
          id: cursor,
        },
        where: {
          conversationId,
        },
        include: {
          member: {
            include: {
              profile: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    } else {
      messages = await prisma.directMessage.findMany({
        take: MESSAGE_BATCH,
        where: {
          conversationId,
        },
        include: {
          member: {
            include: {
              profile: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    }

    let nextCursor = null;

    if (messages.length === MESSAGE_BATCH) {
      nextCursor = messages[messages.length - 1].id;
    }

    return NextResponse.json({
      items: messages,
      nextCursor,
    });
  } catch (error: any) {
    if (process.env.NODE_ENV === 'development') {
      console.log(error, 'DIRECT MESSAGES API ERROR');
    }
    return new NextResponse('Internal Error', { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // ✅ SECURITY: Rate limiting for direct message creation
    const rateLimitResult = await rateLimitMessaging()(req);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(
        req,
        'DIRECT_MESSAGE_CREATION_RATE_LIMIT_EXCEEDED'
      );
      return rateLimitResult.error;
    }

    const profile = await getCurrentProfileForAuth();
    if (!profile) {
      trackSuspiciousActivity(req, 'UNAUTHENTICATED_DIRECT_MESSAGE_CREATION');
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get('conversationId');

    if (!conversationId) {
      return new NextResponse('Conversation ID is required', { status: 400 });
    }

    // ✅ SECURITY: Validate conversationId format (CUID)
    try {
      z.string()
        .regex(/^c[a-z0-9]{24}$/)
        .parse(conversationId);
    } catch (error) {
      trackSuspiciousActivity(req, 'INVALID_CONVERSATION_ID_FORMAT');
      return new NextResponse('Invalid conversation ID format', {
        status: 400,
      });
    }

    // Parse and validate request body
    const body = await req.json();
    const validatedData = directMessageSchema.parse(body);

    // ✅ SECURITY: Verify user has access to the conversation
    const conversation = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        OR: [
          {
            memberOne: {
              profileId: profile.id,
            },
          },
          {
            memberTwo: {
              profileId: profile.id,
            },
          },
        ],
      },
      include: {
        memberOne: {
          include: {
            profile: true,
          },
        },
        memberTwo: {
          include: {
            profile: true,
          },
        },
      },
    });

    if (!conversation) {
      trackSuspiciousActivity(req, 'UNAUTHORIZED_DIRECT_MESSAGE_ACCESS');
      return new NextResponse('Conversation not found or access denied', {
        status: 404,
      });
    }

    // Determine which member is sending the message and who is receiving
    const member =
      conversation.memberOne.profileId === profile.id
        ? conversation.memberOne
        : conversation.memberTwo;

    const recipient =
      conversation.memberOne.profileId === profile.id
        ? conversation.memberTwo
        : conversation.memberOne;

    // Create the direct message
    const directMessage = await prisma.directMessage.create({
      data: {
        content: validatedData.content,
        fileUrl: validatedData.fileUrl,
        conversationId: conversationId,
        memberId: member.id,
      },
      include: {
        member: {
          include: {
            profile: true,
          },
        },
      },
    });

    // 📱 PUSH NOTIFICATIONS: Notify the recipient of the direct message
    try {
      const truncatedContent =
        validatedData.content.length > 100
          ? validatedData.content.substring(0, 100) + '...'
          : validatedData.content;

      await createNotification({
        userId: recipient.profile.userId,
        type: 'MESSAGE',
        title: `New message from ${profile.name}`,
        message: truncatedContent,
        actionUrl: `/servers/${conversation.memberOne.serverId}/conversations/${recipient.id}`,
      });

      if (process.env.NODE_ENV === 'development') {
        console.log(
          `📱 [NOTIFICATIONS] Sending direct message notification to ${recipient.profile.name}`
        );
      }
    } catch (error) {
      console.error(
        '❌ [NOTIFICATIONS] Error sending direct message notification:',
        error
      );
      // Don't fail the message creation if notifications fail
    }

    return NextResponse.json(directMessage);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return new NextResponse('Invalid input data', { status: 400 });
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(error, 'DIRECT MESSAGE CREATION ERROR');
    }
    return new NextResponse('Internal Error', { status: 500 });
  }
}
