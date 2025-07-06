import { NextRequest, NextResponse } from 'next/server';
import { getCurrentProfile } from '@/lib/query';
import { prisma } from '@/lib/prismadb';
import { MemberRole } from '@prisma/client';
import { rateLimitMessaging, trackSuspiciousActivity } from '@/lib/rate-limit';
import { z } from 'zod';
import { strictCSRFValidation } from '@/lib/csrf';

const messageEditSchema = z.object({
  content: z.string().min(1, 'Content is required').max(10000),
});

export async function DELETE(
  req: NextRequest,
  { params }: { params: { messageId: string } }
) {
  try {
    // Apply rate limiting
    const rateLimitResult = await rateLimitMessaging()(req);
    if (!rateLimitResult.success) {
      return rateLimitResult.error;
    }

    // Apply CSRF protection
    const csrfValid = await strictCSRFValidation(req);
    if (!csrfValid) {
      trackSuspiciousActivity(req, 'MESSAGE_DELETE_CSRF_FAILED');
      return NextResponse.json(
        {
          error: 'CSRF validation failed',
          message: 'Invalid security token. Please refresh and try again.',
        },
        { status: 403 }
      );
    }

    const profile = await getCurrentProfile();
    const { searchParams } = new URL(req.url);
    const channelId = searchParams.get('channelId');
    const serverId = searchParams.get('serverId');

    if (!profile) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    if (!channelId) {
      return NextResponse.json(
        { message: 'ChannelId is required' },
        { status: 400 }
      );
    }

    const server = await prisma.server.findFirst({
      where: {
        id: serverId!,
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
        serverId: serverId!,
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

    let message = await prisma.message.findFirst({
      where: {
        id: params.messageId,
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

    if (!message || message.deleted) {
      return NextResponse.json(
        { message: 'Message not found' },
        { status: 404 }
      );
    }

    const isMessageOwner = message.memberId === member.id;
    const isAdmin = member.role === MemberRole.ADMIN;
    const isModerator = member.role === MemberRole.MODERATOR;
    const canModify = isMessageOwner || isAdmin || isModerator;

    if (!canModify) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const updatedMessage = await prisma.message.update({
      where: {
        id: params.messageId,
      },
      data: {
        fileUrl: null,
        content: 'This message has been deleted',
        deleted: true,
      },
      include: {
        member: {
          include: {
            profile: true,
          },
        },
      },
    });

    return NextResponse.json(updatedMessage);
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { messageId: string } }
) {
  try {
    // Apply rate limiting
    const rateLimitResult = await rateLimitMessaging()(req);
    if (!rateLimitResult.success) {
      return rateLimitResult.error;
    }

    // Apply CSRF protection
    const csrfValid = await strictCSRFValidation(req);
    if (!csrfValid) {
      trackSuspiciousActivity(req, 'MESSAGE_EDIT_CSRF_FAILED');
      return NextResponse.json(
        {
          error: 'CSRF validation failed',
          message: 'Invalid security token. Please refresh and try again.',
        },
        { status: 403 }
      );
    }

    const profile = await getCurrentProfile();
    const { searchParams } = new URL(req.url);
    const channelId = searchParams.get('channelId');
    const serverId = searchParams.get('serverId');

    if (!profile) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    if (!channelId) {
      return NextResponse.json(
        { message: 'ChannelId is required' },
        { status: 400 }
      );
    }

    // ✅ SECURITY: Input validation with Zod
    const body = await req.json();
    const validationResult = messageEditSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', issues: validationResult.error.issues },
        { status: 400 }
      );
    }
    const { content } = validationResult.data;

    const server = await prisma.server.findFirst({
      where: {
        id: serverId!,
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
        serverId: serverId!,
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

    let message = await prisma.message.findFirst({
      where: {
        id: params.messageId,
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

    if (!message || message.deleted) {
      return NextResponse.json(
        { message: 'Message not found' },
        { status: 404 }
      );
    }

    const isMessageOwner = message.memberId === member.id;

    if (!isMessageOwner) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const updatedMessage = await prisma.message.update({
      where: {
        id: params.messageId,
      },
      data: {
        content,
      },
      include: {
        member: {
          include: {
            profile: true,
          },
        },
      },
    });

    return NextResponse.json(updatedMessage);
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
