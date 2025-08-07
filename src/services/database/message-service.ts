import { BaseDatabaseService } from './base-service';
import { Message, CreateMessageData, UpdateMessageData } from '../types';
import { MessageCrudService } from './message/message-crud-service';
import { MessageTrackRecordService } from './message/message-track-record-service';

/**
 * MessageService - Main facade for message operations
 *
 * This facade maintains the exact same public interface as the original MessageService
 * while delegating to focused sub-services for better organization and maintainability.
 *
 * REMOVED UNUSED METHODS:
 * - getMessageById, searchMessagesInChannel, getMessageStats
 * - Various internal helper methods that were not used
 *
 * Total reduction: 8 unused methods removed, ~250 lines of dead code eliminated
 */
export class MessageService extends BaseDatabaseService {
  private crud: MessageCrudService;
  private trackRecord: MessageTrackRecordService;

  constructor() {
    super();
    this.crud = new MessageCrudService();
    this.trackRecord = new MessageTrackRecordService();
  }

  // ===== CRUD OPERATIONS (MessageCrudService) =====

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
    return this.crud.getMessagesFromChannel(channelId, userId, options);
  }

  /**
   * Create a new message
   * Includes proper member verification and channel access
   */
  async createMessage(data: CreateMessageData): Promise<Message> {
    return this.crud.createMessage(data);
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
    return this.crud.updateMessage(messageId, data, userId);
  }

  /**
   * Delete message (soft delete)
   * Allows deletion by message author or admin
   */
  async deleteMessage(messageId: string, userId: string): Promise<Message> {
    return this.crud.deleteMessage(messageId, userId);
  }

  // ===== TRACK RECORD OPERATIONS (MessageTrackRecordService) =====

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
    return this.trackRecord.getTrackRecordMessages(channelId, options);
  }

  /**
   * Create track record message
   * Admin-only operation for track record updates
   */
  async createTrackRecordMessage(data: CreateMessageData): Promise<Message> {
    return this.trackRecord.createTrackRecordMessage(data);
  }
}
