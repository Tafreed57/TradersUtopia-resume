import { prisma } from '@/lib/prismadb';
import { getCurrentProfileForAuth } from '@/lib/query';
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { revalidatePath } from 'next/cache';
import { rateLimitServer, trackSuspiciousActivity } from '@/lib/rate-limit';
import {
  validateInput,
  serverUpdateSchema,
  cuidSchema,
} from '@/lib/validation';
import { z } from 'zod';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { serverId: string } }
) {
  try {
    // ✅ SECURITY: Rate limiting for server operations
    const rateLimitResult = await rateLimitServer()(req);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(req, 'SERVER_UPDATE_RATE_LIMIT_EXCEEDED');
      return rateLimitResult.error;
    }

    // ✅ SECURITY: Validate server ID parameter
    try {
      cuidSchema.parse(params.serverId);
    } catch (error) {
      trackSuspiciousActivity(req, 'INVALID_SERVER_ID_FORMAT');
      return NextResponse.json(
        { error: 'Invalid server ID format' },
        { status: 400 }
      );
    }

    const profile = await getCurrentProfileForAuth();
    if (!profile) {
      trackSuspiciousActivity(req, 'UNAUTHENTICATED_SERVER_UPDATE');
      return new NextResponse('Unauthorized', { status: 401 });
    }
    if (!params.serverId) {
      return new NextResponse('Server not found', { status: 404 });
    }

    // ✅ SECURITY: Input validation for server update
    const validationResult = await validateInput(serverUpdateSchema)(req);
    if (!validationResult.success) {
      trackSuspiciousActivity(req, 'INVALID_SERVER_UPDATE_INPUT');
      return validationResult.error;
    }

    const { name, imageUrl } = validationResult.data;

    // First, check if the server exists and user has permission to update it
    const existingServer = await prisma.server.findUnique({
      where: { id: params.serverId },
      include: {
        members: {
          where: { profileId: profile.id },
          select: { role: true },
        },
      },
    });

    if (!existingServer) {
      return NextResponse.json({ error: 'Server not found' }, { status: 404 });
    }

    // Check if user is the owner OR an admin OR a server admin/moderator
    const isOwner = existingServer.profileId === profile.id;
    const isGlobalAdmin = profile.isAdmin;
    const serverMember = existingServer.members[0];
    const isServerAdmin =
      serverMember?.role === 'ADMIN' || serverMember?.role === 'MODERATOR';

    if (!isOwner && !isGlobalAdmin && !isServerAdmin) {
      return NextResponse.json(
        { error: 'Insufficient permissions to update this server' },
        { status: 403 }
      );
    }

    const server = await prisma.server.update({
      where: { id: params.serverId },
      data: {
        name,
        imageUrl,
      },
    });

    // ✅ SECURITY: Log successful server update
    console.log(
      `🏰 [SERVER] Server updated successfully by user: ${profile.email} (${profile.id})`
    );
    console.log(`📝 [SERVER] Server name: "${name}", ID: ${params.serverId}`);
    console.log(
      `📍 [SERVER] IP: ${req.headers.get('x-forwarded-for') || 'unknown'}`
    );

    // Revalidate the server layout to reflect changes
    revalidatePath(`/servers/${params.serverId}`, 'layout');

    return NextResponse.json(server);
  } catch (error: any) {
    console.error('❌ [SERVER] Server update error:', error);
    trackSuspiciousActivity(req, 'SERVER_UPDATE_ERROR');

    // ✅ SECURITY: Generic error response - no internal details exposed
    return NextResponse.json(
      {
        error: 'Server update failed',
        message: 'Unable to update server. Please try again later.',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { serverId: string } }
) {
  try {
    // ✅ SECURITY: Rate limiting for server operations
    const rateLimitResult = await rateLimitServer()(req);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(req, 'SERVER_DELETE_RATE_LIMIT_EXCEEDED');
      return rateLimitResult.error;
    }

    // ✅ SECURITY: Validate server ID parameter
    try {
      cuidSchema.parse(params.serverId);
    } catch (error) {
      trackSuspiciousActivity(req, 'INVALID_SERVER_ID_FORMAT_DELETE');
      return NextResponse.json(
        { error: 'Invalid server ID format' },
        { status: 400 }
      );
    }

    const profile = await getCurrentProfileForAuth();
    if (!profile) {
      trackSuspiciousActivity(req, 'UNAUTHENTICATED_SERVER_DELETE');
      return new NextResponse('Unauthorized', { status: 401 });
    }
    if (!params.serverId) {
      return new NextResponse('Server not found', { status: 404 });
    }

    // First, check if the server exists and user has permission to delete it
    const existingServer = await prisma.server.findUnique({
      where: { id: params.serverId },
      include: {
        members: {
          where: { profileId: profile.id },
          select: { role: true },
        },
      },
    });

    if (!existingServer) {
      return NextResponse.json({ error: 'Server not found' }, { status: 404 });
    }

    // Only server owner or global admin can delete servers
    const isOwner = existingServer.profileId === profile.id;
    const isGlobalAdmin = profile.isAdmin;

    if (!isOwner && !isGlobalAdmin) {
      return NextResponse.json(
        { error: 'Insufficient permissions to delete this server' },
        { status: 403 }
      );
    }

    const server = await prisma.server.delete({
      where: { id: params.serverId },
    });

    // ✅ SECURITY: Log successful server deletion
    console.log(
      `🗑️ [SERVER] Server deleted successfully by user: ${profile.email} (${profile.id})`
    );
    console.log(`📝 [SERVER] Deleted server ID: ${params.serverId}`);
    console.log(
      `📍 [SERVER] IP: ${req.headers.get('x-forwarded-for') || 'unknown'}`
    );

    revalidatePath('/(main)', 'layout');
    return NextResponse.json(server);
  } catch (error: any) {
    console.error('❌ [SERVER] Server deletion error:', error);
    trackSuspiciousActivity(req, 'SERVER_DELETE_ERROR');

    // ✅ SECURITY: Generic error response - no internal details exposed
    return NextResponse.json(
      {
        error: 'Server deletion failed',
        message: 'Unable to delete server. Please try again later.',
      },
      { status: 500 }
    );
  }
}
