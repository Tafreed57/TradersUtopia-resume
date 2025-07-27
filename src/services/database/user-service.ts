import { BaseDatabaseService } from './base-service';
import { User, CreateUserData, UpdateUserData, UpsertUserData } from '../types';
import { apiLogger } from '@/lib/enhanced-logger';
import { NotFoundError, maskEmail, maskId } from '@/lib/error-handling';

/**
 * UserService - Handles all user/profile database operations
 * Eliminates 35+ duplicate profile lookup and admin check implementations
 */
export class UserService extends BaseDatabaseService {
  /**
   * Find user by userId or email - Most critical method (used 35+ times)
   * Replaces scattered profile lookup implementations across the codebase
   */
  async findByUserIdOrEmail(userIdOrEmail: string): Promise<User | null> {
    this.validateRequired(userIdOrEmail, 'userIdOrEmail');

    try {
      const user = await this.prisma.user.findFirst({
        where: {
          OR: [{ userId: userIdOrEmail }, { email: userIdOrEmail }],
        },
      });

      // Log with security context
      this.logSuccess('user_lookup', {
        found: !!user,
        isAdmin: user?.isAdmin || false,
        identifier: userIdOrEmail.includes('@')
          ? maskEmail(userIdOrEmail)
          : maskId(userIdOrEmail),
      });

      // Convert null to undefined for TypeScript compatibility
      return user
        ? ({
            ...user,
            imageUrl: user.imageUrl ?? undefined,
          } as User)
        : null;
    } catch (error) {
      return await this.handleError(error, 'find_user_by_id_or_email', {
        identifier: userIdOrEmail.includes('@')
          ? maskEmail(userIdOrEmail)
          : maskId(userIdOrEmail),
      });
    }
  }

  /**
   * Admin checks - used 15+ times with security logging
   * Returns user only if they are admin, null otherwise
   */
  async findAdminById(userId: string): Promise<User | null> {
    const user = await this.findByUserIdOrEmail(userId);

    if (!user) {
      return null;
    }

    // Only return user if they are admin
    if (!user.isAdmin) {
      // Log security event for failed admin check
      this.logSuccess('admin_check', {
        userId: maskId(userId),
        isAdmin: false,
        accessDenied: true,
      });
      return null;
    }

    // Log successful admin verification
    this.logSuccess('admin_check', {
      userId: maskId(userId),
      isAdmin: true,
      accessGranted: true,
    });

    return user;
  }

  /**
   * Check if user is admin (boolean result)
   * Used for quick permission checks
   */
  async isUserAdmin(userId: string): Promise<boolean> {
    const user = await this.findByUserIdOrEmail(userId);
    const isAdmin = user?.isAdmin || false;

    this.logSuccess('admin_check', {
      userId: maskId(userId),
      isAdmin,
      userFound: !!user,
    });

    return isAdmin;
  }

  /**
   * Find user with subscription data - eliminates 8+ subscription lookup patterns
   */
  async findUserWithSubscriptionData(userId: string): Promise<User | null> {
    this.validateRequired(userId, 'userId');

    try {
      const user = await this.prisma.user.findFirst({
        where: { userId },
        include: {
          subscription: true,
        },
      });

      this.logSuccess('user_with_subscription_lookup', {
        userId: maskId(userId),
        found: !!user,
        hasSubscription: !!user?.subscription,
      });

      // Convert and clean up the data
      return user
        ? ({
            id: user.id,
            userId: user.userId,
            email: user.email,
            name: user.name,
            imageUrl: user.imageUrl ?? undefined,
            isAdmin: user.isAdmin,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
          } as User)
        : null;
    } catch (error) {
      return await this.handleError(error, 'find_user_with_subscription_data', {
        userId: maskId(userId),
      });
    }
  }

  /**
   * Create new user profile - eliminates 8+ user creation patterns
   */
  async createUser(data: CreateUserData): Promise<User> {
    this.validateRequired(data.userId, 'userId');
    this.validateRequired(data.email, 'email');
    this.validateRequired(data.name, 'name');

    return await this.createRecord<User>('user', {
      userId: data.userId,
      email: data.email,
      name: data.name,
      imageUrl: data.imageUrl,
      isAdmin: data.isAdmin || false,
    });
  }

