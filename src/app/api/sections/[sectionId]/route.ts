import { prisma } from '@/lib/prismadb';
import { getCurrentProfile } from '@/lib/query';
import { MemberRole } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimitServer, trackSuspiciousActivity } from '@/lib/rate-limit';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { sectionId: string } }
) {
  try {
    // ✅ SECURITY: Rate limiting for section operations
    const rateLimitResult = await rateLimitServer()(req);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(req, 'SECTION_UPDATE_RATE_LIMIT_EXCEEDED');
      return rateLimitResult.error;
    }

    const profile = await getCurrentProfile();
    const { searchParams } = new URL(req.url);
    const { name } = await req.json();
    const serverId = searchParams.get('serverId');
    const sectionId = params.sectionId;

    if (!profile) {
      trackSuspiciousActivity(req, 'UNAUTHENTICATED_SECTION_UPDATE');
      return new NextResponse('Unauthorized', { status: 401 });
    }

    if (!serverId) {
      trackSuspiciousActivity(req, 'SECTION_UPDATE_NO_SERVER_ID');
      return new NextResponse('Server not found', { status: 404 });
    }

    if (!sectionId) {
      return new NextResponse('Section ID required', { status: 400 });
    }

    if (!name || name.trim().length === 0) {
      return new NextResponse('Section name is required', { status: 400 });
    }

    // Check if user has permission to edit sections (admin/moderator)
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
        { error: 'Insufficient permissions to edit sections' },
        { status: 403 }
      );
    }

    // Verify the section belongs to the server
    const existingSection = await prisma.section.findFirst({
      where: {
        id: sectionId,
        serverId,
      },
    });

    if (!existingSection) {
      return new NextResponse('Section not found', { status: 404 });
    }

    const section = await prisma.section.update({
      where: {
        id: sectionId,
      },
      data: {
        name,
      },
    });

    return NextResponse.json(section);
  } catch (error: any) {
    trackSuspiciousActivity(req, 'SECTION_UPDATE_ERROR');
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { sectionId: string } }
) {
  try {
    // ✅ SECURITY: Rate limiting for section operations
    const rateLimitResult = await rateLimitServer()(req);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(req, 'SECTION_DELETE_RATE_LIMIT_EXCEEDED');
      return rateLimitResult.error;
    }

    const profile = await getCurrentProfile();
    const { searchParams } = new URL(req.url);
    const serverId = searchParams.get('serverId');
    const sectionId = params.sectionId;

    if (!profile) {
      trackSuspiciousActivity(req, 'UNAUTHENTICATED_SECTION_DELETE');
      return new NextResponse('Unauthorized', { status: 401 });
    }

    if (!serverId) {
      trackSuspiciousActivity(req, 'SECTION_DELETE_NO_SERVER_ID');
      return new NextResponse('Server not found', { status: 404 });
    }

    if (!sectionId) {
      return new NextResponse('Section ID required', { status: 400 });
    }

    // Check if user has permission to delete sections (admin/moderator)
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
        { error: 'Insufficient permissions to delete sections' },
        { status: 403 }
      );
    }

    // Verify the section belongs to the server
    const existingSection = await prisma.section.findFirst({
      where: {
        id: sectionId,
        serverId,
      },
    });

    if (!existingSection) {
      return new NextResponse('Section not found', { status: 404 });
    }

    // Move all channels in this section to no section (sectionId = null)
    await prisma.channel.updateMany({
      where: {
        sectionId: sectionId,
      },
      data: {
        sectionId: null,
      },
    });

    // Delete the section
    await prisma.section.delete({
      where: {
        id: sectionId,
      },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error: any) {
    trackSuspiciousActivity(req, 'SECTION_DELETE_ERROR');
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
