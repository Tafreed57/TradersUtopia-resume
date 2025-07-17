import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prismadb';
import { MemberRole, ChannelType } from '@prisma/client';
import { getCurrentProfile } from '@/lib/query';
import { randomUUID } from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return new Response('Unauthorized', { status: 401 });
    }

    // First, try to find any server the user is already a member of
    let server = await prisma.server.findFirst({
      where: {
        members: {
          some: {
            profileId: profile.id,
          },
        },
      },
      include: {
        channels: {
          orderBy: {
            position: 'asc',
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    if (server) {
      return Response.json({ success: true, server });
    }

    // If user is not a member of any server, find the main server and add them
    server = await prisma.server.findFirst({
      where: {
        OR: [
          { name: 'TradersUtopia HQ' },
          { name: { contains: 'TradersUtopia' } },
        ],
      },
      include: {
        channels: {
          orderBy: {
            position: 'asc',
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    if (server) {
      // Check if user is already a member
      const existingMember = await prisma.member.findFirst({
        where: {
          serverId: server.id,
          profileId: profile.id,
        },
      });

      if (!existingMember) {
        // Add user as member
        await prisma.member.create({
          data: {
            serverId: server.id,
            profileId: profile.id,
            role: profile.isAdmin ? MemberRole.ADMIN : MemberRole.GUEST,
          },
        });
      }

      return Response.json({ success: true, server });
    }

    // If no server exists, create the main server
    server = await prisma.$transaction(async tx => {
      // Create the server first
      const newServer = await tx.server.create({
        data: {
          name: 'TradersUtopia HQ',
          imageUrl: '/logo.png',
          inviteCode: randomUUID(),
          profileId: profile.id,
        },
      });

      // Create the member relationship
      await tx.member.create({
        data: {
          serverId: newServer.id,
          profileId: profile.id,
          role: profile.isAdmin ? MemberRole.ADMIN : MemberRole.GUEST,
        },
      });

      // Create the default general channel
      await tx.channel.create({
        data: {
          name: 'general',
          type: ChannelType.TEXT,
          position: 0,
          serverId: newServer.id,
          profileId: profile.id,
        },
      });

      // Return the server with channels
      return tx.server.findFirst({
        where: { id: newServer.id },
        include: {
          channels: {
            orderBy: {
              position: 'asc',
            },
          },
        },
      });
    });

    return Response.json({ success: true, server });
  } catch (error) {
    console.error('[SERVER_CREATE_ERROR]', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
