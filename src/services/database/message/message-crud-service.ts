import { BaseDatabaseService } from '../base-service';
import { Message, CreateMessageData, UpdateMessageData } from '../../types';
import {
  NotFoundError,
  AuthorizationError,
  ValidationError,
  maskId,
} from '@/lib/error-handling';

/**
 * MessageCrudService - Handles basic message CRUD operations
 *
 * Contains only the core message operations that are actively used in the codebase.
 * Focuses on data persistence with proper access verification.
 */
export class MessageCrudService extends BaseDatabaseService {
  /**
   * Get messages from a channel with pagination
   * Includes access verification
   */
  async getMessagesFromChannel(
    channelId: string,
    userId: string,
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
      this.validateId(userId, 'userId');

      const { cursor, limit = 10 } = options;

      // Step 1: Verify user has access to the channel
      const channel = await this.prisma.channel.findFirst({
        where: {
          id: channelId,
          server: {
            members: {
              some: {
                userId,
              },
            },
          },
        },
      });

      if (!channel) {
        throw new AuthorizationError('Channel not found or access denied');
      }

      // Step 2: Build query options for pagination
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

      // Step 3: Fetch messages
      const messages = await this.prisma.message.findMany(queryOptions);

      // Step 4: Determine next cursor and pagination info
      const nextCursor =
        messages.length === limit
          ? messages[messages.length - 1]?.id || null
          : null;
      const hasMore = messages.length === limit;

      this.logSuccess('messages_retrieved_from_channel', {
        channelId: maskId(channelId),
        userId: maskId(userId),
        messageCount: messages.length,
        hasMore,
        hasCursor: !!cursor,
      });

      return {
        messages,
        nextCursor,
        hasMore,
      };
    } catch (error) {
      return this.handleError(error, 'get_messages_from_channel', {
        channelId: maskId(channelId),
        userId: maskId(userId),
      });
    }
  }

  /**
   * Create a new message
   * Includes proper member verification and channel access
   */
  async createMessage(data: CreateMessageData): Promise<Message> {
    try {
      this.validateRequired(data.content, 'message content');
      this.validateId(data.channelId, 'channelId');
      this.validateId(data.memberId, 'memberId');

      // Step 1: Verify the member exists and has access to the channel
      const member = await this.prisma.member.findFirst({
        where: {
          id: data.memberId,
          server: {
            channels: {
              some: {
                id: data.channelId,
              },
            },
          },
        },
        include: {
          user: true,
          role: true,
        },
      });

      if (!member) {
        throw new AuthorizationError('Member not found or no channel access');
      }

      // Step 2: Create the message
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

      this.logSuccess('message_created', {
        messageId: maskId(message.id),
        channelId: maskId(data.channelId),
        memberId: maskId(data.memberId),
        userId: maskId(member.userId),
        contentLength: data.content.length,
      });

      return message as Message;
    } catch (error) {
      return this.handleError(error, 'create_message', {
        channelId: maskId(data.channelId),
        memberId: maskId(data.memberId),
      });
    }
  }

  /**
   * Update message content
   * Only allows content updates, with proper ownership verification
   */
  async updateMessage(
    messageId: string,
    data: UpdateMessageData,
    userId: string
  ): Promise<Message> {
    try {
      this.validateId(messageId, 'messageId');
      this.validateRequired(data.content, 'message content');

      // Step 1: Find the message and verify ownership
      const existingMessage = await this.prisma.message.findFirst({
        where: {
          id: messageId,
          deleted: false,
        },
        include: {
          member: {
            include: {
              user: true,
            },
          },
        },
      });

      if (!existingMessage) {
        throw new NotFoundError('Message not found');
      }

      // Step 2: Verify ownership (only message author can edit)
      if (existingMessage.member.userId !== userId) {
        throw new AuthorizationError('Only message author can edit messages');
      }

      // Step 3: Update the message
      const updatedMessage = await this.prisma.message.update({
        where: { id: messageId },
        data: {
          content: data.content,
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

      this.logSuccess('message_updated', {
        messageId: maskId(messageId),
        userId: maskId(userId),
        channelId: maskId(existingMessage.channelId),
        contentLength: data.content?.length || 0,
      });

      return updatedMessage as Message;
    } catch (error) {
      return this.handleError(error, 'update_message', {
        messageId: maskId(messageId),
        userId: maskId(userId),
      });
    }
  }

  /**
   * Delete message (soft delete)
   * Allows deletion by message author or admin
   */
  async deleteMessage(messageId: string, userId: string): Promise<Message> {
    try {
      this.validateId(messageId, 'messageId');
      this.validateId(userId, 'userId');

      // Step 1: Get message with member info
      const message = await this.prisma.message.findFirst({
        where: {
          id: messageId,
          deleted: false,
        },
        include: {
          member: {
            include: {
              user: true,
              role: true,
            },
          },
          channel: {
            select: {
              serverId: true,
            },
          },
        },
      });

      if (!message) {
        throw new NotFoundError('Message not found');
      }

      // Step 2: Check permissions (author or admin)
      const isAuthor = message.member.userId === userId;
      const isAdmin = message.member.user.isAdmin;

      if (!isAuthor && !isAdmin) {
        throw new AuthorizationError(
          'Only message author or admin can delete messages'
        );
      }

      // Step 3: Soft delete the message
      const deletedMessage = await this.prisma.message.update({
        where: { id: messageId },
        data: {
          deleted: true,
          content: '[Message Deleted]',
        },
        include: {
          member: {
            include: {
              user: true,
              role: true,
            },
          },
        },
      });

      this.logSuccess('message_deleted', {
        messageId: maskId(messageId),
        deletedBy: maskId(userId),
        authorId: maskId(message.member.userId),
        channelId: maskId(message.channelId),
        serverId: maskId(message.channel.serverId),
        isAuthor,
        isAdmin,
      });

      return deletedMessage as Message;
    } catch (error) {
      return await this.handleError(error, 'delete_message', {
        messageId: maskId(messageId),
        userId: maskId(userId),
      });
    }
  }
}
