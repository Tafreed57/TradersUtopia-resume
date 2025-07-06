import { prisma } from '@/lib/prismadb';
import { getCurrentProfileForAuth } from '@/lib/query';
import { MemberRole } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimitServer, trackSuspiciousActivity } from '@/lib/rate-limit';
import { revalidatePath } from 'next/cache';

export async function POST(req: NextRequest) {
  try {
    // ✅ SECURITY: Rate limiting
    const rateLimitResult = await rateLimitServer()(req);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(req, 'ENSURE_ALL_USERS_RATE_LIMIT_EXCEEDED');
      return rateLimitResult.error;
    }

    const profile = await getCurrentProfileForAuth();
    if (!profile) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // ✅ SECURITY: Only admins can trigger this operation
    if (!profile.isAdmin) {
      trackSuspiciousActivity(req, 'NON_ADMIN_ENSURE_ALL_USERS_ATTEMPT');
      return new NextResponse('Admin access required', { status: 403 });
    }

    const { serverId } = await req.json();

    if (!serverId) {
      return new NextResponse('Server ID is required', { status: 400 });
    }

    // Get all profiles that are not already in the server
    const profilesToSync = await prisma.profile.findMany({
      where: {
        members: {
          none: {
            serverId: serverId,
          },
        },
      },
    });

    if (profilesToSync.length > 0) {
      const newMembers = profilesToSync.map(p => ({
        profileId: p.id,
        serverId: serverId,
        role: p.isAdmin ? MemberRole.ADMIN : MemberRole.GUEST,
      }));

      await prisma.member.createMany({
        data: newMembers,
      });
    }

    revalidatePath(`/servers/${serverId}`);
    return NextResponse.json({
      success: true,
      message: `Synced ${profilesToSync.length} new members.`,
      syncedCount: profilesToSync.length,
    });
  } catch (error: any) {
    console.error('Error ensuring all users in admin servers:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
