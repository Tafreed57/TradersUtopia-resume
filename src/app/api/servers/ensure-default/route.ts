import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

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
    let profile = await db.profile.findFirst({
      where: { userId: user.id },
    });

    if (!profile) {
      const userEmail = user.emailAddresses[0]?.emailAddress;
      if (!userEmail) {
        return NextResponse.json({ error: 'No email found' }, { status: 400 });
      }

      profile = await db.profile.create({
        data: {
          userId: user.id,
          name: `${user.firstName} ${user.lastName}`,
          email: userEmail,
          imageUrl: user.imageUrl,
        },
      });
    }

    // Check if default server exists
    let defaultServer = await db.server.findFirst({
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
      const adminProfile = await db.profile.findFirst({
        where: { isAdmin: true },
      });

      const serverOwner = adminProfile || profile;

      defaultServer = await db.server.create({
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

    // Check if user is already a member
    const existingMembership = await db.member.findFirst({
      where: {
        profileId: profile.id,
        serverId: defaultServer.id,
      },
    });

    if (!existingMembership) {
      // Auto-join user to the default server
      await db.member.create({
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
        await db.member.update({
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

    // Get updated server with all members
    const server = await db.server.findFirst({
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
      message: `Successfully joined ${DEFAULT_SERVER_NAME}!`,
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