  /**
   * Update user profile - eliminates 6+ user update patterns
   */
  async updateUser(id: string, data: UpdateUserData): Promise<User> {
    this.validateId(id, 'userId');

    return await this.updateRecord<User>('user', id, {
      ...(data.email && { email: data.email }),
      ...(data.name && { name: data.name }),
      ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
      ...(data.isAdmin !== undefined && { isAdmin: data.isAdmin }),
    });
  }

  /**
   * Upsert user (create or update) - eliminates 12+ upsert patterns
   */
  async upsertUser(data: UpsertUserData): Promise<User> {
    this.validateRequired(data.userId, 'userId');
    this.validateRequired(data.email, 'email');
    this.validateRequired(data.name, 'name');

    return await this.upsertRecord<User>(
      'user',
      { userId: data.userId },
      {
        userId: data.userId,
        email: data.email,
        name: data.name,
        imageUrl: data.imageUrl,
        isAdmin: data.isAdmin || false,
      },
      {
        email: data.email,
        name: data.name,
        imageUrl: data.imageUrl,
        ...(data.isAdmin !== undefined && { isAdmin: data.isAdmin }),
      }
    );
  }

  /**
   * Find user by Clerk user ID
   * Most common lookup pattern
   */
  async findByClerkId(clerkUserId: string): Promise<User | null> {
    return await this.findByUserIdOrEmail(clerkUserId);
  }

  /**
   * Check if email is already registered
   */
  async emailExists(email: string): Promise<boolean> {
    this.validateRequired(email, 'email');

    return await this.recordExists('user', { email });
  }

  /**
   * Check if Clerk user ID is already registered
   */
  async clerkIdExists(clerkUserId: string): Promise<boolean> {
    this.validateRequired(clerkUserId, 'clerkUserId');

    return await this.recordExists('user', { userId: clerkUserId });
  }

