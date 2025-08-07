import { BaseDatabaseService } from './base-service';
import {
  User,
  CreateUserData,
  UpdateUserData,
  UpsertUserData,
  Subscription,
} from '../types';
import { apiLogger } from '@/lib/enhanced-logger';
import { NotFoundError, maskEmail, maskId } from '@/lib/error-handling';

/**
 * UserService - Handles all user/profile database operations
 * Eliminates 35+ duplicate profile lookup and admin check implementations
 * Updated for simplified subscription schema
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
          OR: [{ id: userIdOrEmail }, { email: userIdOrEmail }],
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
      return this.handleError(error, 'find_user_by_id_or_email', {
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
   * Find user with subscription data - updated for simplified subscription schema
   * Eliminates 8+ subscription lookup patterns
   */
  async findUserWithSubscriptionData(
    userId: string
  ): Promise<(User & { subscription?: Subscription | null }) | null> {
    this.validateRequired(userId, 'userId');

    try {
      const user = await this.prisma.user.findFirst({
        where: { id: userId },
        include: {
          subscription: true,
        },
      });

      this.logSuccess('user_with_subscription_lookup', {
        userId: maskId(userId),
        found: !!user,
        hasSubscription: !!user?.subscription,
        subscriptionStatus: user?.subscription?.status || 'NO_SUBSCRIPTION',
      });

      // Convert and clean up the data
      return user
        ? ({
            id: user.id,
            email: user.email,
            name: user.name,
            imageUrl: user.imageUrl ?? undefined,
            isAdmin: user.isAdmin,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            subscription: user.subscription,
          } as User & { subscription?: Subscription | null })
        : null;
    } catch (error) {
      return this.handleError(error, 'find_user_with_subscription_data', {
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
      id: data.userId, // Use Clerk ID as primary key
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
      { id: data.userId },
      {
        id: data.userId,
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

    return await this.recordExists('user', { id: clerkUserId });
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

    return await this.recordExists('user', { id: clerkUserId });
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
   * Safely grant admin access to a user
   * Returns boolean indicating success/failure
   * Used by admin operations and system processes
   */
  async grantAdminStatus(targetUserId: string): Promise<boolean> {
    try {
      // Find the user first
      const user = await this.findByUserIdOrEmail(targetUserId);

      if (!user) {
        apiLogger.databaseOperation('grant_admin_failed', false, {
          userId: maskId(targetUserId),
          reason: 'User not found',
        });
        return false;
      }

      // If already admin, return true
      if (user.isAdmin) {
        apiLogger.adminAction(
          'grant_admin_already_admin',
          'system',
          user.email,
          {
            userId: maskId(targetUserId),
          }
        );
        return true;
      }

      // Grant admin status
      await this.updateUser(user.id, { isAdmin: true });

      apiLogger.adminAction('grant_admin_success', 'system', user.email, {
        userId: maskId(targetUserId),
      });

      return true;
    } catch (error) {
      this.handleError(error, 'grant_admin_status', {
        userId: maskId(targetUserId),
      });
      return false;
    }
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
   * Used for push notification targeting - now filters by active subscriptions
   */
  async getUserWithPushSubscriptions(userId: string): Promise<{
    id: string;
    pushSubscriptions: Array<{
      id: string;
      endpoint: string;
      keys: {
        p256dh: string;
        auth: string;
      };
      isActive: boolean;
      failureCount: number;
      lastActive: Date;
    }>;
  } | null> {
    this.validateRequired(userId, 'userId');

    try {
      const user = await this.prisma.user.findFirst({
        where: { id: userId },
        select: {
          id: true,
          pushSubscriptions: {
            where: {
              isActive: true,
              failureCount: { lt: 5 }, // Skip subscriptions with too many failures
            },
            select: {
              id: true,
              endpoint: true,
              keys: true,
              isActive: true,
              failureCount: true,
              lastActive: true,
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
        pushSubscriptions: user.pushSubscriptions.map((sub: any) => ({
          id: sub.id,
          endpoint: sub.endpoint,
          keys: sub.keys as { p256dh: string; auth: string },
          isActive: sub.isActive,
          failureCount: sub.failureCount,
          lastActive: sub.lastActive,
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
   * Enhanced with device tracking and activity updates
   */
  async upsertPushSubscription(
    userId: string,
    subscription: {
      endpoint: string;
      keys: {
        p256dh: string;
        auth: string;
      };
    },
    deviceInfo?: {
      browser?: string;
      os?: string;
      deviceType?: string;
      userAgent?: string;
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
          deviceInfo: deviceInfo || undefined,
          lastActive: new Date(),
          isActive: true, // Reactivate if previously disabled
          failureCount: 0, // Reset failure count on update
        },
        create: {
          userId: user.id, // Use the internal ID
          endpoint: subscription.endpoint,
          keys: subscription.keys,
          deviceInfo: deviceInfo || undefined,
          lastActive: new Date(),
          isActive: true,
          failureCount: 0,
        },
      });

      this.logSuccess('push_subscription_upsert', {
        userId: maskId(userId),
        endpoint: subscription.endpoint.substring(0, 50) + '...',
        hasDeviceInfo: !!deviceInfo,
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
   * Update last active timestamp for a push subscription
   */
  async updatePushSubscriptionActivity(subscriptionId: string): Promise<void> {
    this.validateRequired(subscriptionId, 'subscriptionId');

    try {
      await this.prisma.pushSubscription.update({
        where: { id: subscriptionId },
        data: { lastActive: new Date() },
      });

      this.logSuccess('push_subscription_activity_updated', {
        subscriptionId: maskId(subscriptionId),
      });
    } catch (error) {
      return await this.handleError(
        error,
        'update_push_subscription_activity',
        {
          subscriptionId: maskId(subscriptionId),
        }
      );
    }
  }

  /**
   * Increment failure count for a push subscription
   */
  async incrementPushFailureCount(subscriptionId: string): Promise<void> {
    this.validateRequired(subscriptionId, 'subscriptionId');

    try {
      await this.prisma.pushSubscription.update({
        where: { id: subscriptionId },
        data: {
          failureCount: { increment: 1 },
          lastActive: new Date(),
        },
      });

      this.logSuccess('push_subscription_failure_incremented', {
        subscriptionId: maskId(subscriptionId),
      });
    } catch (error) {
      return await this.handleError(error, 'increment_push_failure_count', {
        subscriptionId: maskId(subscriptionId),
      });
    }
  }

  /**
   * Deactivate a push subscription (instead of deleting)
   */
  async deactivatePushSubscription(subscriptionId: string): Promise<void> {
    this.validateRequired(subscriptionId, 'subscriptionId');

    try {
      await this.prisma.pushSubscription.update({
        where: { id: subscriptionId },
        data: {
          isActive: false,
          lastActive: new Date(),
        },
      });

      this.logSuccess('push_subscription_deactivated', {
        subscriptionId: maskId(subscriptionId),
      });
    } catch (error) {
      return await this.handleError(error, 'deactivate_push_subscription', {
        subscriptionId: maskId(subscriptionId),
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

      // Deactivate invalid subscriptions instead of deleting
      await this.prisma.pushSubscription.updateMany({
        where: {
          userId: user.id,
          endpoint: {
            in: invalidEndpoints,
          },
        },
        data: {
          isActive: false,
          lastActive: new Date(),
        },
      });

      this.logSuccess('push_subscription_cleanup', {
        userId: maskId(userId),
        deactivatedCount: invalidEndpoints.length,
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

  /**
   * Check user's subscription status
   * Returns the current subscription status or FREE for users without subscriptions
   */
  async getUserSubscriptionStatus(userId: string): Promise<{
    status: string;
    hasActiveSubscription: boolean;
    currentPeriodEnd?: Date;
    stripeSubscriptionId?: string;
  }> {
    this.validateRequired(userId, 'userId');

    try {
      const user = await this.prisma.user.findFirst({
        where: { id: userId },
        include: {
          subscription: true,
        },
      });

      const subscription = user?.subscription;
      const status = subscription?.status || 'FREE';
      const hasActiveSubscription =
        status === 'ACTIVE' || status === 'TRIALING';

      this.logSuccess('subscription_status_check', {
        userId: maskId(userId),
        status,
        hasActiveSubscription,
        hasSubscription: !!subscription,
      });

      return {
        status,
        hasActiveSubscription,
        currentPeriodEnd: subscription?.currentPeriodEnd ?? undefined,
        stripeSubscriptionId: subscription?.stripeSubscriptionId,
      };
    } catch (error) {
      return await this.handleError(error, 'get_user_subscription_status', {
        userId: maskId(userId),
      });
    }
  }

  /**
   * Find users by subscription status
   * Useful for admin operations and subscription management
   */
  async findUsersBySubscriptionStatus(
    status: string,
    options: {
      limit?: number;
      offset?: number;
      includeUserDetails?: boolean;
    } = {}
  ): Promise<{
    users: Array<User & { subscription?: Subscription }>;
    total: number;
  }> {
    const { limit = 50, offset = 0, includeUserDetails = true } = options;

    try {
      const where =
        status === 'FREE'
          ? { subscription: { is: null } }
          : { subscription: { is: { status: status as any } } };

      const include = includeUserDetails ? { subscription: true } : undefined;

      const [users, total] = await Promise.all([
        this.prisma.user.findMany({
          where,
          include,
          take: limit,
          skip: offset,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.user.count({ where }),
      ]);

      this.logSuccess('users_by_subscription_status', {
        status,
        count: users.length,
        total,
        limit,
        offset,
      });

      // Convert to proper types
      const cleanUsers = users.map(user => ({
        ...user,
        imageUrl: user.imageUrl ?? undefined,
        subscription: (user as any).subscription || undefined,
      })) as Array<User & { subscription?: Subscription }>;

      return {
        users: cleanUsers,
        total,
      };
    } catch (error) {
      return await this.handleError(
        error,
        'find_users_by_subscription_status',
        {
          status,
          limit,
          offset,
        }
      );
    }
  }

  /**
   * Check if user has active subscription (ACTIVE or TRIALING)
   * Quick boolean check for access control
   */
  async hasActiveSubscription(userId: string): Promise<boolean> {
    const statusCheck = await this.getUserSubscriptionStatus(userId);
    return statusCheck.hasActiveSubscription;
  }

  /**
   * Get subscription expiry information for a user
   * Returns details about when subscription expires and grace period status
   */
  async getSubscriptionExpiryInfo(userId: string): Promise<{
    hasSubscription: boolean;
    currentPeriodEnd?: Date;
    isExpired: boolean;
    isInGracePeriod: boolean;
    daysUntilExpiry?: number;
  }> {
    this.validateRequired(userId, 'userId');

    try {
      const user = await this.prisma.user.findFirst({
        where: { id: userId },
        include: { subscription: true },
      });

      const subscription = user?.subscription;
      const now = new Date();

      if (!subscription || !subscription.currentPeriodEnd) {
        return {
          hasSubscription: false,
          isExpired: false,
          isInGracePeriod: false,
        };
      }

      const currentPeriodEnd = subscription.currentPeriodEnd;
      const isExpired = currentPeriodEnd < now;
      const daysUntilExpiry = Math.ceil(
        (currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Grace period: 3 days after expiry for PAST_DUE status
      const gracePeriodEnd = new Date(
        currentPeriodEnd.getTime() + 3 * 24 * 60 * 60 * 1000
      );
      const isInGracePeriod =
        isExpired && now < gracePeriodEnd && subscription.status === 'PAST_DUE';

      this.logSuccess('subscription_expiry_check', {
        userId: maskId(userId),
        hasSubscription: true,
        isExpired,
        isInGracePeriod,
        daysUntilExpiry,
        status: subscription.status,
      });

      return {
        hasSubscription: true,
        currentPeriodEnd,
        isExpired,
        isInGracePeriod,
        daysUntilExpiry,
      };
    } catch (error) {
      return await this.handleError(error, 'get_subscription_expiry_info', {
        userId: maskId(userId),
      });
    }
  }

  /**
   * Get users eligible for channel notifications - OPTIMIZED for message notifications
   * Returns users who:
   * - Have active push subscriptions
   * - Are members of the specified server
   * - Have explicitly enabled notifications for the specified channel
   * - Have active Stripe subscriptions OR are admins
   *
   * This replaces the inefficient pattern of getting all server members + N+1 preference queries
   */
  async getUsersEligibleForChannelNotifications(
    serverId: string,
    channelId: string,
    excludeUserId?: string
  ): Promise<
    Array<{
      id: string;
      name: string;
      email: string;
      isAdmin: boolean;
      pushSubscriptions: Array<{
        id: string;
        endpoint: string;
        keys: { p256dh: string; auth: string };
        isActive: boolean;
        failureCount: number;
      }>;
    }>
  > {
    this.validateId(serverId, 'serverId');
    this.validateId(channelId, 'channelId');

    try {
      // Single optimized query that gets only users who need notifications
      const eligibleUsers = await this.prisma.user.findMany({
        where: {
          // Must be a member of the server
          members: {
            some: {
              serverId: serverId,
            },
          },
          // Must have explicitly enabled notifications for this channel
          channelNotificationPreferences: {
            some: {
              channelId: channelId,
              enabled: true,
            },
          },
          // Must have active push subscriptions
          pushSubscriptions: {
            some: {
              isActive: true,
              failureCount: { lt: 5 },
            },
          },
          // Must have active subscription OR be admin
          OR: [
            { isAdmin: true },
            {
              subscription: {
                status: 'ACTIVE',
              },
            },
          ],
        },
        select: {
          id: true,
          name: true,
          email: true,
          isAdmin: true,
          pushSubscriptions: {
            where: {
              isActive: true,
              failureCount: { lt: 5 },
            },
            select: {
              id: true,
              endpoint: true,
              keys: true,
              isActive: true,
              failureCount: true,
            },
          },
        },
      });

      // Transform push subscription keys to proper format
      const transformedUsers = eligibleUsers.map(user => ({
        ...user,
        pushSubscriptions: user.pushSubscriptions.map(sub => ({
          ...sub,
          keys: sub.keys as { p256dh: string; auth: string },
        })),
      }));

      this.logSuccess('users_eligible_for_channel_notifications', {
        serverId: maskId(serverId),
        channelId: maskId(channelId),
        excludeUserId: excludeUserId ? maskId(excludeUserId) : undefined,
        eligibleCount: transformedUsers.length,
        totalPushSubscriptions: transformedUsers.reduce(
          (acc, user) => acc + user.pushSubscriptions.length,
          0
        ),
      });

      return transformedUsers;
    } catch (error) {
      return this.handleError(
        error,
        'get_users_eligible_for_channel_notifications',
        {
          serverId: maskId(serverId),
          channelId: maskId(channelId),
          excludeUserId: excludeUserId ? maskId(excludeUserId) : undefined,
        }
      );
    }
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
      const user = await this.findByUserIdOrEmail(userId);
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

        // 10. Delete subscription (if exists)
        const subscription = await tx.subscription.findUnique({
          where: { userId: user.id },
        });

        if (subscription) {
          await tx.subscription.delete({
            where: { userId: user.id },
          });
        }

        // 11. Finally, delete the user record
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
    }
  }
}
