import { NextRequest, NextResponse } from 'next/server';
import { getCurrentProfile } from '@/lib/query';
import { prisma } from '@/lib/prismadb';
import { MemberRole } from '@prisma/client';
import { rateLimitMessaging } from '@/lib/rate-limit';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { directMessageId: string } }
) {
  // Apply rate limiting
  const rateLimitResult = await rateLimitMessaging()(req);
  if (!rateLimitResult.success) {
    return rateLimitResult.error;
  }

  try {
    const profile = await getCurrentProfile();
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

    let directMessage = await prisma.directMessage.findFirst({
      where: {
        id: params.directMessageId,
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

    if (!directMessage || directMessage.deleted) {
      return NextResponse.json(
        { message: 'Message not found' },
        { status: 404 }
      );
    }

    const isMessageOwner = directMessage.memberId === member.id;
    const isAdmin = member.role === MemberRole.ADMIN;
    const isModerator = member.role === MemberRole.MODERATOR;
    const canModify = isMessageOwner || isAdmin || isModerator;

    if (!canModify) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    directMessage = await prisma.directMessage.update({
      where: {
        id: params.directMessageId,
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

    return NextResponse.json(directMessage);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { directMessageId: string } }
) {
  // Apply rate limiting
  const rateLimitResult = await rateLimitMessaging()(req);
  if (!rateLimitResult.success) {
    return rateLimitResult.error;
  }

  try {
    const profile = await getCurrentProfile();
    const { content } = await req.json();
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

    let directMessage = await prisma.directMessage.findFirst({
      where: {
        id: params.directMessageId,
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

    if (!directMessage || directMessage.deleted) {
      return NextResponse.json(
        { message: 'Message not found' },
        { status: 404 }
      );
    }

    const isMessageOwner = directMessage.memberId === member.id;

    if (!isMessageOwner) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    if (!content) {
      return NextResponse.json(
        { message: 'Content is required' },
        { status: 400 }
      );
    }

    directMessage = await prisma.directMessage.update({
      where: {
        id: params.directMessageId,
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

    return NextResponse.json(directMessage);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
