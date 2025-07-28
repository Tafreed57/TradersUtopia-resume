import { NextRequest, NextResponse } from 'next/server';
import { MessageService } from '@/services/database/message-service';
import { ChannelService } from '@/services/database/channel-service';
import { apiLogger } from '@/lib/enhanced-logger';
import { ValidationError } from '@/lib/error-handling';

const MESSAGES_BATCH = 10;
const TRACK_RECORD_CHANNEL_NAME = 'Track Record & Results';

/**
 * Get Track Record Messages
 * Public access for fetching track record messages with pagination
 */
export async function GET(req: NextRequest) {
  const messageService = new MessageService();
  const channelService = new ChannelService();

  try {
    const { searchParams } = new URL(req.url);
    const cursor = searchParams.get('cursor');

    // Step 1: Find the track record channel by name
    const trackRecordChannel = await channelService.findChannelByName(
      TRACK_RECORD_CHANNEL_NAME
    );

    if (!trackRecordChannel) {
      apiLogger.databaseOperation('track_record_channel_not_found', false, {
        channelName: TRACK_RECORD_CHANNEL_NAME,
      });

      return NextResponse.json({
        items: [],
        nextCursor: null,
        error: 'Track Record & Results channel not found',
      });
    }

    // Step 2: Get messages from the track record channel
    const result = await messageService.getTrackRecordMessages(
      trackRecordChannel.id,
      {
        cursor: cursor || undefined,
        limit: MESSAGES_BATCH,
      }
    );

    apiLogger.databaseOperation('track_record_messages_retrieved', true, {
      channelId: trackRecordChannel.id.substring(0, 8) + '***',
      channelName: TRACK_RECORD_CHANNEL_NAME,
      messageCount: result.messages.length,
      cursor: cursor ? cursor.substring(0, 8) + '***' : null,
      nextCursor: result.nextCursor
        ? result.nextCursor.substring(0, 8) + '***'
        : null,
      hasMore: result.hasMore,
    });

    // Format response to match expected frontend structure
    return NextResponse.json({
      items: result.messages,
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
      channelInfo: {
        id: trackRecordChannel.id,
        name: trackRecordChannel.name,
        serverId: trackRecordChannel.serverId,
      },
    });
  } catch (error) {
    apiLogger.databaseOperation(
      'track_record_messages_retrieval_failed',
      false,
      {
        channelName: TRACK_RECORD_CHANNEL_NAME,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    );

    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Failed to retrieve track record messages' },
      { status: 500 }
    );
  }
}
