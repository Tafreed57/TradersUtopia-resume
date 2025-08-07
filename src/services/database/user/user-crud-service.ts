import { BaseDatabaseService } from '../base-service';
import { User, CreateUserData, UpdateUserData } from '../../types';
import { maskEmail, maskId } from '@/lib/error-handling';

/**
 * UserCrudService - Handles basic user CRUD operations
 *
 * Contains only the core create, read, update, delete operations that are actively used.
 * Focuses on data persistence without business logic.
 */
export class UserCrudService extends BaseDatabaseService {
  /**
   * Create new user
   * Used in webhooks and user registration flows
   */
  async createUser(data: CreateUserData): Promise<User> {
    this.validateRequired(data.userId, 'userId');
    this.validateRequired(data.email, 'email');
    this.validateRequired(data.name, 'name');

    try {
      const user = await this.prisma.user.create({
        data: {
          id: data.userId,
          email: data.email,
          name: data.name,
          imageUrl: data.imageUrl,
          ...(data.isAdmin !== undefined && { isAdmin: data.isAdmin }),
        },
      });

      this.logSuccess('user_created', {
        userId: maskId(user.id),
        email: maskEmail(user.email),
        isAdmin: user.isAdmin,
      });

      return {
        ...user,
        imageUrl: user.imageUrl ?? undefined,
      } as User;
    } catch (error) {
      return this.handleError(error, 'create_user', {
        userId: maskId(data.userId),
        email: maskEmail(data.email),
      });
    }
  }

  /**
   * Update user data
   * Used in webhooks and profile update operations
   */
  async updateUser(id: string, data: UpdateUserData): Promise<User> {
    this.validateRequired(id, 'id');

    try {
      const user = await this.prisma.user.update({
        where: { id },
        data: {
          ...(data.email && { email: data.email }),
          ...(data.name && { name: data.name }),
          ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
          ...(data.isAdmin !== undefined && { isAdmin: data.isAdmin }),
        },
      });

      this.logSuccess('user_updated', {
        userId: maskId(id),
        updatedFields: Object.keys(data),
      });

      return {
        ...user,
        imageUrl: user.imageUrl ?? undefined,
      } as User;
    } catch (error) {
      return this.handleError(error, 'update_user', {
        userId: maskId(id),
        updateData: Object.keys(data),
      });
    }
  }

  /**
   * List all users with optional filters
   * Used in admin operations
   */
  async listUsers(
    options: {
      adminOnly?: boolean;
      includeSubscription?: boolean;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ users: User[]; total: number }> {
    const where: any = {};

    if (options.adminOnly) {
      where.isAdmin = true;
    }

    const include = options.includeSubscription
      ? { subscription: true }
      : undefined;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include,
        take: options.limit || 50,
        skip: options.offset || 0,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    this.logSuccess('users_listed', {
      count: users.length,
      total,
      adminOnly: options.adminOnly,
      includeSubscription: options.includeSubscription,
    });

    return {
      users: users.map(user => ({
        ...user,
        imageUrl: user.imageUrl ?? undefined,
      })) as User[],
      total,
    };
  }

  /**
   * Delete user and all related data (database only)
   * Handles cascade deletion of all user-related records in proper order
   * Used by Clerk webhooks and admin deletion operations
   */
  async deleteUser(userId: string): Promise<boolean> {
    this.validateRequired(userId, 'userId');

    try {
      // First, find the user to ensure they exist
      const user = await this.prisma.user.findFirst({
        where: { id: userId },
      });

      if (!user) {
        this.logSuccess('user_delete_not_found', {
          userId: maskId(userId),
          reason: 'User not found',
        });
        return true; // Consider non-existent user as successfully deleted
      }

      // Execute deletion in transaction to ensure data consistency
      await this.executeTransaction(async tx => {
        // Delete in reverse dependency order to avoid foreign key constraints

        // 1. Delete push subscriptions
        await tx.pushSubscription.deleteMany({
          where: { userId: user.id },
        });

        // 2. Delete channel notification preferences
        await tx.channelNotificationPreference.deleteMany({
          where: { userId: user.id },
        });

        // 3. Delete notifications
        await tx.notification.deleteMany({
          where: { userId: user.id },
        });

        // 4. Delete messages by user (soft delete via deleted flag)
        // First find all member records for this user to get their memberId
        const userMembers = await tx.member.findMany({
          where: { userId: user.id },
          select: { id: true },
        });

        if (userMembers.length > 0) {
          const memberIds = userMembers.map(member => member.id);
          await tx.message.updateMany({
            where: { memberId: { in: memberIds } },
            data: {
              deleted: true,
              content: '[User Deleted]',
            },
          });
        }

        // 5. Delete user memberships
        await tx.member.deleteMany({
          where: { userId: user.id },
        });

        // 6. Delete subscription (if exists)
        const subscription = await tx.subscription.findUnique({
          where: { userId: user.id },
        });

        if (subscription) {
          await tx.subscription.delete({
            where: { userId: user.id },
          });
        }

        // 7. Finally, delete the user record
        await tx.user.delete({
          where: { id: user.id },
        });
      });

      this.logSuccess('user_deleted', {
        userId: maskId(userId),
        email: maskEmail(user.email),
        isAdmin: user.isAdmin,
        cascadeDeleted: true,
      });

      return true;
    } catch (error) {
      this.handleError(error, 'delete_user', {
        userId: maskId(userId),
      });
      return false;
    }
  }
}
