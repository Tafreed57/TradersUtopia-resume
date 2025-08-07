import Stripe from 'stripe';
import { BaseStripeService } from '../base/base-stripe-service';
import { SubscriptionLookup } from './subscription-lookup';
import { UserService } from '../../database/user-service';
import { maskId } from '@/lib/error-handling';

/**
 * SubscriptionStatus - Handles subscription status checks and validation
 *
 * Focused sub-service for subscription status verification and information retrieval.
 */
export class SubscriptionStatus extends BaseStripeService {
  private lookup: SubscriptionLookup;
  private userService: UserService;

  constructor() {
    super();
    this.lookup = new SubscriptionLookup();
    this.userService = new UserService();
  }

  /**
   * Check if user has active subscription - Database first approach
   * Used for access control decisions
   */
  async hasActiveSubscription(userIdOrCustomerId: string): Promise<boolean> {
    const isUserId = userIdOrCustomerId.startsWith('user_');

    if (isUserId) {
      // Use database service for user ID checks
      return await this.userService.hasActiveSubscription(userIdOrCustomerId);
    } else {
      // Legacy: customer ID - check Stripe directly
      this.validateCustomerId(userIdOrCustomerId);

      try {
        const subscriptions =
          await this.lookup.getStripeSubscriptionsByCustomerId(
            userIdOrCustomerId,
            {
              limit: 1,
              status: 'active',
            }
          );

        return subscriptions.length > 0;
      } catch (error) {
        return false;
      }
    }
  }

  /**
   * Get user subscription status from database
   * Fast database-only check for subscription status
   */
  async getUserSubscriptionStatusFromDB(userId: string): Promise<{
    status: string;
    hasActiveSubscription: boolean;
    currentPeriodEnd?: Date;
    stripeSubscriptionId?: string;
  }> {
    return await this.userService.getUserSubscriptionStatus(userId);
  }

  /**
   * Get subscription status summary
   * Used in dashboard and admin views
   */
  async getSubscriptionStatus(subscriptionId: string): Promise<{
    subscription: Stripe.Subscription;
    isActive: boolean;
    isTrialing: boolean;
    isCanceled: boolean;
    nextBillingDate?: Date;
    trialEndDate?: Date;
    cancelDate?: Date;
  }> {
    const subscription = await this.lookup.getSubscription(subscriptionId);

    const isActive = subscription.status === 'active';
    const isTrialing = subscription.status === 'trialing';
    const isCanceled =
      subscription.status === 'canceled' || !!subscription.canceled_at;

    // Note: Billing date calculation needs Stripe type checking
    const nextBillingDate = undefined; // TODO: Fix with proper Stripe property access;

    const trialEndDate = subscription.trial_end
      ? new Date(subscription.trial_end * 1000)
      : undefined;

    const cancelDate = subscription.canceled_at
      ? new Date(subscription.canceled_at * 1000)
      : undefined;

    return {
      subscription,
      isActive,
      isTrialing,
      isCanceled,
      nextBillingDate,
      trialEndDate,
      cancelDate,
    };
  }

  /**
   * Validate subscription exists
   */
  async validateSubscriptionExists(subscriptionId: string): Promise<boolean> {
    this.validateSubscriptionId(subscriptionId);

    try {
      await this.lookup.getSubscription(subscriptionId);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get subscription pricing information
   * Used to display current costs, next billing amount
   */
  async getSubscriptionPricing(subscriptionId: string): Promise<{
    currentAmount: number;
    currency: string;
    interval: string;
    nextBillingAmount?: number;
    priceId: string;
  }> {
    const subscription = await this.lookup.getSubscription(subscriptionId);

    const item = subscription.items.data[0];
    if (!item?.price) {
      throw new Error('Subscription has no pricing information');
    }

    const price = item.price;

    return {
      currentAmount: price.unit_amount || 0,
      currency: price.currency,
      interval: price.recurring?.interval || 'month',
      priceId: price.id,
      // nextBillingAmount would need upcoming invoice calculation
    };
  }
}
