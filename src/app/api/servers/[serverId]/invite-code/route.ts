import { prisma } from '@/lib/prismadb';
import { getCurrentProfile } from '@/lib/query';
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
      trackSuspiciousActivity(req, 'INVITE_CODE_CSRF_FAILED');
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
      trackSuspiciousActivity(req, 'INVITE_CODE_RATE_LIMIT_EXCEEDED');
      return rateLimitResult.error;
    }

    const profile = await getCurrentProfile();
    if (!profile) {
      return new NextResponse('Unauthorized', { status: 401 });
    }
    if (!params.serverId) {
      return new NextResponse('Server not found', { status: 404 });
    }

    const server = await prisma.server.update({
      where: {
        id: params.serverId,
        profileId: profile.id,
      },
      data: {
        inviteCode: uuidv4(),
      },
    });

    return NextResponse.json(server);
  } catch (error: any) {
    return new NextResponse('Internal Error', { status: 500 });
  }
}
