import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prismadb';
import { rateLimitGeneral } from '@/lib/rate-limit';
import { z } from 'zod';

const messageEditSchema = z.object({
  content: z.string().min(1, 'Content is required').max(4000),
  fileUrl: z.string().optional(),
});

// DELETE - Delete track record message (admin only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: { messageId: string } }
) {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimitGeneral()(req);
    if (!rateLimitResult.success) {
      return new NextResponse('Rate limit exceeded', { status: 429 });
    }

    // Authentication required
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Check if user is admin
    const profile = await prisma.profile.findUnique({
      where: { userId },
      select: { id: true, isAdmin: true },
    });

    if (!profile || !profile.isAdmin) {
      return new NextResponse('Forbidden - Admin access required', {
        status: 403,
      });
    }

    // Find the message
    const message = await prisma.message.findUnique({
      where: { id: params.messageId },
      include: {
        member: {
          select: {
            id: true,
            profile: {
              select: {
                name: true,
                imageUrl: true,
              },
            },
          },
        },
      },
    });

    if (!message || message.deleted) {
      return new NextResponse('Message not found', { status: 404 });
    }

    // Check if the admin is the message owner or has admin privileges
    const isMessageOwner = message.memberId === profile.id;
    const canDelete = isMessageOwner || profile.isAdmin;

    if (!canDelete) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Soft delete the message
    const deletedMessage = await prisma.message.update({
      where: { id: params.messageId },
      data: {
        content: 'This message has been deleted',
        fileUrl: null,
        deleted: true,
      },
      include: {
        member: {
          select: {
            id: true,
            profile: {
              select: {
                name: true,
                imageUrl: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(deletedMessage);
  } catch (error) {
    console.error('TRACK_RECORD_MESSAGE_DELETE', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

// PATCH - Edit track record message (admin only)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { messageId: string } }
) {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimitGeneral()(req);
    if (!rateLimitResult.success) {
      return new NextResponse('Rate limit exceeded', { status: 429 });
    }

    // Authentication required
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Check if user is admin
    const profile = await prisma.profile.findUnique({
      where: { userId },
      select: { id: true, isAdmin: true },
    });

    if (!profile || !profile.isAdmin) {
      return new NextResponse('Forbidden - Admin access required', {
        status: 403,
      });
    }

    // Validate input
    const body = await req.json();
    const validationResult = messageEditSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', issues: validationResult.error.issues },
        { status: 400 }
      );
    }

    const { content, fileUrl } = validationResult.data;

    // Find the message
    const message = await prisma.message.findUnique({
      where: { id: params.messageId },
    });

    if (!message || message.deleted) {
      return new NextResponse('Message not found', { status: 404 });
    }

    // Check if the admin is the message owner
    const isMessageOwner = message.memberId === profile.id;

    if (!isMessageOwner) {
      return new NextResponse('Unauthorized - Can only edit own messages', {
        status: 401,
      });
    }

    // Update the message
    const updatedMessage = await prisma.message.update({
      where: { id: params.messageId },
      data: {
        content,
        fileUrl: fileUrl || message.fileUrl, // Keep existing fileUrl if not provided
        updatedAt: new Date(),
      },
      include: {
        member: {
          select: {
            id: true,
            profile: {
              select: {
                name: true,
                imageUrl: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(updatedMessage);
  } catch (error) {
    console.error('TRACK_RECORD_MESSAGE_PATCH', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
