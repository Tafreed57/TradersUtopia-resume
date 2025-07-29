import { BaseDatabaseService } from './base-service';
import {
  Message,
  CreateMessageData,
  UpdateMessageData,
  MessageWithMember,
  Member,
  User,
} from '../types';
import { apiLogger } from '@/lib/enhanced-logger';
import {
  NotFoundError,
  AuthorizationError,
  ValidationError,
  maskId,
} from '@/lib/error-handling';

/**
 * MessageService
 *
 * Handles all message-related operations including creation, updates, deletion,
 * retrieval, and search functionality. Manages both regular messages and track record messages.
 */
export class MessageService extends BaseDatabaseService {
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
        hasCursor: !!cursor,
        hasMore,
      });

      return {
        messages: messages as Message[],
        nextCursor,
        hasMore,
      };
    } catch (error) {
      return await this.handleError(error, 'get_messages_from_channel', {
        channelId: maskId(channelId),
        userId: maskId(userId),
      });
    }
  }

  /**
   * Create a new message in a channel
   * Admin-only operation in TRADERSUTOPIA
   */
  async createMessage(
    data: {
      content: string;
      fileUrl?: string;
      channelId: string;
      serverId: string;
    },
    userId: string
  ): Promise<Message> {
    try {
      this.validateRequired(data.content, 'message content');
      this.validateId(data.channelId, 'channelId');
      this.validateId(data.serverId, 'serverId');
      this.validateId(userId, 'userId');

      // Validate content length
      if (data.content.length > 10000) {
        throw new ValidationError(
          'Message content too long (max 10,000 characters)'
        );
      }

      // Step 1: Verify user has access to channel and is a member
      const channelWithMember = await this.prisma.channel.findFirst({
        where: {
          id: data.channelId,
          serverId: data.serverId,
          server: {
            members: {
              some: {
                userId,
              },
            },
          },
        },
        include: {
          server: {
            include: {
              members: {
                where: {
                  userId,
                },
                take: 1,
              },
            },
          },
        },
      });

      if (!channelWithMember || !channelWithMember.server.members[0]) {
        throw new AuthorizationError('Channel not found or access denied');
      }

      const member = channelWithMember.server.members[0];

      // Step 2: Create the message
      const message = await this.prisma.message.create({
        data: {
          content: data.content,
          channelId: data.channelId,
          memberId: member.id,
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
        serverId: maskId(data.serverId),
        userId: maskId(userId),
        hasFileUrl: !!data.fileUrl,
        contentLength: data.content.length,
      });

      return message as Message;
    } catch (error) {
      return await this.handleError(error, 'create_message', {
        channelId: maskId(data.channelId),
        serverId: maskId(data.serverId),
        userId: maskId(userId),
      });
    }
  }

  /**
   * Update a message (edit content)
   * Author or admin only
   */
  async updateMessage(
    messageId: string,
    content: string,
    userId: string
  ): Promise<Message> {
    try {
      this.validateId(messageId, 'messageId');
      this.validateRequired(content, 'message content');
      this.validateId(userId, 'userId');

      if (content.length > 10000) {
        throw new ValidationError(
          'Message content too long (max 10,000 characters)'
        );
      }

      // Step 1: Find message and verify ownership or admin access
      const message = await this.prisma.message.findFirst({
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
          channel: {
            include: {
              server: {
                include: {
                  members: {
                    where: {
                      userId,
                    },
                    include: {
                      user: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!message) {
        throw new NotFoundError('Message not found');
      }

      const currentUserMember = message.channel.server.members[0];
      const isAuthor = message.member.userId === userId;
      const isAdmin = currentUserMember?.user?.isAdmin || false;

      if (!isAuthor && !isAdmin) {
        throw new AuthorizationError(
          'You can only edit your own messages or be an admin'
        );
      }

      // Step 2: Update the message
      const updatedMessage = await this.prisma.message.update({
        where: { id: messageId },
        data: {
          content,
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
        isAuthor,
        isAdmin,
        contentLength: content.length,
      });

      return updatedMessage as Message;
    } catch (error) {
      return await this.handleError(error, 'update_message', {
        messageId: maskId(messageId),
        userId: maskId(userId),
      });
    }
  }

  /**
   * Soft delete a message
   * Author or admin only
   */
  async deleteMessage(messageId: string, userId: string): Promise<Message> {
    try {
      this.validateId(messageId, 'messageId');
      this.validateId(userId, 'userId');

      // Step 1: Find message and verify ownership or admin access
      const message = await this.prisma.message.findFirst({
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
          channel: {
            include: {
              server: {
                include: {
                  members: {
                    where: {
                      userId,
                    },
                    include: {
                      user: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!message) {
        throw new NotFoundError('Message not found');
      }

      const currentUserMember = message.channel.server.members[0];
      const isAuthor = message.member.userId === userId;
      const isAdmin = currentUserMember?.user?.isAdmin || false;

      if (!isAuthor && !isAdmin) {
        throw new AuthorizationError(
          'You can only delete your own messages or be an admin'
        );
      }

      // Step 2: Soft delete the message
      const deletedMessage = await this.prisma.message.update({
        where: { id: messageId },
        data: {
          deleted: true,
          content: '[This message has been deleted]',
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

      this.logSuccess('message_deleted', {
        messageId: maskId(messageId),
        userId: maskId(userId),
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

  /**
   * Get message by ID with access verification
   */
  async getMessageById(
    messageId: string,
    userId: string
  ): Promise<Message | null> {
    try {
      this.validateId(messageId, 'messageId');
      this.validateId(userId, 'userId');

      const message = await this.prisma.message.findFirst({
        where: {
          id: messageId,
          deleted: false,
          channel: {
            server: {
              members: {
                some: {
                  userId,
                },
              },
            },
          },
        },
        include: {
          member: {
            include: {
              user: true,
              role: true,
            },
          },
          attachments: true,
          channel: {
            select: {
              id: true,
              name: true,
              serverId: true,
            },
          },
        },
      });

      if (message) {
        this.logSuccess('message_retrieved_by_id', {
          messageId: maskId(messageId),
          userId: maskId(userId),
        });
      }

      return message as Message | null;
    } catch (error) {
      return await this.handleError(error, 'get_message_by_id', {
        messageId: maskId(messageId),
        userId: maskId(userId),
      });
    }
  }

  /**
   * Search messages in a channel
   */
  async searchMessagesInChannel(
    channelId: string,
    userId: string,
    searchTerm: string,
    options: {
      limit?: number;
      before?: Date;
      after?: Date;
    } = {}
  ): Promise<Message[]> {
    try {
      this.validateId(channelId, 'channelId');
      this.validateId(userId, 'userId');
      this.validateRequired(searchTerm, 'search term');

      const { limit = 20, before, after } = options;

      // Step 1: Verify channel access
      const hasAccess = await this.prisma.channel.findFirst({
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

      if (!hasAccess) {
        throw new AuthorizationError('Channel not found or access denied');
      }

      // Step 2: Build search query
      const whereClause: any = {
        channelId,
        deleted: false,
        content: {
          contains: searchTerm,
          mode: 'insensitive',
        },
      };

      if (before || after) {
        whereClause.createdAt = {};
        if (before) whereClause.createdAt.lt = before;
        if (after) whereClause.createdAt.gt = after;
      }

      // Step 3: Search messages
      const messages = await this.prisma.message.findMany({
        where: whereClause,
        include: {
          member: {
            include: {
              user: true,
              role: true,
            },
          },
          attachments: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: Math.min(limit, 50),
      });

      this.logSuccess('messages_searched_in_channel', {
        channelId: maskId(channelId),
        userId: maskId(userId),
        searchTerm:
          searchTerm.substring(0, 20) + (searchTerm.length > 20 ? '...' : ''),
        resultsFound: messages.length,
      });

      return messages as Message[];
    } catch (error) {
      return await this.handleError(error, 'search_messages_in_channel', {
        channelId: maskId(channelId),
        userId: maskId(userId),
      });
    }
  }

  /**
   * Delete track record message (admin only)
   * Performs soft delete for audit trail
   */
  async deleteTrackRecordMessage(
    messageId: string,
    userId: string
  ): Promise<Message> {
    try {
      this.validateId(messageId, 'messageId');
      this.validateId(userId, 'userId');

      // Check if user is admin
      const userProfile = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, isAdmin: true },
      });

      if (!userProfile || !userProfile.isAdmin) {
        throw new AuthorizationError(
          'Admin access required for track record message deletion'
        );
      }

      // Find the message
      const message = await this.prisma.message.findUnique({
        where: { id: messageId },
        include: {
          member: {
            select: {
              id: true,
              user: {
                select: {
                  name: true,
                  imageUrl: true,
                },
              },
            },
          },
        },
      });

      if (!message || message.deleted) {
        throw new NotFoundError('Track record message not found');
      }

      // Check if the admin is the message owner or has admin privileges
      const isMessageOwner = message.memberId === userProfile.id;
      const canDelete = isMessageOwner || userProfile.isAdmin;

      if (!canDelete) {
        throw new AuthorizationError('Cannot delete this track record message');
      }

      // Soft delete the message
      const deletedMessage = await this.prisma.message.update({
        where: { id: messageId },
        data: {
          content: 'This message has been deleted',
          deleted: true,
        },
        include: {
          member: {
            select: {
              id: true,
              user: {
                select: {
                  name: true,
                  imageUrl: true,
                },
              },
            },
          },
        },
      });

      apiLogger.databaseOperation('track_record_message_deleted', true, {
        messageId: maskId(messageId),
        adminId: maskId(userId),
        isMessageOwner,
      });

      return deletedMessage as Message;
    } catch (error) {
      throw this.handleError(error, 'Failed to delete track record message', {
        messageId: maskId(messageId),
        userId: maskId(userId),
      });
    }
  }

  /**
   * Edit track record message (admin only, message owner)
   */
  async updateTrackRecordMessage(
    messageId: string,
    userId: string,
    updateData: {
      content?: string;
      fileUrl?: string;
    }
  ): Promise<Message> {
    try {
      this.validateId(messageId, 'messageId');
      this.validateId(userId, 'userId');

      if (!updateData.content && updateData.fileUrl === undefined) {
        throw new ValidationError('Either content or fileUrl must be provided');
      }

      // Check if user is admin
      const userProfile = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, isAdmin: true },
      });

      if (!userProfile || !userProfile.isAdmin) {
        throw new AuthorizationError(
          'Admin access required for track record message editing'
        );
      }

      // Find the message
      const message = await this.prisma.message.findUnique({
        where: { id: messageId },
      });

      if (!message || message.deleted) {
        throw new NotFoundError('Track record message not found');
      }

      // Check if the admin is the message owner
      const isMessageOwner = message.memberId === userProfile.id;

      if (!isMessageOwner) {
        throw new AuthorizationError('Can only edit own track record messages');
      }

      // Update the message
      const updatedMessage = await this.prisma.message.update({
        where: { id: messageId },
        data: {
          content: updateData.content || message.content,
          updatedAt: new Date(),
        },
        include: {
          member: {
            select: {
              id: true,
              user: {
                select: {
                  name: true,
                  imageUrl: true,
                },
              },
            },
          },
        },
      });

      apiLogger.databaseOperation('track_record_message_updated', true, {
        messageId: maskId(messageId),
        adminId: maskId(userId),
        hasContent: !!updateData.content,
        hasFileUrl: updateData.fileUrl !== undefined,
      });

      return updatedMessage as Message;
    } catch (error) {
      throw this.handleError(error, 'Failed to update track record message', {
        messageId: maskId(messageId),
        userId: maskId(userId),
      });
    }
  }

  /**
   * Get messages from track record channel (public access)
   * Special case for track record messages that don't require authentication
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
   * Get source messages from external trading database
   * Specialized endpoint for trading data integration
   */
  async getSourceMessages(
    channelName: string,
    userId: string,
    options: {
      cursor?: string;
      limit?: number;
    } = {}
  ): Promise<{
    items: any[];
    nextCursor: string | null;
  }> {
    try {
      this.validateId(userId, 'userId');

      const { cursor, limit = 10 } = options;
      const MESSAGES_BATCH = limit;

      // Check if source messages database is configured
      if (!process.env.SOURCEMESSAGES_DATABASE_URL) {
        throw new ValidationError('Source messages feature not configured');
      }

      // Validate channel mapping
      const { sourceChannelMap } = await import('@/types/database-types');
      if (!channelName || !sourceChannelMap[channelName]) {
        throw new NotFoundError('Source channel not found');
      }

      const tableName = sourceChannelMap[channelName];

      // Import source database connection
      const sql = (await import('@/lib/source-db')).default;

      let messages: any[] = [];

      // Execute query based on cursor
      if (cursor) {
        messages = await sql`
          SELECT * FROM ${sql(tableName)}
          WHERE id < ${cursor}
          ORDER BY id DESC
          LIMIT ${MESSAGES_BATCH}
        `;
      } else {
        messages = await sql`
          SELECT * FROM ${sql(tableName)}
          ORDER BY id DESC
          LIMIT ${MESSAGES_BATCH}
        `;
      }

      // Create mock bot profile for source messages
      const botProfile = {
        id: `bot-profile-${channelName}`,
        userId: `bot-user-${channelName}`,
        name: 'Trading Bot',
        imageUrl: '/logo.png',
        email: '',
        isAdmin: false,
      };

      const botMember = {
        id: `bot-member-${channelName}`,
        role: 'GUEST',
        profileId: botProfile.id,
        serverId: 'source-server',
        profile: botProfile,
      };

      // Format messages for frontend consumption
      const formattedMessages = messages.map(message => ({
        id: message.msg_id,
        content: message.content || '',
        deleted: false,
        createdAt: message.timestamp || message.created_at,
        updatedAt: message.created_at,
        member: botMember,
      }));

      let nextCursor = null;
      if (messages.length === MESSAGES_BATCH) {
        nextCursor = messages[MESSAGES_BATCH - 1].id;
      }

      apiLogger.databaseOperation('source_messages_retrieved', true, {
        userId: maskId(userId),
        channelName,
        messageCount: messages.length,
        cursor: cursor ? maskId(cursor) : null,
        nextCursor: nextCursor ? maskId(nextCursor) : null,
      });

      return {
        items: formattedMessages,
        nextCursor,
      };
    } catch (error) {
      throw this.handleError(error, 'Failed to retrieve source messages', {
        channelName,
        userId: maskId(userId),
      });
    }
  }
}
