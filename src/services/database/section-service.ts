import { BaseDatabaseService } from './base-service';
import { Section } from '../types';
import { apiLogger } from '@/lib/enhanced-logger';
import {
  NotFoundError,
  AuthorizationError,
  ValidationError,
  maskId,
} from '@/lib/error-handling';

/**
 * SectionService
 *
 * Consolidates section operations including CRUD, reordering, and server organization.
 * Handles the complex relationships between servers, sections, and channels.
 */
export class SectionService extends BaseDatabaseService {
  /**
   * Create a new section in a server
   * Admin-only operation
   */
  async createSection(
    data: {
      name: string;
      serverId: string;
    },
    creatorId: string
  ): Promise<Section> {
    try {
      this.validateRequired(data.name, 'section name');
      this.validateId(data.serverId, 'serverId');
      this.validateId(creatorId, 'creatorId');

      if (data.name.length > 100) {
        throw new ValidationError('Section name cannot exceed 100 characters');
      }

      // Step 1: Verify user has admin access to server
      const server = await this.prisma.server.findFirst({
        where: {
          id: data.serverId,
          OR: [
            { ownerId: creatorId }, // Server owner
            {
              members: {
                some: {
                  userId: creatorId,
                  user: { isAdmin: true }, // Global admin
                },
              },
            },
          ],
        },
      });

      if (!server) {
        throw new AuthorizationError(
          'Server not found or insufficient permissions'
        );
      }

      // Step 2: Get next position
      const maxPosition = await this.prisma.section.aggregate({
        where: { serverId: data.serverId },
        _max: { position: true },
      });

      const nextPosition = (maxPosition._max.position || 0) + 1;

      // Step 3: Create section
      const section = await this.prisma.section.create({
        data: {
          name: data.name,
          serverId: data.serverId,
          creatorId,
          position: nextPosition,
        },
        include: {
          channels: {
            orderBy: { position: 'asc' },
          },
        },
      });

      this.logSuccess('section_created', {
        sectionId: maskId(section.id),
        serverId: maskId(data.serverId),
        creatorId: maskId(creatorId),
        name: data.name.substring(0, 20),
        position: nextPosition,
      });

      return section as Section;
    } catch (error) {
      return await this.handleError(error, 'create_section', {
        serverId: maskId(data.serverId),
        creatorId: maskId(creatorId),
        name: data.name.substring(0, 20),
      });
    }
  }

  /**
   * Update section details
   */
  async updateSection(
    sectionId: string,
    data: {
      name?: string;
    },
    userId: string
  ): Promise<Section> {
    try {
      this.validateId(sectionId, 'sectionId');
      this.validateId(userId, 'userId');

      if (data.name && data.name.length > 100) {
        throw new ValidationError('Section name cannot exceed 100 characters');
      }

      // Step 1: Find section and verify permissions
      const section = await this.prisma.section.findFirst({
        where: { id: sectionId },
        include: {
          server: {
            include: {
              members: {
                where: { userId },
                include: { user: true },
              },
            },
          },
        },
      });

      if (!section) {
        throw new NotFoundError('Section not found');
      }

      const member = section.server.members[0];
      const isOwner = section.server.ownerId === userId;
      const isGlobalAdmin = member?.user?.isAdmin || false;

      if (!isOwner && !isGlobalAdmin) {
        throw new AuthorizationError(
          'Insufficient permissions to update section'
        );
      }

      // Step 2: Update section
      const updatedSection = await this.prisma.section.update({
        where: { id: sectionId },
        data: {
          ...(data.name && { name: data.name }),
        },
        include: {
          channels: {
            orderBy: { position: 'asc' },
          },
        },
      });

      this.logSuccess('section_updated', {
        sectionId: maskId(sectionId),
        userId: maskId(userId),
        updatedFields: Object.keys(data),
      });

      return updatedSection as Section;
    } catch (error) {
      return await this.handleError(error, 'update_section', {
        sectionId: maskId(sectionId),
        userId: maskId(userId),
      });
    }
  }

  /**
   * Delete a section
   * All channels within section will be deleted along with their messages
   */
  async deleteSection(sectionId: string, userId: string): Promise<boolean> {
    try {
      this.validateId(sectionId, 'sectionId');
      this.validateId(userId, 'userId');

      // Step 1: Find section and verify permissions
      const section = await this.prisma.section.findFirst({
        where: { id: sectionId },
        include: {
          server: {
            include: {
              members: {
                where: { userId },
                include: { user: true },
              },
            },
          },
          channels: true,
        },
      });

      if (!section) {
        throw new NotFoundError('Section not found');
      }

      const member = section.server.members[0];
      const isOwner = section.server.ownerId === userId;
      const isGlobalAdmin = member?.user?.isAdmin || false;

      if (!isOwner && !isGlobalAdmin) {
        throw new AuthorizationError(
          'Insufficient permissions to delete section'
        );
      }

      // Step 2: Use transaction to handle channel deletion and section deletion
      await this.prisma.$transaction(async tx => {
        // Delete all channels in this section (and their messages)
        if (section.channels.length > 0) {
          // First delete all messages in all channels of this section
          for (const channel of section.channels) {
            await tx.message.deleteMany({
              where: { channelId: channel.id },
            });
          }

          // Then delete all channels in this section
          await tx.channel.deleteMany({
            where: { sectionId },
          });
        }

        // Delete the section
        await tx.section.delete({
          where: { id: sectionId },
        });

        // Reorder remaining sections
        const remainingSections = await tx.section.findMany({
          where: { serverId: section.serverId },
          orderBy: { position: 'asc' },
        });

        for (let i = 0; i < remainingSections.length; i++) {
          await tx.section.update({
            where: { id: remainingSections[i].id },
            data: { position: i + 1 },
          });
        }
      });

      this.logSuccess('section_deleted', {
        sectionId: maskId(sectionId),
        serverId: maskId(section.serverId),
        userId: maskId(userId),
        channelsDeleted: section.channels.length,
      });

      return true;
    } catch (error) {
      await this.handleError(error, 'delete_section', {
        sectionId: maskId(sectionId),
        userId: maskId(userId),
      });
      return false;
    }
  }

