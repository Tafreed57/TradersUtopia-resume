import { BaseDatabaseService } from './base-service';
import {
  Channel,
  CreateChannelData,
  UpdateChannelData,
  ChannelWithAccess,
  ChannelAccessResult,
} from '../types';
import { ChannelAccessService } from './channel/channel-access-service';
import { ChannelCrudService } from './channel/channel-crud-service';
import { ChannelOrderingService } from './channel/channel-ordering-service';

/**
 * ChannelService - Main facade for channel operations
 */
export class ChannelService extends BaseDatabaseService {
  private access: ChannelAccessService;
  private crud: ChannelCrudService;
  private ordering: ChannelOrderingService;

  constructor() {
    super();
    this.access = new ChannelAccessService();
    this.crud = new ChannelCrudService();
    this.ordering = new ChannelOrderingService();
  }

  // ===== ACCESS CONTROL (ChannelAccessService) =====

  /**
   * Find channel with access verification
   * Used in 15+ routes for permission checking
   */
  async findChannelWithAccess(
    channelId: string,
    userId: string
  ): Promise<ChannelWithAccess | null> {
    return this.access.findChannelWithAccess(channelId, userId);
  }

  /**
   * Verify if user has admin access to channel
   * Used in admin-only channel operations
   */
  async verifyChannelAdminAccess(
    channelId: string,
    userId: string
  ): Promise<ChannelAccessResult> {
    return this.access.verifyChannelAdminAccess(channelId, userId);
  }

  /**
   * Find track record channel
   * Used for track record operations
   */
  async findTrackRecordChannel(): Promise<Channel | null> {
    return this.access.findTrackRecordChannel();
  }

  // ===== CRUD OPERATIONS (ChannelCrudService) =====

  /**
   * Create channel with proper permissions
   * Admin-only operation
   */
  async createChannel(
    data: CreateChannelData,
    userId: string
  ): Promise<Channel> {
    return this.crud.createChannel(data, userId);
  }

  /**
   * Update channel details
   * Admin-only operation
   */
  async updateChannel(
    id: string,
    data: UpdateChannelData,
    userId: string
  ): Promise<Channel> {
    return this.crud.updateChannel(id, data, userId);
  }

  /**
   * Delete channel
   * Admin-only operation with cascade cleanup
   */
  async deleteChannel(id: string, userId: string): Promise<Channel> {
    return this.crud.deleteChannel(id, userId);
  }

  // ===== ORDERING OPERATIONS (ChannelOrderingService) =====

  /**
   * Reorder a single channel with proper position shifting
   * Handles both same-section and cross-section moves
   * Admin-only operation
   */
  async reorderChannel(
    channelId: string,
    newPosition: number,
    newSectionId: string | null,
    userId: string
  ): Promise<boolean> {
    return this.ordering.reorderChannel(
      channelId,
      newPosition,
      newSectionId,
      userId
    );
  }
}