  /**
   * Check if user exists by email - eliminates duplicate existence checks
   */
  async userExistsByEmail(email: string): Promise<boolean> {
    this.validateRequired(email, 'email');

    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
      });

      this.logSuccess('user_email_lookup', {
        email: maskEmail(email),
        exists: !!user,
      });

      return !!user;
    } catch (error) {
      return await this.handleError(error, 'find_user_by_email', {
        email: maskEmail(email),
      });
    }
  }

  /**
   * Check if user exists by email
   */
  async checkUserExistsByEmail(email: string): Promise<boolean> {
    this.validateRequired(email, 'email');

    return await this.recordExists('user', { email });
  }

  /**
   * Check if user exists by Clerk user ID
   */
  async checkUserExistsByClerkId(clerkUserId: string): Promise<boolean> {
    this.validateRequired(clerkUserId, 'clerkUserId');

    return await this.recordExists('user', { userId: clerkUserId });
  }

  /**
   * List all users with optional filters
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
      this.findMany<User>('user', {
        where,
        include,
        take: options.limit || 50,
        skip: options.offset || 0,
        orderBy: { createdAt: 'desc' },
      }),
      this.countRecords('user', where),
    ]);

    // Convert null to undefined for TypeScript compatibility
    const cleanUsers = users.map(user => ({
      ...user,
      imageUrl: (user as any).imageUrl ?? undefined,
    })) as User[];

    return {
      users: cleanUsers,
      total,
    };
  }

  /**
   * Toggle admin status
   * Used in admin management interfaces
   */
  async toggleAdminStatus(userId: string): Promise<User> {
    const user = await this.findByUserIdOrEmail(userId);

    if (!user) {
      throw new NotFoundError('User');
    }

    const updatedUser = await this.updateUser(user.id, {
      isAdmin: !user.isAdmin,
    });

    apiLogger.databaseOperation('admin_status_changed', true, {
      userId: maskId(userId),
      previousStatus: user.isAdmin,
      newStatus: updatedUser.isAdmin,
      email: maskEmail(user.email),
    });

    return updatedUser;
  }

  /**
   * Validate user exists and has required permissions
   * Used in middleware and API route protection
   */
  async validateUserPermissions(
    userId: string,
    requireAdmin: boolean = false
  ): Promise<{
    user: User | null;
    hasPermission: boolean;
    reason?: string;
  }> {
    const user = await this.findByUserIdOrEmail(userId);

    if (!user) {
      return {
        user: null,
        hasPermission: false,
        reason: 'User not found',
      };
    }

    if (requireAdmin && !user.isAdmin) {
      return {
        user,
        hasPermission: false,
        reason: 'Admin privileges required',
      };
    }

    return {
      user,
      hasPermission: true,
    };
  }

  /**
   * Find or create user (common pattern in webhooks)
   */
  async findOrCreateUser(data: CreateUserData): Promise<User> {
    const existingUser = await this.findByClerkId(data.userId);

    if (existingUser) {
      return existingUser;
    }

    return await this.createUser(data);
  }

  /**
   * Get user with push subscriptions
   * Used for push notification targeting
   */
  async getUserWithPushSubscriptions(userId: string): Promise<{
    id: string;
    userId: string;
    pushSubscriptions: Array<{
      endpoint: string;
      keys: {
        p256dh: string;
        auth: string;
      };
    }>;
  } | null> {
    this.validateRequired(userId, 'userId');

    try {
      const user = await this.prisma.user.findFirst({
        where: { userId },
        select: {
          id: true,
          userId: true,
          pushSubscriptions: {
            select: {
              endpoint: true,
              keys: true,
            },
          },
        },
      });

      if (!user) {
        return null;
      }

      // Transform the data to match expected format
      return {
        id: user.id,
        userId: user.userId,
        pushSubscriptions: user.pushSubscriptions.map((sub: any) => ({
          endpoint: sub.endpoint,
          keys: sub.keys as { p256dh: string; auth: string },
        })),
      };
    } catch (error) {
      return await this.handleError(error, 'get_user_with_push_subscriptions', {
        userId: maskId(userId),
      });
    }
  }

  /**
   * Add or update push subscription for a user
   */
  async upsertPushSubscription(
    userId: string,
    subscription: {
      endpoint: string;
      keys: {
        p256dh: string;
        auth: string;
      };
    }
  ): Promise<boolean> {
    this.validateRequired(userId, 'userId');
    this.validateRequired(subscription.endpoint, 'subscription.endpoint');

    try {
      // First, ensure the user exists
      const user = await this.findByUserIdOrEmail(userId);
      if (!user) {
        throw new NotFoundError('User');
      }

      // Use upsert to create or update the push subscription
      await this.prisma.pushSubscription.upsert({
        where: {
          endpoint: subscription.endpoint,
        },
        update: {
          keys: subscription.keys,
        },
        create: {
          userId: user.id, // Use the internal ID
          endpoint: subscription.endpoint,
          keys: subscription.keys,
        },
      });

      this.logSuccess('push_subscription_upsert', {
        userId: maskId(userId),
        endpoint: subscription.endpoint.substring(0, 50) + '...',
      });

      return true;
    } catch (error) {
      return await this.handleError(error, 'upsert_push_subscription', {
        userId: maskId(userId),
        endpoint: subscription.endpoint.substring(0, 50) + '...',
      });
    }
  }

  /**
   * Remove invalid push subscriptions for a user
   */
  async removeInvalidPushSubscriptions(
    userId: string,
    invalidEndpoints: string[]
  ): Promise<void> {
    this.validateRequired(userId, 'userId');

    if (invalidEndpoints.length === 0) {
      return;
    }

    try {
      // First, ensure the user exists
      const user = await this.findByUserIdOrEmail(userId);
      if (!user) {
        throw new NotFoundError('User');
      }

      // Remove invalid subscriptions
      await this.prisma.pushSubscription.deleteMany({
        where: {
          userId: user.id,
          endpoint: {
            in: invalidEndpoints,
          },
        },
      });

      this.logSuccess('push_subscription_cleanup', {
        userId: maskId(userId),
        removedCount: invalidEndpoints.length,
      });
    } catch (error) {
      return await this.handleError(
        error,
        'remove_invalid_push_subscriptions',
        {
          userId: maskId(userId),
          invalidCount: invalidEndpoints.length,
        }
      );
    }
  }
}
