import { prisma } from '@/lib/prismadb';
import { getCurrentProfile } from '@/lib/query';
import { Message } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimitMessaging, trackSuspiciousActivity } from '@/lib/rate-limit';

const MESSAGE_BATCH = 10;

export async function GET(req: NextRequest) {
  try {
    // ✅ SECURITY: Rate limiting for message retrieval
    const rateLimitResult = await rateLimitMessaging()(req);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(req, 'MESSAGE_RETRIEVAL_RATE_LIMIT_EXCEEDED');
      return rateLimitResult.error;
    }

    const profile = await getCurrentProfile();
    if (!profile) {
      trackSuspiciousActivity(req, 'UNAUTHENTICATED_MESSAGE_ACCESS');
      return new NextResponse('Unauthorized', { status: 401 });
    }
    const { searchParams } = new URL(req.url);

    const channelId = searchParams.get('channelId');
    const cursor = searchParams.get('cursor');
    if (!channelId) {
      return new NextResponse('Channel ID is required', { status: 400 });
    }

    // ✅ SECURITY: Validate channelId format (CUID)
    try {
      const { z } = await import('zod');
      z.string()
        .regex(/^c[a-z0-9]{24}$/)
        .parse(channelId);
    } catch (error) {
      trackSuspiciousActivity(req, 'INVALID_CHANNEL_ID_FORMAT');
      return new NextResponse('Invalid channel ID format', { status: 400 });
    }

    // ✅ SECURITY: Verify user has access to the channel
    const channel = await prisma.channel.findFirst({
      where: {
        id: channelId,
        server: {
          members: {
            some: {
              profileId: profile.id,
            },
          },
        },
      },
    });

    if (!channel) {
      trackSuspiciousActivity(req, 'UNAUTHORIZED_CHANNEL_MESSAGE_ACCESS');
      return new NextResponse('Channel not found or access denied', {
        status: 404,
      });
    }

    let messages: Message[] = [];

    if (cursor) {
      messages = await prisma.message.findMany({
        take: MESSAGE_BATCH,
        skip: 1,
        cursor: {
          id: cursor,
        },
        where: {
          channelId,
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
      messages = await prisma.message.findMany({
        take: MESSAGE_BATCH,
        where: {
          channelId,
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
    console.log(error, 'MESSAGES API ERROR');
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
    const channelId = searchParams.get('channelId');
    const serverId = searchParams.get('serverId');

    if (!profile) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    if (!serverId || !channelId) {
      return NextResponse.json(
        { message: 'ServerId and channelId are required' },
        { status: 400 }
      );
    }

    if (!content) {
      return NextResponse.json(
        { message: 'Content is required' },
        { status: 400 }
      );
    }

    const server = await prisma.server.findFirst({
      where: {
        id: serverId,
        members: {
          some: {
            profileId: profile.id,
          },
        },
      },
      include: {
        members: true,
      },
    });

    if (!server) {
      return NextResponse.json(
        { message: 'Server not found' },
        { status: 404 }
      );
    }

    const channel = await prisma.channel.findFirst({
      where: {
        id: channelId,
        serverId: serverId,
      },
    });

    if (!channel) {
      return NextResponse.json(
        { message: 'Channel not found' },
        { status: 404 }
      );
    }

    const member = server.members.find(
      member => member.profileId === profile.id
    );

    if (!member) {
      return NextResponse.json(
        { message: 'Member not found' },
        { status: 404 }
      );
    }

    const message = await prisma.message.create({
      data: {
        content,
        fileUrl,
        memberId: member.id,
        channelId: channelId,
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
