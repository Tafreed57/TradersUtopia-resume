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
  // ✅ DISABLED: Leave server functionality has been disabled
  return NextResponse.json(
    {
      error: 'Leave server disabled',
      message: 'Leave server functionality has been disabled for all users.',
    },
    { status: 403 }
  );
}
