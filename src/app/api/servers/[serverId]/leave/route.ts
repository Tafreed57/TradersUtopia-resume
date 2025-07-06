import { prisma } from '@/lib/prismadb';
import { getCurrentProfile } from '@/lib/query';
import { MemberRole } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { rateLimitServer, trackSuspiciousActivity } from '@/lib/rate-limit';
import { strictCSRFValidation } from '@/lib/csrf';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { serverId: string } }
) {
  try {
    // ✅ SECURITY FIX: Add CSRF protection and rate limiting
    const csrfValid = await strictCSRFValidation(req);
    if (!csrfValid) {
      trackSuspiciousActivity(req, 'LEAVE_SERVER_CSRF_FAILED');
      return NextResponse.json(
        {
          error: 'CSRF validation failed',
          message: 'Invalid security token. Please refresh and try again.',
        },
        { status: 403 }
      );
    }
    const rateLimitResult = await rateLimitServer()(req);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(req, 'LEAVE_SERVER_RATE_LIMIT_EXCEEDED');
      return rateLimitResult.error;
    }

    const profile = await getCurrentProfile();
    if (!profile) {
      return new NextResponse('Unauthorized', { status: 401 });
    }
    if (!params.serverId) {
      return new NextResponse('Server not found', { status: 404 });
    }

    // ✅ UPDATED: Check if user is admin before allowing them to leave
    const member = await prisma.member.findFirst({
      where: {
        profileId: profile.id,
        serverId: params.serverId,
      },
    });

    if (!member) {
      return new NextResponse('Member not found', { status: 404 });
    }

    // ✅ NEW: Only admin users can leave servers
    if (member.role !== MemberRole.ADMIN) {
      return new NextResponse('Only admin users can leave servers', {
        status: 403,
      });
    }

    // ✅ UPDATED: Leave server logic - now only for admin users
    const server = await prisma.server.update({
      where: {
        id: params.serverId,
        profileId: {
          // the owner of the server (admin) can't leave the server
          not: profile.id,
        },
        members: {
          // the user must be a member of the server
          some: {
            profileId: profile.id,
          },
        },
      },
      data: {
        members: {
          deleteMany: {
            profileId: profile.id,
          },
        },
      },
    });

    return NextResponse.json(server);
  } catch (error: any) {
    return new NextResponse('Internal Error', { status: 500 });
  }
}
