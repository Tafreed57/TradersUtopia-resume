import { BaseDatabaseService } from '../base-service';
import { User, Subscription } from '../../types';
import { maskId } from '@/lib/error-handling';

/**
 * UserSubscriptionService - Handles user subscription status and management
 *
 * Contains only subscription-related methods that are actively used in the codebase.
 * Focuses on subscription status checks and subscription-related queries.
 */
export class UserSubscriptionService extends BaseDatabaseService {
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
   * Find user with subscription data
   * Used for subscription status checks with user details
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
   * Check if user has an active subscription
   * Used for access control and feature gating
   */
  async hasActiveSubscription(userId: string): Promise<boolean> {
    this.validateRequired(userId, 'userId');

    try {
      const user = await this.prisma.user.findFirst({
        where: { id: userId },
        include: {
          subscription: true,
        },
      });

      const subscription = user?.subscription;
      const hasActive =
        subscription?.status === 'ACTIVE' ||
        subscription?.status === 'TRIALING';

      this.logSuccess('active_subscription_check', {
        userId: maskId(userId),
        hasActiveSubscription: hasActive,
        status: subscription?.status || 'NO_SUBSCRIPTION',
      });

      return hasActive;
    } catch (error) {
      this.handleError(error, 'has_active_subscription', {
        userId: maskId(userId),
      });
      return false; // Default to false on error for security
    }
  }
}
