import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import sql from '@/lib/source-db';
import { BaseMessage, sourceChannelMap } from '@/types/database-types';
import { Member, Profile, SubscriptionStatus } from '@prisma/client';

const MESSAGES_BATCH = 10;

export async function GET(
  req: Request,
  { params }: { params: { channelId: string } }
) {
  try {
    // Check if source messages database is configured
    if (!process.env.SOURCEMESSAGES_DATABASE_URL) {
      return new NextResponse('Source messages feature not configured', {
        status: 503,
      });
    }

    const { userId } = await auth();

    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const cursor = searchParams.get('cursor');
    const channelName = params.channelId;

    if (!channelName || !sourceChannelMap[channelName]) {
      return new NextResponse('Channel not found', { status: 404 });
    }

    const tableName = sourceChannelMap[channelName];

    let messages: BaseMessage[] = [];

    // if (cursor) {
    //   messages = await sql<BaseMessage[]>`
    //     SELECT * FROM ${sql(tableName)}
    //     WHERE id < ${cursor}
    //     ORDER BY id DESC
    //     LIMIT ${MESSAGES_BATCH}
    //   `;
    // } else {
    //   messages = await sql<BaseMessage[]>`
    //     SELECT * FROM ${sql(tableName)}
    //     ORDER BY id DESC
    //     LIMIT ${MESSAGES_BATCH}
    //   `;
    // }

    const botProfile: Profile = {
      id: `bot-profile-${channelName}`,
      userId: `bot-user-${channelName}`,
      name: 'Trading Bot',
      imageUrl: '/logo.png',
      email: '',
      createdAt: new Date(),
      updatedAt: new Date(),
      stripeCustomerId: null,
      stripeSessionId: null,
      subscriptionEnd: null,
      subscriptionStart: null,
      subscriptionStatus: SubscriptionStatus.FREE,
      stripeProductId: null,
      // New subscription fields
      stripeSubscriptionId: null,
      subscriptionAutoRenew: null,
      stripePriceId: null,
      subscriptionAmount: null,
      originalAmount: null,
      subscriptionCurrency: null,
      subscriptionInterval: null,
      subscriptionCancelledAt: null,
      discountPercent: null,
      discountName: null,
      stripeCustomerEmail: null,
      subscriptionCreated: null,
      lastInvoiceUrl: null,

      backupCodes: [],
      isAdmin: false,
      pushNotifications: null,
      pushSubscriptions: [],
    };

    const botMember: Member = {
      id: `bot-member-${channelName}`,
      role: 'GUEST',
      subscriptionStatus: SubscriptionStatus.FREE,
      subscriptionEnd: null,
      subscriptionStart: null,
      profileId: botProfile.id,
      serverId: 'source-server',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const formattedMessages = messages.map(message => ({
      //   ...message,
      id: message.msg_id,
      //   fileUrl: message.image_url,
      content: message.content || '',
      deleted: false,
      createdAt: message.timestamp || message.created_at,
      updatedAt: message.created_at,
      member: {
        ...botMember,
        profile: botProfile,
      },
    }));

    let nextCursor = null;

    if (messages.length === MESSAGES_BATCH) {
      nextCursor = messages[MESSAGES_BATCH - 1].id;
    }

    return NextResponse.json({
      items: formattedMessages,
      nextCursor,
    });
  } catch (error) {
    console.log('[SOURCE_MESSAGES_GET]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
