import { prisma } from '@/lib/prismadb';
import { getCurrentProfileForAuth } from '@/lib/query';
import { MemberRole } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { rateLimitServer, trackSuspiciousActivity } from '@/lib/rate-limit';
import { validateInput, channelSchema, cuidSchema } from '@/lib/validation';

// Force dynamic rendering due to rate limiting using request.headers
export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { channelId: string } }
) {
  try {
    // ✅ SECURITY: Rate limiting for channel operations
    const rateLimitResult = await rateLimitServer()(req);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(req, 'CHANNEL_UPDATE_RATE_LIMIT_EXCEEDED');
      return rateLimitResult.error;
    }

    // ✅ SECURITY: Validate channel ID parameter
    try {
      cuidSchema.parse(params.channelId);
    } catch (error) {
      trackSuspiciousActivity(req, 'INVALID_CHANNEL_ID_FORMAT');
      return NextResponse.json(
        { error: 'Invalid channel ID format' },
        { status: 400 }
      );
    }

    const profile = await getCurrentProfileForAuth();
    const { searchParams } = new URL(req.url);
    const serverId = searchParams.get('serverId');

    // ✅ SECURITY: Validate server ID from query params
    if (!serverId) {
      trackSuspiciousActivity(req, 'MISSING_SERVER_ID_CHANNEL_UPDATE');
      return NextResponse.json(
        { error: 'Server ID is required' },
        { status: 400 }
      );
    }

    try {
      cuidSchema.parse(serverId);
    } catch (error) {
      trackSuspiciousActivity(req, 'INVALID_SERVER_ID_FORMAT_CHANNEL');
      return NextResponse.json(
        { error: 'Invalid server ID format' },
        { status: 400 }
      );
    }

    // ✅ SECURITY: Input validation for channel update
    const validationResult = await validateInput(channelSchema)(req);
    if (!validationResult.success) {
      trackSuspiciousActivity(req, 'INVALID_CHANNEL_UPDATE_INPUT');
      return validationResult.error;
    }

    const { name, type } = validationResult.data;

    if (!profile) {
      trackSuspiciousActivity(req, 'UNAUTHENTICATED_CHANNEL_UPDATE');
      return new NextResponse('Unauthorized', { status: 401 });
    }
    if (!params.channelId) {
      trackSuspiciousActivity(req, 'MISSING_CHANNEL_ID');
      return new NextResponse('Channel not found', { status: 404 });
    }

    // ✅ ENHANCEMENT: Check if channel exists and get current name
    const existingChannel = await prisma.channel.findUnique({
      where: { id: params.channelId },
      select: { id: true, name: true, serverId: true },
    });

    if (!existingChannel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    }

    // Check permissions: server member with admin/moderator role OR global admin
    const serverMember = await prisma.member.findFirst({
      where: {
        serverId: serverId,
        profileId: profile.id,
        role: {
          in: [MemberRole.ADMIN, MemberRole.MODERATOR],
        },
      },
    });

    if (!serverMember && !profile.isAdmin) {
      return NextResponse.json(
        { error: 'Insufficient permissions to update this channel' },
        { status: 403 }
      );
    }

    // ✅ UPDATED: Allow renaming the general channel now
    // Note: Removed the restriction that prevented renaming general channel

    // ✅ UPDATED: Allow editing of any channel including general
    const server = await prisma.server.update({
      where: { id: serverId },
      data: {
        channels: {
          update: {
            where: {
              id: params.channelId,
            },
            data: {
              name,
              type,
            },
          },
        },
      },
    });

    // ✅ SECURITY: Log successful channel update
    console.log(
      `📢 [CHANNEL] Channel updated successfully by user: ${profile.email} (${profile.id})`
    );
    console.log(
      `📝 [CHANNEL] Channel ID: ${params.channelId}, Name: "${existingChannel.name}" → "${name}", Type: ${type}, Server: ${serverId}`
    );

    return NextResponse.json(server);
  } catch (error: any) {
    console.error('❌ [CHANNEL] Channel update error:', error);
    trackSuspiciousActivity(req, 'CHANNEL_UPDATE_ERROR');

    // ✅ SECURITY: Generic error response - no internal details exposed
    return NextResponse.json(
      {
        error: 'Channel update failed',
        message: 'Unable to update channel. Please try again later.',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { channelId: string } }
) {
  try {
    // ✅ SECURITY: Rate limiting for channel operations
    const rateLimitResult = await rateLimitServer()(req);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(req, 'CHANNEL_DELETE_RATE_LIMIT_EXCEEDED');
      return rateLimitResult.error;
    }

    // ✅ SECURITY: Validate channel ID parameter
    try {
      cuidSchema.parse(params.channelId);
    } catch (error) {
      trackSuspiciousActivity(req, 'INVALID_CHANNEL_ID_FORMAT_DELETE');
      return NextResponse.json(
        { error: 'Invalid channel ID format' },
        { status: 400 }
      );
    }

    const profile = await getCurrentProfileForAuth();
    const { searchParams } = new URL(req.url);
    const serverId = searchParams.get('serverId');

    // ✅ SECURITY: Validate server ID from query params
    if (!serverId) {
      trackSuspiciousActivity(req, 'MISSING_SERVER_ID_CHANNEL_DELETE');
      return NextResponse.json(
        { error: 'Server ID is required' },
        { status: 400 }
      );
    }

    try {
      cuidSchema.parse(serverId);
    } catch (error) {
      trackSuspiciousActivity(req, 'INVALID_SERVER_ID_FORMAT_CHANNEL_DELETE');
      return NextResponse.json(
        { error: 'Invalid server ID format' },
        { status: 400 }
      );
    }

    if (!profile) {
      trackSuspiciousActivity(req, 'UNAUTHENTICATED_CHANNEL_DELETE');
      return new NextResponse('Unauthorized', { status: 401 });
    }
    if (!params.channelId) {
      trackSuspiciousActivity(req, 'MISSING_CHANNEL_ID_DELETE');
      return new NextResponse('Channel not found', { status: 404 });
    }

    // Check permissions: server member with admin/moderator role OR global admin
    const serverMember = await prisma.member.findFirst({
      where: {
        serverId: serverId,
        profileId: profile.id,
        role: {
          in: [MemberRole.ADMIN, MemberRole.MODERATOR],
        },
      },
    });

    if (!serverMember && !profile.isAdmin) {
      return NextResponse.json(
        { error: 'Insufficient permissions to delete this channel' },
        { status: 403 }
      );
    }

    // ✅ UPDATED: Allow deletion of ANY channel including general
    const server = await prisma.server.update({
      where: { id: serverId },
      data: {
        channels: {
          delete: {
            id: params.channelId,
            // ✅ REMOVED: name restriction - can now delete general channel
          },
        },
      },
    });

    // ✅ SECURITY: Log successful channel deletion
    console.log(
      `🗑️ [CHANNEL] Channel deleted successfully by user: ${profile.email} (${profile.id})`
    );
    console.log(
      `📝 [CHANNEL] Deleted channel ID: ${params.channelId}, Server: ${serverId}`
    );

    revalidatePath('/(main)', 'layout');

    return NextResponse.json(server);
  } catch (error: any) {
    console.error('❌ [CHANNEL] Channel deletion error:', error);
    trackSuspiciousActivity(req, 'CHANNEL_DELETE_ERROR');

    // ✅ SECURITY: Generic error response - no internal details exposed
    return NextResponse.json(
      {
        error: 'Channel deletion failed',
        message: 'Unable to delete channel. Please try again later.',
      },
      { status: 500 }
    );
  }
}
