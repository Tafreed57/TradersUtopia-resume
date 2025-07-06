import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { rateLimitServer, trackSuspiciousActivity } from '@/lib/rate-limit';
import { strictCSRFValidation } from '@/lib/csrf';
import { MemberRole } from '@prisma/client';

export async function POST(request: NextRequest) {
  try {
    // CSRF protection for admin operations
    const csrfValid = await strictCSRFValidation(request);
    if (!csrfValid) {
      trackSuspiciousActivity(
        request,
        'UPDATE_SERVER_ROLES_CSRF_VALIDATION_FAILED'
      );
      return NextResponse.json(
        {
          error: 'CSRF validation failed',
          message: 'Invalid security token. Please refresh and try again.',
        },
        { status: 403 }
      );
    }

    // Rate limiting for admin operations
    const rateLimitResult = await rateLimitServer()(request);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(
        request,
        'UPDATE_SERVER_ROLES_RATE_LIMIT_EXCEEDED'
      );
      return rateLimitResult.error;
    }

    const user = await currentUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Find the admin's profile and check admin status
    const adminProfile = await db.profile.findFirst({
      where: { userId: user.id },
    });

    if (!adminProfile || !adminProfile.isAdmin) {
      trackSuspiciousActivity(request, 'NON_ADMIN_UPDATE_SERVER_ROLES_ATTEMPT');
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    console.log(
      `🔄 [ADMIN] Admin ${adminProfile.email} is updating ALL server roles for ALL global admins...`
    );

    // Get all global admins
    const allAdmins = await db.profile.findMany({
      where: { isAdmin: true },
      select: { id: true, email: true, name: true },
    });

    console.log(
      `👑 [ADMIN] Found ${allAdmins.length} global admins to update server roles for`
    );

    let totalUpdated = 0;
    let totalJoined = 0;
    const results = [];

    for (const admin of allAdmins) {
      // Update ALL existing server memberships to ADMIN role
      const updatedMemberships = await db.member.updateMany({
        where: {
          profileId: admin.id,
          role: {
            not: MemberRole.ADMIN, // Only update non-admin roles
          },
        },
        data: {
          role: MemberRole.ADMIN,
        },
      });

      totalUpdated += updatedMemberships.count;

      // Auto-join admin to ALL admin-created servers as ADMIN
      const adminServers = await db.server.findMany({
        where: {
          profile: {
            isAdmin: true,
          },
        },
        include: {
          members: {
            where: {
              profileId: admin.id,
            },
          },
        },
      });

      let serversJoined = 0;
      for (const server of adminServers) {
        // If admin is not already a member, add them as ADMIN
        if (server.members.length === 0) {
          await db.member.create({
            data: {
              profileId: admin.id,
              serverId: server.id,
              role: MemberRole.ADMIN,
            },
          });
          serversJoined++;
        }
      }

      totalJoined += serversJoined;

      results.push({
        admin: {
          email: admin.email,
          name: admin.name,
        },
        rolesUpdated: updatedMemberships.count,
        serversJoined: serversJoined,
      });

      console.log(
        `✅ [ADMIN] Updated ${updatedMemberships.count} server roles and joined ${serversJoined} servers for ${admin.email}`
      );
    }

    console.log(
      `🎉 [ADMIN] Successfully updated ${totalUpdated} server roles and joined ${totalJoined} servers for ${allAdmins.length} global admins`
    );

    return NextResponse.json({
      success: true,
      message: `Successfully updated server roles for all ${allAdmins.length} global admins`,
      summary: {
        totalAdmins: allAdmins.length,
        totalRolesUpdated: totalUpdated,
        totalServersJoined: totalJoined,
      },
      details: results,
    });
  } catch (error) {
    console.error('Error updating server roles:', error);
    trackSuspiciousActivity(request, 'UPDATE_SERVER_ROLES_ERROR');

    return NextResponse.json(
      {
        error: 'Failed to update server roles',
        message: 'Unable to update server roles. Please try again later.',
      },
      { status: 500 }
    );
  }
}
