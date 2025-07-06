import { prisma } from '@/lib/prismadb';
import { getCurrentProfile } from '@/lib/query';
import { MemberRole } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimitServer, trackSuspiciousActivity } from '@/lib/rate-limit';
import { z } from 'zod';

const sectionCreationSchema = z.object({
  name: z.string().min(1, 'Section name is required').max(100),
});

export async function POST(req: NextRequest) {
  try {
    // ✅ SECURITY: Rate limiting for section operations
    const rateLimitResult = await rateLimitServer()(req);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(req, 'SECTION_CREATION_RATE_LIMIT_EXCEEDED');
      return rateLimitResult.error;
    }

    const profile = await getCurrentProfile();
    if (!profile) {
      trackSuspiciousActivity(req, 'UNAUTHENTICATED_SECTION_CREATION');
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const serverId = searchParams.get('serverId');
    if (!serverId) {
      trackSuspiciousActivity(req, 'SECTION_CREATION_NO_SERVER_ID');
      return new NextResponse('Server not found', { status: 404 });
    }

    // ✅ SECURITY: Input validation with Zod
    const body = await req.json();
    const validationResult = sectionCreationSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', issues: validationResult.error.issues },
        { status: 400 }
      );
    }
    const { name } = validationResult.data;

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

    return NextResponse.json(section);
  } catch (error: any) {
    trackSuspiciousActivity(req, 'SECTION_CREATION_ERROR');
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
