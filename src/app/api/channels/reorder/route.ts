import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prismadb';
import { z } from 'zod';
import { rateLimitDragDrop } from '@/lib/rate-limit';
import { MemberRole } from '@prisma/client';

const reorderChannelSchema = z.object({
  serverId: z.string(),
  channelId: z.string(),
  newPosition: z.number().min(0),
  newSectionId: z.string().nullable().optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimitDragDrop()(req);
    if (!rateLimitResult.success) {
      return rateLimitResult.error;
    }

    // Authentication
    const userId = (await auth()).userId;
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Input validation
    const body = await req.json();
    const { serverId, channelId, newPosition, newSectionId } =
      reorderChannelSchema.parse(body);

    // Get current profile
    const profile = await prisma.profile.findUnique({
      where: { userId },
    });

    if (!profile) {
      return new NextResponse('Profile not found', { status: 404 });
    }

    // Check if user is member of the server with appropriate permissions
    const member = await prisma.member.findFirst({
      where: {
        profileId: profile.id,
        serverId: serverId,
      },
    });

    if (!member || member.role === MemberRole.GUEST) {
      return new NextResponse('Insufficient permissions', { status: 403 });
    }

    // Get the channel being moved
    const channel = await prisma.channel.findUnique({
      where: {
        id: channelId,
        serverId: serverId,
      },
    });

    if (!channel) {
      return new NextResponse('Channel not found', { status: 404 });
    }

    // If moving to a different section, validate the new section exists
    if (newSectionId && newSectionId !== channel.sectionId) {
      const targetSection = await prisma.section.findUnique({
        where: {
          id: newSectionId,
          serverId: serverId,
        },
      });

      if (!targetSection) {
        return new NextResponse('Target section not found', { status: 404 });
      }
    }

    // Use transaction to ensure consistency
    const result = await prisma.$transaction(async tx => {
      // Get current channels in the target section (or unsectioned)
      const targetChannels = await tx.channel.findMany({
        where: {
          serverId: serverId,
          sectionId: newSectionId || null,
          NOT: {
            id: channelId,
          },
        },
        orderBy: {
          position: 'asc',
        },
      });

      // Update positions of existing channels to make room
      const updates = [];
      for (let i = 0; i < targetChannels.length; i++) {
        const targetChannel = targetChannels[i];
        const newPos = i >= newPosition ? i + 1 : i;

        if (targetChannel.position !== newPos) {
          updates.push(
            tx.channel.update({
              where: { id: targetChannel.id },
              data: { position: newPos },
            })
          );
        }
      }

      // Wait for all position updates
      await Promise.all(updates);

      // Update the moved channel
      const updatedChannel = await tx.channel.update({
        where: { id: channelId },
        data: {
          position: newPosition,
          sectionId: newSectionId || null,
        },
      });

      return updatedChannel;
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Channel reorder error:', error);

    if (error instanceof z.ZodError) {
      return new NextResponse('Invalid input', { status: 400 });
    }

    return new NextResponse('Internal server error', { status: 500 });
  }
}
