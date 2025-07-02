import { prisma } from '@/lib/prismadb';
import { getCurrentProfile } from '@/lib/query';
import { MemberRole } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { rateLimitServer, trackSuspiciousActivity } from '@/lib/rate-limit';
import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/db';

// Force dynamic rendering due to rate limiting using request.headers
export const dynamic = 'force-dynamic';

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
    const { name, type } = await req.json();
    const serverId = searchParams.get('serverId');

    if (!profile) {
      trackSuspiciousActivity(req, 'UNAUTHENTICATED_CHANNEL_CREATION');
      return new NextResponse('Unauthorized', { status: 401 });
    }
    if (!serverId) {
      trackSuspiciousActivity(req, 'CHANNEL_CREATION_NO_SERVER_ID');
      return new NextResponse('Server not found', { status: 404 });
    }
    if (name === 'general') {
      return new NextResponse("Channel name can't be 'general'", {
        status: 400,
      });
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
          },
        },
      },
    });

    // ✅ SECURITY: Log successful channel creation
    console.log(
      `📢 [CHANNEL] Channel created successfully by user: ${profile.email} (${profile.id})`
    );
    console.log(
      `📝 [CHANNEL] Channel name: "${name}", type: ${type}, server: ${serverId}`
    );
    console.log(
      `📍 [CHANNEL] IP: ${req.headers.get('x-forwarded-for') || 'unknown'}`
    );

    return NextResponse.json(server);
  } catch (error: any) {
    console.log(error, 'MEMBER ID  API ERROR');
    return new NextResponse('Internal Error', { status: 500 });
  }
}
