import { prisma } from '@/lib/prismadb';
import { getCurrentProfile } from '@/lib/query';
import { MemberRole } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { rateLimitServer, trackSuspiciousActivity } from '@/lib/rate-limit';
import { validateInput, serverCreationSchema } from '@/lib/validation';
import { currentUser } from '@clerk/nextjs/server';

// Force dynamic rendering due to rate limiting using request.headers
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // ✅ SECURITY: Rate limiting for server operations
    const rateLimitResult = await rateLimitServer()(req);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(req, 'SERVER_CREATION_RATE_LIMIT_EXCEEDED');
      return rateLimitResult.error;
    }

    // ✅ SECURITY: Input validation for server creation
    const validationResult = await validateInput(serverCreationSchema)(req);
    if (!validationResult.success) {
      trackSuspiciousActivity(req, 'INVALID_SERVER_CREATION_INPUT');
      return validationResult.error;
    }

    const { name, imageUrl } = validationResult.data;
    const profile = await getCurrentProfile();
    if (!profile) {
      trackSuspiciousActivity(req, 'UNAUTHENTICATED_SERVER_CREATION');
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const server = await prisma.server.create({
      data: {
        profileId: profile.id,
        name,
        imageUrl,
        inviteCode: uuidv4(),
        channels: {
          create: [{ name: 'general', profileId: profile.id }],
        },
        members: {
          create: [{ role: MemberRole.ADMIN, profileId: profile.id }],
        },
      },
    });

    // ✅ SECURITY: Log successful server creation
    console.log(
      `🏰 [SERVER] Server created successfully by user: ${profile.email} (${profile.id})`
    );
    console.log(`📝 [SERVER] Server name: "${name}", ID: ${server.id}`);
    console.log(
      `📍 [SERVER] IP: ${req.headers.get('x-forwarded-for') || 'unknown'}`
    );

    return NextResponse.json(server);
  } catch (error: any) {
    console.log(error, 'SERVERS API ERROR');
    return new NextResponse('Internal Error', { status: 500 });
  }
}
