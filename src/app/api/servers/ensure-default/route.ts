import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prismadb';
import { MemberRole, ChannelType } from '@prisma/client';
import { getCurrentProfile } from '@/lib/query';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Find the default server (first server owned by an admin)
    let server = await prisma.server.findFirst({
      where: {
        profile: {
          isAdmin: true,
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // If no admin-owned server exists, create one with all necessary relations
    if (!server) {
      server = await prisma.$transaction(async tx => {
        // Create the server first
        const newServer = await tx.server.create({
          data: {
            name: 'TradersUtopia HQ',
            imageUrl: '/logo.png', // Use default logo
            inviteCode: crypto.randomUUID(),
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

        // Create the default section
        const section = await tx.section.create({
          data: {
            name: 'Text Channels',
            serverId: newServer.id,
            profileId: profile.id,
          },
        });

        // Create the default channel
        await tx.channel.create({
          data: {
            name: 'general',
            type: ChannelType.TEXT,
            position: 0,
            serverId: newServer.id,
            sectionId: section.id,
            profileId: profile.id,
          },
        });

        // Return the server with all relations
        return tx.server.findFirst({
          where: { id: newServer.id },
          include: {
            members: true,
            sections: {
              include: {
                channels: true,
              },
            },
          },
        });
      });

      return Response.json({ success: true, server });
    }

    // If server exists, ensure current user is a member
    const existingMember = await prisma.member.findFirst({
      where: {
        serverId: server.id,
        profileId: profile.id,
      },
    });

    if (!existingMember) {
      await prisma.member.create({
        data: {
          serverId: server.id,
          profileId: profile.id,
          role: profile.isAdmin ? MemberRole.ADMIN : MemberRole.GUEST,
        },
      });
    }

    return Response.json({ success: true, server });
  } catch (error) {
    console.error('[SERVER_CREATE_ERROR]', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
