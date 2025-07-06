import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { rateLimitServer, trackSuspiciousActivity } from '@/lib/rate-limit';
import { strictCSRFValidation } from '@/lib/csrf';
import { safeGrantAdmin } from '@/lib/safe-profile-operations';
import { MemberRole } from '@prisma/client';

export async function POST(request: NextRequest) {
  try {
    // CSRF protection for admin operations
    const csrfValid = await strictCSRFValidation(request);
    if (!csrfValid) {
      trackSuspiciousActivity(request, 'ADMIN_TOGGLE_CSRF_VALIDATION_FAILED');
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
      trackSuspiciousActivity(request, 'ADMIN_TOGGLE_RATE_LIMIT_EXCEEDED');
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
      trackSuspiciousActivity(request, 'NON_ADMIN_TOGGLE_ATTEMPT');
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    const { userId, grantAdmin } = await request.json();

    if (!userId || typeof grantAdmin !== 'boolean') {
      return NextResponse.json(
        { error: 'User ID and grantAdmin boolean are required' },
        { status: 400 }
      );
    }

    // Prevent self-modification (admins can't revoke their own admin status)
    if (userId === user.id) {
      return NextResponse.json(
        { error: 'Cannot modify your own admin status' },
        { status: 400 }
      );
    }

    // Find the target user
    const targetProfile = await db.profile.findFirst({
      where: { userId },
    });

    if (!targetProfile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const action = grantAdmin ? 'granting' : 'revoking';
    const actionPast = grantAdmin ? 'granted' : 'revoked';

    // Use safe admin granting to handle potential duplicates
    if (grantAdmin) {
      const success = await safeGrantAdmin(userId);
      if (!success) {
        return NextResponse.json(
          {
            error: 'Failed to grant admin access',
            message: 'Unable to update user profiles. Please try again.',
          },
          { status: 500 }
        );
      }

      // ✅ NEW: Update ALL existing server memberships to ADMIN role
      console.log(
        `🔄 [ADMIN] Updating ALL server memberships to ADMIN role for ${targetProfile.email}...`
      );

      const updatedMemberships = await db.member.updateMany({
        where: {
          profileId: targetProfile.id,
          role: {
            not: MemberRole.ADMIN, // Only update non-admin roles
          },
        },
        data: {
          role: MemberRole.ADMIN,
        },
      });

      console.log(
        `✅ [ADMIN] Updated ${updatedMemberships.count} server memberships to ADMIN role for ${targetProfile.email}`
      );

      // ✅ NEW: Auto-join user to ALL admin-created servers as ADMIN
      const adminServers = await db.server.findMany({
        where: {
          profile: {
            isAdmin: true,
          },
        },
        include: {
          members: {
            where: {
              profileId: targetProfile.id,
            },
          },
        },
      });

      let serversJoined = 0;
      for (const server of adminServers) {
        // If user is not already a member, add them as ADMIN
        if (server.members.length === 0) {
          await db.member.create({
            data: {
              profileId: targetProfile.id,
              serverId: server.id,
              role: MemberRole.ADMIN,
            },
          });
          serversJoined++;
        }
      }

      if (serversJoined > 0) {
        console.log(
          `✅ [ADMIN] Auto-joined ${targetProfile.email} to ${serversJoined} admin-created servers as ADMIN`
        );
      }
    } else {
      // For revoking, update all profiles for this user
      await db.profile.updateMany({
        where: { userId },
        data: {
          isAdmin: false,
          updatedAt: new Date(),
        },
      });

      // ✅ NEW: Update ALL existing server memberships to GUEST role when revoking admin
      console.log(
        `🔄 [ADMIN] Updating ALL server memberships to GUEST role for ${targetProfile.email}...`
      );

      const updatedMemberships = await db.member.updateMany({
        where: {
          profileId: targetProfile.id,
          role: {
            not: MemberRole.GUEST, // Only update non-guest roles
          },
        },
        data: {
          role: MemberRole.GUEST,
        },
      });

      console.log(
        `✅ [ADMIN] Updated ${updatedMemberships.count} server memberships to GUEST role for ${targetProfile.email}`
      );
    }

    return NextResponse.json({
      success: true,
      message: `Admin privileges ${actionPast} successfully`,
      updatedUser: {
        userId: targetProfile.userId,
        email: targetProfile.email,
        name: targetProfile.name,
        isAdmin: grantAdmin,
        action: actionPast,
      },
    });
  } catch (error) {
    trackSuspiciousActivity(request, 'ADMIN_TOGGLE_ERROR');

    return NextResponse.json(
      {
        error: 'Failed to update admin status',
        message: 'Unable to modify admin privileges. Please try again later.',
      },
      { status: 500 }
    );
  }
}
