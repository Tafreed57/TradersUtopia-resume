import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prismadb';
import { v4 as uuidv4 } from 'uuid';
import { MemberRole } from '@prisma/client';

const DEFAULT_SERVER_NAME = 'Traders Utopia';
const DEFAULT_INVITE_CODE = 'TRADERS-UTOPIA';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const user = await currentUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Find or create the user's profile
    let profile = await prisma.profile.findFirst({
      where: { userId: user.id },
    });

    if (!profile) {
      const userEmail = user.emailAddresses[0]?.emailAddress;
      if (!userEmail) {
        return NextResponse.json({ error: 'No email found' }, { status: 400 });
      }

      profile = await prisma.profile.create({
        data: {
          userId: user.id,
          name: `${user.firstName} ${user.lastName}`,
          email: userEmail,
          imageUrl: user.imageUrl,
        },
      });
    }

    // Check if default server exists
    let defaultServer = await prisma.server.findFirst({
      where: {
        name: DEFAULT_SERVER_NAME,
        inviteCode: DEFAULT_INVITE_CODE,
      },
      include: {
        members: true,
        channels: true,
      },
    });

    // Create default server if it doesn't exist
    if (!defaultServer) {
      console.log(`🏗️ Creating default server: ${DEFAULT_SERVER_NAME}`);

      // Find the first admin user to be the server owner, or use current profile
      const adminProfile = await prisma.profile.findFirst({
        where: { isAdmin: true },
      });

      const serverOwner = adminProfile || profile;

      defaultServer = await prisma.server.create({
        data: {
          name: DEFAULT_SERVER_NAME,
          imageUrl: null,
          inviteCode: DEFAULT_INVITE_CODE,
          profileId: serverOwner.id,
          channels: {
            create: [
              {
                name: 'general',
                profileId: serverOwner.id,
                type: 'TEXT',
              },
              {
                name: 'announcements',
                profileId: serverOwner.id,
                type: 'TEXT',
              },
              {
                name: 'trading-discussion',
                profileId: serverOwner.id,
                type: 'TEXT',
              },
            ],
          },
          members: {
            create: {
              profileId: serverOwner.id,
              role: 'ADMIN',
            },
          },
        },
        include: {
          members: true,
          channels: true,
        },
      });

      console.log(
        `✅ Created default server with ${defaultServer.channels.length} channels`
      );
    }

    // Check if user is already a member of default server
    const existingMembership = await prisma.member.findFirst({
      where: {
        profileId: profile.id,
        serverId: defaultServer.id,
      },
    });

    if (!existingMembership) {
      // Auto-join user to the default server
      await prisma.member.create({
        data: {
          profileId: profile.id,
          serverId: defaultServer.id,
          role: profile.isAdmin ? 'ADMIN' : 'GUEST',
        },
      });

      console.log(
        `👥 Auto-joined user ${profile.email} to ${DEFAULT_SERVER_NAME} as ${profile.isAdmin ? 'ADMIN' : 'GUEST'}`
      );
    } else {
      // ✅ UPDATE: Check if existing member needs role upgrade based on global admin status
      const currentRole = existingMembership.role;
      const expectedRole = profile.isAdmin ? 'ADMIN' : 'GUEST';

      if (currentRole !== expectedRole) {
        await prisma.member.update({
          where: {
            id: existingMembership.id,
          },
          data: {
            role: expectedRole,
          },
        });

        console.log(
          `🔄 Updated user ${profile.email} role in ${DEFAULT_SERVER_NAME} from ${currentRole} to ${expectedRole}`
        );
      }
    }

    // ✅ NEW: Auto-join user to ALL admin-created servers
    console.log(
      `🔍 Checking if user ${profile.email} needs to join admin-created servers...`
    );

    const adminServers = await prisma.server.findMany({
      where: {
        profile: {
          isAdmin: true,
        },
        id: {
          not: defaultServer.id, // Exclude default server (already handled above)
        },
      },
      include: {
        members: {
          where: {
            profileId: profile.id,
          },
        },
      },
    });

    let serversJoined = 0;
    for (const server of adminServers) {
      // If user is not already a member, add them
      if (server.members.length === 0) {
        await prisma.member.create({
          data: {
            profileId: profile.id,
            serverId: server.id,
            role: profile.isAdmin ? MemberRole.ADMIN : MemberRole.GUEST,
          },
        });

        serversJoined++;
        console.log(
          `✅ Auto-joined user ${profile.email} to admin server "${server.name}" as ${profile.isAdmin ? 'ADMIN' : 'GUEST'}`
        );
      }
    }

    if (serversJoined > 0) {
      console.log(
        `🎉 User ${profile.email} joined ${serversJoined} additional admin-created servers!`
      );
    }

    // Get updated server with all members
    const server = await prisma.server.findFirst({
      where: { id: defaultServer.id },
      include: {
        channels: {
          orderBy: {
            createdAt: 'asc',
          },
        },
        members: {
          include: {
            profile: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      server: server,
      serversJoined: serversJoined + 1, // +1 for default server
      message: `Successfully joined ${DEFAULT_SERVER_NAME}${serversJoined > 0 ? ` and ${serversJoined} other admin servers` : ''}!`,
    });
  } catch (error) {
    console.error('Error ensuring default server:', error);

    // ✅ SECURITY: Generic error response - no internal details exposed
    return NextResponse.json(
      {
        error: 'Failed to ensure default server',
        message: 'Unable to set up default server. Please try again later.',
      },
      { status: 500 }
    );
  }
}
