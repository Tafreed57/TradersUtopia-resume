import { prisma } from '@/lib/prismadb';
import { getCurrentProfile } from '@/lib/query';
import { MemberRole } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimitServer, trackSuspiciousActivity } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  try {
    // ✅ SECURITY: Rate limiting
    const rateLimitResult = await rateLimitServer()(req);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(req, 'ENSURE_ALL_USERS_RATE_LIMIT_EXCEEDED');
      return rateLimitResult.error;
    }

    const profile = await getCurrentProfile();
    if (!profile) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // ✅ SECURITY: Only admins can trigger this operation
    if (!profile.isAdmin) {
      trackSuspiciousActivity(req, 'NON_ADMIN_ENSURE_ALL_USERS_ATTEMPT');
      return new NextResponse('Admin access required', { status: 403 });
    }

    console.log(
      `🔄 [SERVER] Admin ${profile.email} is ensuring all users are in all admin-created servers...`
    );

    // Get all servers created by admins
    const adminServers = await prisma.server.findMany({
      where: {
        profile: {
          isAdmin: true,
        },
      },
      include: {
        members: {
          select: {
            profileId: true,
          },
        },
        profile: {
          select: {
            email: true,
            isAdmin: true,
          },
        },
      },
    });

    // Get all user profiles
    const allProfiles = await prisma.profile.findMany({
      select: {
        id: true,
        email: true,
        isAdmin: true,
      },
    });

    let totalAdded = 0;
    const results = [];

    // For each admin-created server, ensure all users are members
    for (const server of adminServers) {
      const existingMemberIds = server.members.map(m => m.profileId);
      const missingUsers = allProfiles.filter(
        p => !existingMemberIds.includes(p.id)
      );

      if (missingUsers.length > 0) {
        const memberData = missingUsers.map(userProfile => ({
          profileId: userProfile.id,
          serverId: server.id,
          role: userProfile.isAdmin ? MemberRole.ADMIN : MemberRole.GUEST,
        }));

        await prisma.member.createMany({
          data: memberData,
          skipDuplicates: true,
        });

        totalAdded += missingUsers.length;
        results.push({
          serverId: server.id,
          serverName: server.name,
          addedCount: missingUsers.length,
          addedUsers: missingUsers.map(u => u.email),
        });

        console.log(
          `✅ [SERVER] Added ${missingUsers.length} users to server "${server.name}"`
        );
      } else {
        results.push({
          serverId: server.id,
          serverName: server.name,
          addedCount: 0,
          message: 'All users already members',
        });
      }
    }

    console.log(
      `🎉 [SERVER] Operation complete! Added ${totalAdded} total memberships across ${adminServers.length} admin servers`
    );

    return NextResponse.json({
      success: true,
      totalServersProcessed: adminServers.length,
      totalMembershipsAdded: totalAdded,
      details: results,
      message: `Successfully ensured all ${allProfiles.length} users are members of all ${adminServers.length} admin-created servers`,
    });
  } catch (error: any) {
    console.error('Error ensuring all users in admin servers:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
