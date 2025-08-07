import { BaseDatabaseService } from '../base-service';
import { AuthorizationError, maskId } from '@/lib/error-handling';

/**
 * ChannelOrderingService - Handles channel reordering operations
 *
 * Contains only the channel reordering logic that is actively used.
 * Manages position updates with proper transaction handling.
 */
export class ChannelOrderingService extends BaseDatabaseService {
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
    try {
      this.validateId(channelId, 'channelId');
      this.validateRequired(newPosition.toString(), 'newPosition');

      // Verify admin access - for ordering, we need to check the user is admin
      const user = await this.prisma.user.findFirst({
        where: { id: userId },
      });

      const isGlobalAdmin = user?.isAdmin || false;

      if (!isGlobalAdmin) {
        throw new AuthorizationError(
          'Admin access required to reorder channels'
        );
      }

      // Get current channel data
      const currentChannel = await this.prisma.channel.findFirst({
        where: { id: channelId },
      });

      if (!currentChannel) {
        throw new Error('Channel not found');
      }

      const oldPosition = currentChannel.position;
      const oldSectionId = currentChannel.sectionId;

      // If no change needed, return early
      if (newPosition === oldPosition && newSectionId === oldSectionId) {
        return true;
      }

      return await this.executeTransaction(async tx => {
        if (newSectionId !== null && newSectionId !== oldSectionId) {
          // Cross-section move
          await this.handleCrossSectionMove(
            tx,
            channelId,
            oldPosition,
            newPosition,
            oldSectionId || null,
            newSectionId,
            currentChannel.serverId
          );
        } else {
          // Same-section move
          await this.handleSameSectionMove(
            tx,
            channelId,
            oldPosition,
            newPosition,
            oldSectionId || null,
            currentChannel.serverId
          );
        }

        this.logSuccess('channel_reordered', {
          channelId: maskId(channelId),
          userId: maskId(userId),
          serverId: maskId(currentChannel.serverId),
          oldPosition,
          newPosition,
          oldSectionId: oldSectionId ? maskId(oldSectionId) : null,
          newSectionId: newSectionId ? maskId(newSectionId) : null,
          isCrossSection: newSectionId !== oldSectionId,
        });

        return true;
      });
    } catch (error) {
      return await this.handleError(error, 'reorder_channel', {
        channelId: maskId(channelId),
        userId: maskId(userId),
        newPosition,
        newSectionId: newSectionId ? maskId(newSectionId) : null,
      });
    }
  }

  /**
   * Handle cross-section channel move
   * Private helper for reordering logic
   */
  private async handleCrossSectionMove(
    tx: any,
    channelId: string,
    oldPosition: number,
    newPosition: number,
    oldSectionId: string | null,
    newSectionId: string,
    serverId: string
  ): Promise<void> {
    // Step 1: Shift channels in old section to fill the gap
    await tx.channel.updateMany({
      where: {
        serverId,
        sectionId: oldSectionId,
        position: { gt: oldPosition },
      },
      data: {
        position: { decrement: 1 },
      },
    });

    // Step 2: Shift channels in new section to make space
    await tx.channel.updateMany({
      where: {
        serverId,
        sectionId: newSectionId,
        position: { gte: newPosition },
      },
      data: {
        position: { increment: 1 },
      },
    });

    // Step 3: Move the channel to new section and position
    await tx.channel.update({
      where: { id: channelId },
      data: {
        sectionId: newSectionId,
        position: newPosition,
      },
    });
  }

  /**
   * Handle same-section channel move
   * Private helper for reordering logic
   */
  private async handleSameSectionMove(
    tx: any,
    channelId: string,
    oldPosition: number,
    newPosition: number,
    sectionId: string | null,
    serverId: string
  ): Promise<void> {
    if (newPosition > oldPosition) {
      // Moving down: shift channels between old and new position up
      await tx.channel.updateMany({
        where: {
          serverId,
          sectionId,
          position: {
            gt: oldPosition,
            lte: newPosition,
          },
        },
        data: {
          position: { decrement: 1 },
        },
      });
    } else {
      // Moving up: shift channels between new and old position down
      await tx.channel.updateMany({
        where: {
          serverId,
          sectionId,
          position: {
            gte: newPosition,
            lt: oldPosition,
          },
        },
        data: {
          position: { increment: 1 },
        },
      });
    }

    // Update the channel's position
    await tx.channel.update({
      where: { id: channelId },
      data: { position: newPosition },
    });
  }
}
