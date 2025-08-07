import { BaseDatabaseService } from '../base-service';
import { Message, CreateMessageData } from '../../types';
import { NotFoundError, ValidationError, maskId } from '@/lib/error-handling';

/**
 * MessageTrackRecordService - Handles track record specific message operations
 *
 * Contains only the track record related message methods that are actively used.
 * Manages both regular track record messages and external source integration.
 */
export class MessageTrackRecordService extends BaseDatabaseService {
  /**
   * Get track record messages (public access, no auth required)
   * Used for displaying track record to public
   */
  async getTrackRecordMessages(
    channelId: string,
    options: {
      cursor?: string;
      limit?: number;
    } = {}
  ): Promise<{
    messages: Message[];
    nextCursor: string | null;
    hasMore: boolean;
  }> {
    try {
      this.validateId(channelId, 'channelId');

      const { cursor, limit = 10 } = options;

      // Build query options for pagination
      const queryOptions: any = {
        take: Math.min(limit, 50), // Max 50 messages per request
        where: {
          channelId,
          deleted: false,
        },
        include: {
          member: {
            include: {
              user: true,
              role: true,
            },
          },
          attachments: {
            orderBy: {
              createdAt: 'asc',
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      };

      // Add cursor pagination if provided
      if (cursor) {
        queryOptions.skip = 1;
        queryOptions.cursor = { id: cursor };
      }

      // Fetch messages
      const messages = await this.prisma.message.findMany(queryOptions);

      // Determine next cursor and pagination info
      const nextCursor =
        messages.length === limit
          ? messages[messages.length - 1]?.id || null
          : null;
      const hasMore = messages.length === limit;

      this.logSuccess('track_record_messages_retrieved_public', {
        channelId: maskId(channelId),
        messageCount: messages.length,
        hasCursor: !!cursor,
        hasMore,
      });

      return {
        messages: messages as Message[],
        nextCursor,
        hasMore,
      };
    } catch (error) {
      return await this.handleError(error, 'get_track_record_messages', {
        channelId: maskId(channelId),
      });
    }
  }

  /**
   * Create track record message
   * Admin-only operation for track record updates
   */
  async createTrackRecordMessage(data: CreateMessageData): Promise<Message> {
    try {
      this.validateRequired(data.content, 'message content');
      this.validateId(data.channelId, 'channelId');
      this.validateId(data.memberId, 'memberId');

      // Step 1: Verify this is a track record channel and member has admin rights
      const member = await this.prisma.member.findFirst({
        where: {
          id: data.memberId,
        },
        include: {
          user: true,
          server: {
            include: {
              channels: {
                where: {
                  id: data.channelId,
                  name: 'track-record', // Ensure this is the track record channel
                },
              },
            },
          },
        },
      });

      if (
        !member ||
        !member.user.isAdmin ||
        member.server.channels.length === 0
      ) {
        throw new Error('Only admins can post to track record channel');
      }

      // Step 2: Create the track record message
      const message = await this.prisma.message.create({
        data: {
          content: data.content,
          channelId: data.channelId,
          memberId: data.memberId,
        },
        include: {
          member: {
            include: {
              user: true,
              role: true,
            },
          },
          attachments: true,
        },
      });

      this.logSuccess('track_record_message_created', {
        messageId: maskId(message.id),
        channelId: maskId(data.channelId),
        memberId: maskId(data.memberId),
        userId: maskId(member.userId),
        contentLength: data.content.length,
      });

      return message as Message;
    } catch (error) {
      return this.handleError(error, 'create_track_record_message', {
        channelId: maskId(data.channelId),
        memberId: maskId(data.memberId),
      });
    }
  }
}
