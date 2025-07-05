import { prisma } from '@/lib/prismadb';
import { getCurrentProfile } from '@/lib/query';
import { MemberRole } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimitServer, trackSuspiciousActivity } from '@/lib/rate-limit';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { serverId: string } }
) {
  try {
    // ✅ SECURITY: Rate limiting for server operations
    const rateLimitResult = await rateLimitServer()(req);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(
        req,
        'DEFAULT_SECTION_UPDATE_RATE_LIMIT_EXCEEDED'
      );
      return rateLimitResult.error;
    }

    const profile = await getCurrentProfile();
    const { defaultSectionName } = await req.json();
    const serverId = params.serverId;

    if (!profile) {
      trackSuspiciousActivity(req, 'UNAUTHENTICATED_DEFAULT_SECTION_UPDATE');
      return new NextResponse('Unauthorized', { status: 401 });
    }

    if (!serverId) {
      trackSuspiciousActivity(req, 'DEFAULT_SECTION_UPDATE_NO_SERVER_ID');
      return new NextResponse('Server not found', { status: 404 });
    }

    if (!defaultSectionName || defaultSectionName.trim().length === 0) {
      return new NextResponse('Default section name is required', {
        status: 400,
      });
    }

    // Check if user has permission to edit server settings (admin/moderator)
    const serverMember = await prisma.member.findFirst({
      where: {
        serverId,
        profileId: profile.id,
        role: {
          in: [MemberRole.ADMIN, MemberRole.MODERATOR],
        },
      },
    });

    if (!serverMember && !profile.isAdmin) {
      return NextResponse.json(
        { error: 'Insufficient permissions to edit server settings' },
        { status: 403 }
      );
    }

    // Verify the server exists and user has access
    const existingServer = await prisma.server.findFirst({
      where: {
        id: serverId,
        members: {
          some: {
            profileId: profile.id,
          },
        },
      },
    });

    if (!existingServer) {
      return new NextResponse('Server not found', { status: 404 });
    }

    const server = await prisma.server.update({
      where: {
        id: serverId,
      },
      data: {
        defaultSectionName: defaultSectionName.trim(),
      },
    });

    // ✅ SECURITY: Log successful default section update
    console.log(
      `📂 [DEFAULT_SECTION] Default section updated successfully by user: ${profile.email} (${profile.id})`
    );
    console.log(
      `📝 [DEFAULT_SECTION] Default section renamed to "${defaultSectionName}", server: ${serverId}`
    );

    return NextResponse.json(server);
  } catch (error: any) {
    console.error('❌ [DEFAULT_SECTION] Default section update error:', error);
    trackSuspiciousActivity(req, 'DEFAULT_SECTION_UPDATE_ERROR');
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
