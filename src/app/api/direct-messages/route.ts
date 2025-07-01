import { prisma } from '@/lib/prismadb';
import { getCurrentProfile } from '@/lib/query';
import { DirectMessage, Message } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimitMessaging, trackSuspiciousActivity } from '@/lib/rate-limit';
import { z } from 'zod';

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
    console.log(error, 'DIRECT MESSAGES API ERROR');
    return new NextResponse('Internal Error', { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // Apply rate limiting
  const rateLimitResult = await rateLimitMessaging()(req);
  if (!rateLimitResult.success) {
    return rateLimitResult.error;
  }

  try {
    const profile = await getCurrentProfile();
    const { fileUrl, content } = await req.json();
    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get('conversationId');

    if (!profile) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    if (!conversationId) {
      return NextResponse.json(
        { message: 'ConversationId is required' },
        { status: 400 }
      );
    }

    if (!content) {
      return NextResponse.json(
        { message: 'Content is required' },
        { status: 400 }
      );
    }

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
      return NextResponse.json(
        { message: 'Conversation not found' },
        { status: 404 }
      );
    }

    const member =
      conversation.memberOne.profileId === profile.id
        ? conversation.memberOne
        : conversation.memberTwo;

    if (!member) {
      return NextResponse.json(
        { message: 'Member not found' },
        { status: 404 }
      );
    }

    const message = await prisma.directMessage.create({
      data: {
        content,
        fileUrl,
        memberId: member.id,
        conversationId: conversationId,
      },
      include: {
        member: {
          include: {
            profile: true,
          },
        },
      },
    });

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
