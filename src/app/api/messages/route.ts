import { prisma } from '@/lib/prismadb';
import { getCurrentProfileForAuth } from '@/lib/query';
import { Message } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimitMessaging, trackSuspiciousActivity } from '@/lib/rate-limit';

// Force dynamic rendering due to rate limiting using request.headers
export const dynamic = 'force-dynamic';
import { z } from 'zod';
import { tasks } from '@trigger.dev/sdk/v3';
import type { sendMessageNotifications } from '@/trigger/send-message-notifications';

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
          deleted: false,
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
          deleted: false,
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

    // ✅ GLOBAL ADMIN ONLY: Only global admins can send messages
    if (!profile.isAdmin) {
      trackSuspiciousActivity(req, 'NON_ADMIN_MESSAGE_ATTEMPT');
      return new NextResponse('Only administrators can send messages', {
        status: 403,
      });
    }

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

    // 📱 BACKGROUND NOTIFICATIONS: Trigger background task for notification processing
    try {
      console.log(
        `📬 [NOTIFICATIONS] Triggering background notification task for message from ${profile.name}`
      );

      // Trigger the background task for notification processing
      const taskHandle = await tasks.trigger<typeof sendMessageNotifications>(
        'send-message-notifications',
        {
          messageId: message.id,
          senderId: profile.id,
          senderName: profile.name,
          channelId: channelId,
          serverId: serverId,
          content: validatedData.content,
        }
      );

      console.log(
        `✅ [NOTIFICATIONS] Background notification task triggered successfully: ${taskHandle.id}`
      );
    } catch (error) {
      console.error(
        `❌ [NOTIFICATIONS] Error triggering background notification task:`,
        error
      );
      // Don't fail the message creation if notification task fails
    }

    return NextResponse.json(message);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return new NextResponse('Invalid input data', { status: 400 });
    }

    return new NextResponse('Internal Error', { status: 500 });
  }
}
