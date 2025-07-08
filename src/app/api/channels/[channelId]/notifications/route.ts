import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismadb';
import { getCurrentProfileForAuth } from '@/lib/query';
import { z } from 'zod';

const toggleSchema = z.object({
  enabled: z.boolean(),
});

// GET - Get notification preference for a channel
export async function GET(
  req: NextRequest,
  { params }: { params: { channelId: string } }
) {
  try {
    const profile = await getCurrentProfileForAuth();
    if (!profile) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { channelId } = params;

    // Check if the user has access to this channel
    const channel = await prisma.channel.findUnique({
      where: {
        id: channelId,
      },
      include: {
        server: {
          include: {
            members: {
              where: {
                profileId: profile.id,
              },
            },
          },
        },
      },
    });

    if (!channel || !channel.server.members.length) {
      return new NextResponse('Channel not found or no access', {
        status: 404,
      });
    }

    // Get or create notification preference
    let preference = await prisma.channelNotificationPreference.findUnique({
      where: {
        profileId_channelId: {
          profileId: profile.id,
          channelId: channelId,
        },
      },
    });

    // If no preference exists, create one with default (enabled: true)
    if (!preference) {
      preference = await prisma.channelNotificationPreference.create({
        data: {
          profileId: profile.id,
          channelId: channelId,
          enabled: true,
        },
      });
    }

    return NextResponse.json({
      enabled: preference.enabled,
      channelId: channelId,
    });
  } catch (error) {
    console.error('Error fetching channel notification preference:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

// PATCH - Toggle notification preference for a channel
export async function PATCH(
  req: NextRequest,
  { params }: { params: { channelId: string } }
) {
  try {
    const profile = await getCurrentProfileForAuth();
    if (!profile) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { channelId } = params;
    const body = await req.json();
    const { enabled } = toggleSchema.parse(body);

    // Check if the user has access to this channel
    const channel = await prisma.channel.findUnique({
      where: {
        id: channelId,
      },
      include: {
        server: {
          include: {
            members: {
              where: {
                profileId: profile.id,
              },
            },
          },
        },
      },
    });

    if (!channel || !channel.server.members.length) {
      return new NextResponse('Channel not found or no access', {
        status: 404,
      });
    }

    // Update or create notification preference
    const preference = await prisma.channelNotificationPreference.upsert({
      where: {
        profileId_channelId: {
          profileId: profile.id,
          channelId: channelId,
        },
      },
      update: {
        enabled: enabled,
      },
      create: {
        profileId: profile.id,
        channelId: channelId,
        enabled: enabled,
      },
    });

    console.log(
      `🔔 [NOTIFICATION] User ${profile.name} ${enabled ? 'enabled' : 'disabled'} notifications for channel ${channel.name}`
    );

    return NextResponse.json({
      enabled: preference.enabled,
      channelId: channelId,
      message: `Notifications ${enabled ? 'enabled' : 'disabled'} for ${channel.name}`,
    });
  } catch (error) {
    console.error('Error updating channel notification preference:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
