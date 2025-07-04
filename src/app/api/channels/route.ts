import { prisma } from '@/lib/prismadb';
import { getCurrentProfile } from '@/lib/query';
import { MemberRole } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { rateLimitServer, trackSuspiciousActivity } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  try {
    // ✅ SECURITY: Rate limiting for channel operations
    const rateLimitResult = await rateLimitServer()(req);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(req, 'CHANNEL_CREATION_RATE_LIMIT_EXCEEDED');
      return rateLimitResult.error;
    }

    const profile = await getCurrentProfile();
    const { searchParams } = new URL(req.url);
    const { name, type, sectionId } = await req.json();
    const serverId = searchParams.get('serverId');

    if (!profile) {
      trackSuspiciousActivity(req, 'UNAUTHENTICATED_CHANNEL_CREATION');
      return new NextResponse('Unauthorized', { status: 401 });
    }
    if (!serverId) {
      trackSuspiciousActivity(req, 'CHANNEL_CREATION_NO_SERVER_ID');
      return new NextResponse('Server not found', { status: 404 });
    }

    // ✅ NEW: Validate section if provided
    if (sectionId) {
      const section = await prisma.section.findFirst({
        where: {
          id: sectionId,
          serverId,
        },
      });

      if (!section) {
        return new NextResponse('Section not found', { status: 400 });
      }
    }

    // ✅ NEW: Get position for ordering within section or server
    let position = 0;
    if (sectionId) {
      const lastChannelInSection = await prisma.channel.findFirst({
        where: { sectionId },
        orderBy: { position: 'desc' },
      });
      position = (lastChannelInSection?.position || 0) + 1;
    } else {
      const lastChannel = await prisma.channel.findFirst({
        where: { serverId, sectionId: null },
        orderBy: { position: 'desc' },
      });
      position = (lastChannel?.position || 0) + 1;
    }

    const server = await prisma.server.update({
      where: {
        id: serverId,
        members: {
          some: {
            profileId: profile.id,
            role: {
              in: [MemberRole.ADMIN, MemberRole.MODERATOR],
            },
          },
        },
      },
      data: {
        channels: {
          create: {
            profileId: profile.id,
            name,
            type,
            sectionId: sectionId || null,
            position,
          },
        },
      },
    });

    // ✅ SECURITY: Log successful channel creation
    console.log(
      `📢 [CHANNEL] Channel created successfully by user: ${profile.email} (${profile.id})`
    );
    console.log(
      `📝 [CHANNEL] Channel name: "${name}", type: ${type}, section: ${sectionId || 'none'}, server: ${serverId}, position: ${position}`
    );
    console.log(
      `📍 [CHANNEL] IP: ${req.headers.get('x-forwarded-for') || 'unknown'}`
    );

    return NextResponse.json(server);
  } catch (error: any) {
    console.log(error, 'CHANNEL CREATION API ERROR');
    return new NextResponse('Internal Error', { status: 500 });
  }
}
