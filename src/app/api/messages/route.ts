import { prisma } from '@/lib/prismadb';
import { getCurrentProfileForAuth } from '@/lib/query';
import { Message } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimitMessaging, trackSuspiciousActivity } from '@/lib/rate-limit';

// Force dynamic rendering due to rate limiting using request.headers
export const dynamic = 'force-dynamic';
import { z } from 'zod';
import { createNotification } from '@/lib/notifications';

const MESSAGE_BATCH = 10;

// Schema for message creation
const messageSchema = z.object({
  content: z.string().min(1).max(10000),
  fileUrl: z.string().url().optional(),
});

export async function GET(req: NextRequest) {
  try {
    // ✅ SECURITY: Rate limiting for message retrieval
    const rateLimitResult = await rateLimitMessaging()(req);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(req, 'MESSAGE_RETRIEVAL_RATE_LIMIT_EXCEEDED');
      return rateLimitResult.error;
    }

    const profile = await getCurrentProfileForAuth();
    if (!profile) {
      trackSuspiciousActivity(req, 'UNAUTHENTICATED_MESSAGE_ACCESS');
      return new NextResponse('Unauthorized', { status: 401 });
    }
    const { searchParams } = new URL(req.url);

    const channelId = searchParams.get('channelId');
    const cursor = searchParams.get('cursor');
    if (!channelId) {
      return new NextResponse('Channel ID is required', { status: 400 });
    }

    // ✅ SECURITY: Validate channelId format (CUID)
    try {
      z.string()
        .regex(/^c[a-z0-9]{24}$/)
        .parse(channelId);
    } catch (error) {
      trackSuspiciousActivity(req, 'INVALID_CHANNEL_ID_FORMAT');
      return new NextResponse('Invalid channel ID format', { status: 400 });
    }

    // ✅ SECURITY: Verify user has access to the channel
    const channel = await prisma.channel.findFirst({
      where: {
        id: channelId,
        server: {
          members: {
            some: {
              profileId: profile.id,
            },
          },
        },
      },
    });

    if (!channel) {
      trackSuspiciousActivity(req, 'UNAUTHORIZED_CHANNEL_MESSAGE_ACCESS');
      return new NextResponse('Channel not found or access denied', {
        status: 404,
      });
    }

    let messages: Message[] = [];

    if (cursor) {
      messages = await prisma.message.findMany({
        take: MESSAGE_BATCH,
        skip: 1,
        cursor: {
          id: cursor,
        },
        where: {
          channelId,
        },
        include: {
          member: {
            include: {
              profile: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    } else {
      messages = await prisma.message.findMany({
        take: MESSAGE_BATCH,
        where: {
          channelId,
        },
        include: {
          member: {
            include: {
              profile: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
    }

    let nextCursor = null;

    if (messages.length === MESSAGE_BATCH) {
      nextCursor = messages[messages.length - 1].id;
    }

    return NextResponse.json({
      items: messages,
      nextCursor,
    });
  } catch (error: any) {
    return new NextResponse('Internal Error', { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // ✅ SECURITY: Rate limiting for message creation
    const rateLimitResult = await rateLimitMessaging()(req);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(req, 'MESSAGE_CREATION_RATE_LIMIT_EXCEEDED');
      return rateLimitResult.error;
    }

    const profile = await getCurrentProfileForAuth();
    if (!profile) {
      trackSuspiciousActivity(req, 'UNAUTHENTICATED_MESSAGE_CREATION');
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const channelId = searchParams.get('channelId');
    const serverId = searchParams.get('serverId');

    if (!channelId || !serverId) {
      return new NextResponse('Channel ID and Server ID are required', {
        status: 400,
      });
    }

    // ✅ SECURITY: Validate IDs format (CUID)
    try {
      z.string()
        .regex(/^c[a-z0-9]{24}$/)
        .parse(channelId);
      z.string()
        .regex(/^c[a-z0-9]{24}$/)
        .parse(serverId);
    } catch (error) {
      trackSuspiciousActivity(req, 'INVALID_ID_FORMAT');
      return new NextResponse('Invalid ID format', { status: 400 });
    }

    // Parse and validate request body
    const body = await req.json();
    const validatedData = messageSchema.parse(body);

    // ✅ PERFORMANCE: Combined database query to verify permissions and get channel data
    const channelWithMember = await prisma.channel.findFirst({
      where: {
        id: channelId,
        serverId: serverId,
        server: {
          members: {
            some: {
              profileId: profile.id,
            },
          },
        },
      },
      include: {
        server: {
          include: {
            members: {
              where: {
                profileId: profile.id,
              },
              take: 1,
            },
          },
        },
      },
    });

    if (!channelWithMember || !channelWithMember.server.members[0]) {
      trackSuspiciousActivity(req, 'UNAUTHORIZED_CHANNEL_MESSAGE_ACCESS');
      return new NextResponse('Channel not found or access denied', {
        status: 404,
      });
    }

    const member = channelWithMember.server.members[0];
    const channel = channelWithMember;

    // ✅ GLOBAL ADMIN ONLY: Only global admins can send messages
    if (!profile.isAdmin) {
      trackSuspiciousActivity(req, 'NON_ADMIN_MESSAGE_ATTEMPT');
      return new NextResponse('Only administrators can send messages', {
        status: 403,
      });
    }

    // Create the message
    const message = await prisma.message.create({
      data: {
        content: validatedData.content,
        fileUrl: validatedData.fileUrl,
        channelId: channelId,
        memberId: member.id,
      },
      include: {
        member: {
          include: {
            profile: true,
          },
        },
      },
    });

    // 📱 ENHANCED NOTIFICATIONS: Process notifications synchronously to ensure reliability
    try {
      // Get other members for notifications and server info (ACTIVE subscriptions OR admin users)
      // Also include their channel notification preferences
      const [otherMembers, serverInfo] = await Promise.all([
        prisma.member.findMany({
          where: {
            serverId: serverId,
            profileId: { not: profile.id },
            profile: {
              OR: [
                { subscriptionStatus: 'ACTIVE' }, // ✅ SUBSCRIPTION CHECK: Users with active subscriptions
                { isAdmin: true }, // ✅ ADMIN CHECK: Admin users (regardless of subscription status)
              ],
            },
          },
          include: {
            profile: {
              select: {
                id: true,
                userId: true,
                name: true,
                email: true,
                subscriptionStatus: true, // Include for logging/debugging
                isAdmin: true, // Include admin status for logging
              },
            },
          },
        }),
        prisma.server.findUnique({
          where: { id: serverId },
          select: { name: true },
        }),
      ]);

      // ✅ CHANNEL NOTIFICATION FILTERING: Get channel notification preferences for all members
      const channelNotificationPrefs =
        await prisma.channelNotificationPreference.findMany({
          where: {
            channelId: channelId,
            profileId: {
              in: otherMembers.map(member => member.profile.id),
            },
          },
        });

      // Create a map for quick lookup of notification preferences
      const notificationPrefsMap = new Map(
        channelNotificationPrefs.map(pref => [pref.profileId, pref.enabled])
      );

      // Filter members based on channel notification preferences
      // If no preference exists, default to enabled (true)
      const membersToNotify = otherMembers.filter(member => {
        const preference = notificationPrefsMap.get(member.profile.id);
        return preference !== false; // Default to true if no preference set
      });

      // ✅ ENHANCED FILTERING: Log notification targeting for eligible users
      console.log(
        `📬 [NOTIFICATIONS] Message from ${profile.name} in ${serverInfo?.name || 'Unknown Server'}`
      );

      // Count different types of eligible users
      const activeSubscriptionUsers = otherMembers.filter(
        m => m.profile.subscriptionStatus === 'ACTIVE'
      );
      const adminUsers = otherMembers.filter(m => m.profile.isAdmin);

      console.log(
        `📬 [NOTIFICATIONS] Found ${otherMembers.length} eligible members (${activeSubscriptionUsers.length} active subscriptions, ${adminUsers.length} admin users)`
      );
      console.log(
        `📬 [NOTIFICATIONS] ${membersToNotify.length} members have channel notifications enabled`
      );

      if (membersToNotify.length > 0) {
        // Detect mentions in the message content (@username pattern)
        const mentionRegex = /@(\w+)/g;
        const mentions = Array.from(
          validatedData.content.matchAll(mentionRegex)
        );
        const mentionedUsernames = mentions.map(match =>
          match[1].toLowerCase()
        );

        const truncatedContent =
          validatedData.content.length > 100
            ? validatedData.content.substring(0, 100) + '...'
            : validatedData.content;

        const serverName = serverInfo?.name || 'Unknown Server';

        // Create notifications for each member (all have ACTIVE subscriptions and channel notifications enabled)
        const notificationPromises = membersToNotify.map(async serverMember => {
          const isMentioned = mentionedUsernames.some(
            username =>
              serverMember.profile.name.toLowerCase().includes(username) ||
              serverMember.profile.email.toLowerCase().includes(username)
          );

          const userType = serverMember.profile.isAdmin
            ? 'Admin'
            : serverMember.profile.subscriptionStatus === 'ACTIVE'
              ? 'Active Subscription'
              : 'Unknown';

          console.log(
            `📬 [NOTIFICATIONS] Creating notification for ${serverMember.profile.name} (${userType}) - ${isMentioned ? 'MENTION' : 'MESSAGE'}`
          );

          try {
            const notification = await createNotification({
              userId: serverMember.profile.userId,
              type: isMentioned ? 'MENTION' : 'MESSAGE',
              title: isMentioned
                ? `You were mentioned in ${serverName} #${channel.name}`
                : `New message in ${serverName} #${channel.name}`,
              message: `${profile.name}: ${truncatedContent}`,
              actionUrl: `/servers/${serverId}/channels/${channelId}`,
            });

            if (notification) {
              console.log(
                `✅ [NOTIFICATIONS] Successfully created notification for ${serverMember.profile.name}`
              );
            } else {
              console.error(
                `❌ [NOTIFICATIONS] Failed to create notification for ${serverMember.profile.name}`
              );
            }

            return notification;
          } catch (error) {
            console.error(
              `❌ [NOTIFICATIONS] Error creating notification for ${serverMember.profile.name}:`,
              error
            );
            return null;
          }
        });

        // Wait for all notifications to be created
        const results = await Promise.all(notificationPromises);
        const successCount = results.filter(r => r !== null).length;
        console.log(
          `📬 [NOTIFICATIONS] Created ${successCount}/${membersToNotify.length} notifications successfully`
        );
      } else {
        console.log(
          `📬 [NOTIFICATIONS] No members to notify (either no active subscriptions/admin users or channel notifications disabled)`
        );
      }
    } catch (error) {
      console.error(
        `❌ [NOTIFICATIONS] Error processing notifications:`,
        error
      );
    }

    return NextResponse.json(message);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return new NextResponse('Invalid input data', { status: 400 });
    }

    return new NextResponse('Internal Error', { status: 500 });
  }
}