  /**
   * Reorder sections within a server
   */
  async reorderSections(
    serverId: string,
    sectionOrder: string[],
    userId: string
  ): Promise<Section[]> {
    try {
      this.validateId(serverId, 'serverId');
      this.validateId(userId, 'userId');

      if (sectionOrder.length === 0) {
        throw new ValidationError('Section order array cannot be empty');
      }

      // Step 1: Verify permissions
      const server = await this.prisma.server.findFirst({
        where: {
          id: serverId,
          OR: [
            { ownerId: userId },
            {
              members: {
                some: {
                  userId,
                  user: { isAdmin: true },
                },
              },
            },
          ],
        },
      });

      if (!server) {
        throw new AuthorizationError(
          'Server not found or insufficient permissions'
        );
      }

      // Step 2: Verify all sections belong to this server
      const sections = await this.prisma.section.findMany({
        where: {
          id: { in: sectionOrder },
          serverId,
        },
      });

      if (sections.length !== sectionOrder.length) {
        throw new ValidationError(
          'Invalid section IDs or sections do not belong to server'
        );
      }

      // Step 3: Use transaction to update positions
      const updatedSections = await this.prisma.$transaction(async tx => {
        const results = [];

        for (let i = 0; i < sectionOrder.length; i++) {
          const updatedSection = await tx.section.update({
            where: { id: sectionOrder[i] },
            data: { position: i + 1 },
            include: {
              channels: {
                orderBy: { position: 'asc' },
              },
            },
          });
          results.push(updatedSection);
        }

        return results;
      });

      this.logSuccess('sections_reordered', {
        serverId: maskId(serverId),
        userId: maskId(userId),
        sectionCount: sectionOrder.length,
      });

      return updatedSections as Section[];
    } catch (error) {
      return await this.handleError(error, 'reorder_sections', {
        serverId: maskId(serverId),
        userId: maskId(userId),
        sectionCount: sectionOrder.length,
      });
    }
  }

  /**
   * List all sections in a server
   */
  async listServerSections(
    serverId: string,
    requestingUserId: string
  ): Promise<Section[]> {
    try {
      this.validateId(serverId, 'serverId');
      this.validateId(requestingUserId, 'requestingUserId');

      // Step 1: Verify user has access to server
      const hasAccess = await this.prisma.server.findFirst({
        where: {
          id: serverId,
          members: {
            some: { userId: requestingUserId },
          },
        },
      });

      if (!hasAccess) {
        throw new AuthorizationError('Server not found or access denied');
      }

      // Step 2: Get sections with channels
      const sections = await this.prisma.section.findMany({
        where: { serverId },
        include: {
          channels: {
            orderBy: { position: 'asc' },
          },
        },
        orderBy: { position: 'asc' },
      });

      this.logSuccess('server_sections_listed', {
        serverId: maskId(serverId),
        requestingUserId: maskId(requestingUserId),
        sectionCount: sections.length,
      });

      return sections as Section[];
    } catch (error) {
      return await this.handleError(error, 'list_server_sections', {
        serverId: maskId(serverId),
        requestingUserId: maskId(requestingUserId),
      });
    }
  }

  /**
   * Get section details by ID
   */
  async getSectionById(
    sectionId: string,
    requestingUserId: string
  ): Promise<Section | null> {
    try {
      this.validateId(sectionId, 'sectionId');
      this.validateId(requestingUserId, 'requestingUserId');

      const section = await this.prisma.section.findFirst({
        where: {
          id: sectionId,
          server: {
            members: {
              some: { userId: requestingUserId },
            },
          },
        },
        include: {
          channels: {
            orderBy: { position: 'asc' },
          },
        },
      });

      if (section) {
        this.logSuccess('section_retrieved_by_id', {
          sectionId: maskId(sectionId),
          requestingUserId: maskId(requestingUserId),
        });
      }

      return section as Section | null;
    } catch (error) {
      return await this.handleError(error, 'get_section_by_id', {
        sectionId: maskId(sectionId),
        requestingUserId: maskId(requestingUserId),
      });
    }
  }
}
