import { db } from '@/lib/db';
import { rateLimitAdmin } from '@/lib/rate-limit';
import { detectAndLogDuplicates } from '@/lib/safe-profile-operations';
import { currentUser } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

// Force dynamic rendering due to rate limiting using request.headers
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Rate limiting for admin operations
    const rateLimitResult = await rateLimitAdmin()(request);
    if (!rateLimitResult.success) {
      return rateLimitResult.error;
    }

    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Check if user is admin
    const adminProfile = await db.profile.findFirst({
      where: { userId: user.id, isAdmin: true },
    });

    if (!adminProfile) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Get system statistics
    const totalProfiles = await db.profile.count();
    const totalAdmins = await db.profile.count({
      where: { isAdmin: true },
    });
    const activeSubscriptions = await db.profile.count({
      where: { subscriptionStatus: 'ACTIVE' },
    });

    // Check for duplicates
    const duplicates = await detectAndLogDuplicates();

    // Check for profiles without userId (orphaned profiles)
    const orphanedProfiles = await db.profile.findMany({
      where: {
        userId: '',
      },
      select: { id: true, email: true, createdAt: true },
    });

    // Check for users with multiple profiles
    const allProfiles = await db.profile.findMany({
      select: { userId: true, email: true, id: true },
    });

    const profilesByUserId = allProfiles.reduce(
      (acc, profile) => {
        if (profile.userId) {
          if (!acc[profile.userId]) {
            acc[profile.userId] = [];
          }
          acc[profile.userId].push(profile);
        }
        return acc;
      },
      {} as Record<string, typeof allProfiles>
    );

    const multipleProfileUsers = Object.entries(profilesByUserId).filter(
      ([userId, profiles]) => profiles.length > 1
    );

    const healthStatus = {
      timestamp: new Date().toISOString(),
      system: {
        totalProfiles,
        totalAdmins,
        activeSubscriptions,
        orphanedProfiles: orphanedProfiles.length,
        multipleProfileUsers: multipleProfileUsers.length,
      },
      duplicates: {
        count: duplicates.length,
        emails: duplicates.map(([email, profiles]) => ({
          email,
          profileCount: profiles.length,
          profileIds: profiles.map(p => p.id),
        })),
      },
      issues: {
        orphaned: orphanedProfiles,
        multipleProfiles: multipleProfileUsers.map(([userId, profiles]) => ({
          userId,
          profileCount: profiles.length,
          emails: Array.from(new Set(profiles.map(p => p.email))),
          profileIds: profiles.map(p => p.id),
        })),
      },
      recommendations: [] as string[],
    };

    // Add recommendations based on findings
    if (duplicates.length > 0) {
      healthStatus.recommendations.push(
        `Fix ${duplicates.length} duplicate email groups using the duplicate profile fix tool`
      );
    }

    if (orphanedProfiles.length > 0) {
      healthStatus.recommendations.push(
        `Clean up ${orphanedProfiles.length} orphaned profiles without user IDs`
      );
    }

    if (multipleProfileUsers.length > 0) {
      healthStatus.recommendations.push(
        `Consolidate ${multipleProfileUsers.length} users with multiple profiles`
      );
    }

    if (healthStatus.recommendations.length === 0) {
      healthStatus.recommendations.push('✅ System health looks good!');
    }

    return NextResponse.json(healthStatus);
  } catch (error) {
    //
    return NextResponse.json(
      {
        error: 'Failed to check system health',
        message: 'Unable to retrieve system status. Please try again later.',
      },
      { status: 500 }
    );
  }
}
