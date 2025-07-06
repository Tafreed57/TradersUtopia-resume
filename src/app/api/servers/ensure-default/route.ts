import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prismadb';
import { MemberRole } from '@prisma/client';
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

    // If no admin-owned server, create one
    if (!server) {
      server = await prisma.server.create({
        data: {
          name: 'TradersUtopia HQ',
          imageUrl: '',
          inviteCode: crypto.randomUUID(),
          profileId: profile.id, // Assign to current user for now
          members: {
            create: [{ profileId: profile.id, role: MemberRole.ADMIN }],
          },
        },
      });
    }

    // Ensure the current user is a member of this default server
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
    return new Response('Internal Server Error', { status: 500 });
  }
}
