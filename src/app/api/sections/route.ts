import { prisma } from '@/lib/prismadb';
import { getCurrentProfile } from '@/lib/query';
import { MemberRole } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimitServer, trackSuspiciousActivity } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  try {
    // ✅ SECURITY: Rate limiting for section operations
    const rateLimitResult = await rateLimitServer()(req);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(req, 'SECTION_CREATION_RATE_LIMIT_EXCEEDED');
      return rateLimitResult.error;
    }

    const profile = await getCurrentProfile();
    const { searchParams } = new URL(req.url);
    const { name } = await req.json();
    const serverId = searchParams.get('serverId');

    if (!profile) {
      trackSuspiciousActivity(req, 'UNAUTHENTICATED_SECTION_CREATION');
      return new NextResponse('Unauthorized', { status: 401 });
    }

    if (!serverId) {
      trackSuspiciousActivity(req, 'SECTION_CREATION_NO_SERVER_ID');
      return new NextResponse('Server not found', { status: 404 });
    }

    if (!name || name.trim().length === 0) {
      return new NextResponse('Section name is required', { status: 400 });
    }

    // Check if user has permission to create sections (admin/moderator)
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
        { error: 'Insufficient permissions to create sections' },
        { status: 403 }
      );
    }

    // Get current max position for ordering
    const lastSection = await prisma.section.findFirst({
      where: { serverId },
      orderBy: { position: 'desc' },
    });

    const newPosition = (lastSection?.position || 0) + 1;

    const section = await prisma.section.create({
      data: {
        name,
        serverId,
        profileId: profile.id,
        position: newPosition,
      },
    });

    // ✅ SECURITY: Log successful section creation
    console.log(
      `📂 [SECTION] Section created successfully by user: ${profile.email} (${profile.id})`
    );
    console.log(
      `📝 [SECTION] Section name: "${name}", server: ${serverId}, position: ${newPosition}`
    );

    return NextResponse.json(section);
  } catch (error: any) {
    console.error('❌ [SECTION] Section creation error:', error);
    trackSuspiciousActivity(req, 'SECTION_CREATION_ERROR');
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
