import { prisma } from '@/lib/prismadb';
import { getCurrentProfile } from '@/lib/query';
import { DirectMessage } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimitMessaging, trackSuspiciousActivity } from '@/lib/rate-limit';

const MESSAGE_BATCH = 10;

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

    const profile = await getCurrentProfile();
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
      const { z } = await import('zod');
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
