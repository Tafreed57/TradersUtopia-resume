import { prisma } from '@/lib/prismadb';
import { getCurrentProfileForAuth } from '@/lib/query';
import { Message } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimitMessaging, trackSuspiciousActivity } from '@/lib/rate-limit';

// Force dynamic rendering due to rate limiting using request.headers
export const dynamic = 'force-dynamic';
import { z } from 'zod';
import { createNotification } from '@/lib/notifications';

const MESSAGE_BATCH = 10;

// Schema for message creation
const messageSchema = z.object({
  content: z.string().min(1).max(10000),
  fileUrl: z.string().url().optional(),
});

export async function GET(req: NextRequest) {
  try {
    // ✅ SECURITY: Rate limiting for message retrieval
    const rateLimitResult = await rateLimitMessaging()(req);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(req, 'MESSAGE_RETRIEVAL_RATE_LIMIT_EXCEEDED');
      return rateLimitResult.error;
    }

    const profile = await getCurrentProfileForAuth();
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
    return new NextResponse('Internal Error', { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // ✅ SECURITY: Rate limiting for message creation
    const rateLimitResult = await rateLimitMessaging()(req);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(req, 'MESSAGE_CREATION_RATE_LIMIT_EXCEEDED');
      return rateLimitResult.error;
    }

    const profile = await getCurrentProfileForAuth();
    if (!profile) {
      trackSuspiciousActivity(req, 'UNAUTHENTICATED_MESSAGE_CREATION');
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const channelId = searchParams.get('channelId');
    const serverId = searchParams.get('serverId');

    if (!channelId || !serverId) {
      return new NextResponse('Channel ID and Server ID are required', {
        status: 400,
      });
    }

    // ✅ SECURITY: Validate IDs format (CUID)
    try {
      z.string()
        .regex(/^c[a-z0-9]{24}$/)
        .parse(channelId);
      z.string()
        .regex(/^c[a-z0-9]{24}$/)
        .parse(serverId);
    } catch (error) {
      trackSuspiciousActivity(req, 'INVALID_ID_FORMAT');
      return new NextResponse('Invalid ID format', { status: 400 });
    }

    // Parse and validate request body
    const body = await req.json();
    const validatedData = messageSchema.parse(body);

    // ✅ PERFORMANCE: Combined database query to verify permissions and get channel data
    const channelWithMember = await prisma.channel.findFirst({
      where: {
        id: channelId,
        serverId: serverId,
        server: {
          members: {
            some: {
              profileId: profile.id,
            },
          },
        },
      },
      include: {
        server: {
          include: {
            members: {
              where: {
                profileId: profile.id,
              },
              take: 1,
            },
          },
        },
      },
    });

    if (!channelWithMember || !channelWithMember.server.members[0]) {
      trackSuspiciousActivity(req, 'UNAUTHORIZED_CHANNEL_MESSAGE_ACCESS');
      return new NextResponse('Channel not found or access denied', {
        status: 404,
      });
    }

    const member = channelWithMember.server.members[0];
    const channel = channelWithMember;

    // Create the message
    const message = await prisma.message.create({
      data: {
        content: validatedData.content,
        fileUrl: validatedData.fileUrl,
        channelId: channelId,
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

    // ✅ PERFORMANCE: Return message immediately, handle notifications in background
    const responsePromise = NextResponse.json(message);

    // 📱 BACKGROUND NOTIFICATIONS: Process notifications after response is sent
    // This prevents notifications from blocking the API response
    setImmediate(async () => {
      try {
        // Get other members for notifications (simplified query)
        const otherMembers = await prisma.member.findMany({
          where: {
            serverId: serverId,
            profileId: { not: profile.id },
          },
          include: {
            profile: {
              select: {
                userId: true,
                name: true,
                email: true,
              },
            },
          },
        });

        if (otherMembers.length === 0) return;

        // Detect mentions in the message content (@username pattern)
        const mentionRegex = /@(\w+)/g;
        const mentions = Array.from(
          validatedData.content.matchAll(mentionRegex)
        );
        const mentionedUsernames = mentions.map(match =>
          match[1].toLowerCase()
        );

        const truncatedContent =
          validatedData.content.length > 100
            ? validatedData.content.substring(0, 100) + '...'
            : validatedData.content;

        // Create notifications for each member
        const notificationPromises = otherMembers.map(serverMember => {
          const isMentioned = mentionedUsernames.some(
            username =>
              serverMember.profile.name.toLowerCase().includes(username) ||
              serverMember.profile.email.toLowerCase().includes(username)
          );

          return createNotification({
            userId: serverMember.profile.userId,
            type: isMentioned ? 'MENTION' : 'MESSAGE',
            title: isMentioned
              ? `You were mentioned in #${channel.name}`
              : `New message in #${channel.name}`,
            message: `${profile.name}: ${truncatedContent}`,
            actionUrl: `/servers/${serverId}/channels/${channelId}`,
          });
        });

        // Send notifications without blocking
        await Promise.all(notificationPromises);
      } catch (error) {
        //
      }
    });

    return responsePromise;
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return new NextResponse('Invalid input data', { status: 400 });
    }

    return new NextResponse('Internal Error', { status: 500 });
  }
}
