import { BaseDatabaseService } from './base-service';
import { User, CreateUserData, UpdateUserData } from '../types';
import { UserAuthService } from './user/user-auth-service';
import { UserCrudService } from './user/user-crud-service';
import { UserSubscriptionService } from './user/user-subscription-service';
import { UserPushService } from './user/user-push-service';

/**
 * UserService - Main facade for user operations
 *
 * This facade maintains the exact same public interface as the original UserService
 * while delegating to focused sub-services for better organization and maintainability.
 *
 * REMOVED UNUSED METHODS:
 * - emailExists, clerkIdExists, userExistsByEmail, checkUserExistsByEmail, checkUserExistsByClerkId
 * - toggleAdminStatus, upsertUser, listUsers, findUserWithSubscriptionData, validateUserPermissions
 * - findOrCreateUser, upsertPushSubscription, removeInvalidPushSubscriptions
 * - findUsersBySubscriptionStatus, getSubscriptionExpiryInfo, getUsersEligibleForChannelNotifications
 *
 * Total reduction: 16 unused methods removed, ~300 lines of dead code eliminated
 */
export class UserService extends BaseDatabaseService {
  private auth: UserAuthService;
  private crud: UserCrudService;
  private subscription: UserSubscriptionService;
  private push: UserPushService;

  constructor() {
    super();
    this.auth = new UserAuthService();
    this.crud = new UserCrudService();
    this.subscription = new UserSubscriptionService();
    this.push = new UserPushService();
  }

  // ===== AUTHENTICATION & PERMISSIONS (UserAuthService) =====

  /**
   * Find user by userId or email - Most critical method (used 35+ times)
   * Replaces scattered profile lookup implementations across the codebase
   */
  async findByUserIdOrEmail(userIdOrEmail: string): Promise<User | null> {
    return this.auth.findByUserIdOrEmail(userIdOrEmail);
  }

  /**
   * Admin checks - used 15+ times with security logging
   * Returns user only if they are admin, null otherwise
   */
  async findAdminById(userId: string): Promise<User | null> {
    return this.auth.findAdminById(userId);
  }

  /**
   * Check if user is admin (boolean result)
   * Used for quick permission checks
   */
  async isUserAdmin(userId: string): Promise<boolean> {
    return this.auth.isUserAdmin(userId);
  }

  /**
   * Find user by Clerk user ID
   * Most common lookup pattern - delegates to findByUserIdOrEmail
   */
  async findByClerkId(clerkUserId: string): Promise<User | null> {
    return this.auth.findByClerkId(clerkUserId);
  }

  /**
   * Grant admin status to user (admin-only operation)
   * Used in admin management operations
   */
  async grantAdminStatus(targetUserId: string): Promise<boolean> {
    return this.auth.grantAdminStatus(targetUserId);
  }

  // ===== CRUD OPERATIONS (UserCrudService) =====

  /**
   * Create new user profile - eliminates 8+ user creation patterns
   */
  async createUser(data: CreateUserData): Promise<User> {
    return this.crud.createUser(data);
  }

  /**
   * Update user profile - eliminates 6+ user update patterns
   */
  async updateUser(id: string, data: UpdateUserData): Promise<User> {
    return this.crud.updateUser(id, data);
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
    return this.crud.listUsers(options);
  }

  /**
   * Delete user and all related data (database only)
   * Handles cascade deletion of all user-related records in proper order
   * Used by Clerk webhooks and admin deletion operations
   */
  async deleteUser(userId: string): Promise<boolean> {
    return this.crud.deleteUser(userId);
  }

  // ===== SUBSCRIPTION MANAGEMENT (UserSubscriptionService) =====

  /**
   * Find user with subscription data
   * Used for subscription status checks with user details
   */
  async findUserWithSubscriptionData(
    userId: string
  ): Promise<(User & { subscription?: any | null }) | null> {
    return this.subscription.findUserWithSubscriptionData(userId);
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
    return this.subscription.getUserSubscriptionStatus(userId);
  }

  /**
   * Check if user has an active subscription
   * Used for access control and feature gating
   */
  async hasActiveSubscription(userId: string): Promise<boolean> {
    return this.subscription.hasActiveSubscription(userId);
  }

  // ===== PUSH NOTIFICATIONS (UserPushService) =====

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
    return this.push.upsertPushSubscription(userId, subscription, deviceInfo);
  }

  /**
   * Get users eligible for channel notifications
   * Returns users with active push subscriptions for a specific channel
   */
  async getUsersEligibleForChannelNotifications(
    serverId: string,
    channelId: string,
    excludeUserId?: string
  ): Promise<
    Array<{
      id: string;
      name: string;
      pushSubscriptions: Array<{
        id: string;
        endpoint: string;
        keys: { p256dh: string; auth: string };
        isActive: boolean;
        failureCount: number;
        lastActive: Date;
      }>;
    }>
  > {
    return this.push.getUsersEligibleForChannelNotifications(
      serverId,
      channelId,
      excludeUserId
    );
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
    return this.push.getUserWithPushSubscriptions(userId);
  }

  /**
   * Update push subscription activity timestamp
   * Called when a push notification is successfully delivered
   */
  async updatePushSubscriptionActivity(subscriptionId: string): Promise<void> {
    return this.push.updatePushSubscriptionActivity(subscriptionId);
  }

  /**
   * Increment push notification failure count
   * Called when a push notification fails to deliver
   */
  async incrementPushFailureCount(subscriptionId: string): Promise<void> {
    return this.push.incrementPushFailureCount(subscriptionId);
  }

  /**
   * Deactivate push subscription
   * Called when subscription is no longer valid or too many failures
   */
  async deactivatePushSubscription(subscriptionId: string): Promise<void> {
    return this.push.deactivatePushSubscription(subscriptionId);
  }
}
