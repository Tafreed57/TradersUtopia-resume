import Stripe from 'stripe';
import { BaseStripeService } from '../base/base-stripe-service';
import { CustomerService } from '../customer-service';
import { UserService } from '../../database/user-service';
import { ListSubscriptionOptions } from '../../types';
import { maskId } from '@/lib/error-handling';

/**
 * SubscriptionLookup - Handles finding and listing subscription operations
 *
 * Focused sub-service for subscription discovery and retrieval operations.
 */
export class SubscriptionLookup extends BaseStripeService {
  private customerService: CustomerService;
  private userService: UserService;

  constructor() {
    super();
    this.customerService = new CustomerService();
    this.userService = new UserService();
  }

  /**
   * List subscriptions by user ID - checks database first
   * Replaces scattered subscription lookup implementations
   * Use this for access control and status checks
   */
  async listSubscriptionsByCustomer(
    userIdOrCustomerId: string,
    options: ListSubscriptionOptions = {}
  ): Promise<Stripe.Subscription[]> {
    // Check if this is a userId (starts with 'user_') or customerId (starts with 'cus_')
    const isUserId = userIdOrCustomerId.startsWith('user_');

    if (isUserId) {
      // Check database first for user subscription
      const userWithSubscription =
        await this.userService.findUserWithSubscriptionData(userIdOrCustomerId);

      if (!userWithSubscription?.subscription) {
        // No subscription in database
        return [];
      }

      // If options require fresh Stripe data or specific filtering, fetch from Stripe
      if (options.expand || options.startingAfter || options.endingBefore) {
        return await this.getStripeSubscriptionsByCustomerId(
          userWithSubscription.subscription.stripeCustomerId,
          options
        );
      }

      // Return database subscription as Stripe format (for backward compatibility)
      // Note: This is a simplified response based on database data
      return await this.getStripeSubscriptionsByCustomerId(
        userWithSubscription.subscription.stripeCustomerId,
        { ...options, limit: 1 }
      );
    } else {
      // Legacy: Direct customer ID passed - use Stripe directly
      return await this.getStripeSubscriptionsByCustomerId(
        userIdOrCustomerId,
        options
      );
    }
  }

  /**
   * Get subscriptions directly from Stripe by customer ID
   * Use only when you need fresh Stripe data or specific Stripe operations
   */
  async getStripeSubscriptionsByCustomerId(
    customerId: string,
    options: ListSubscriptionOptions = {}
  ): Promise<Stripe.Subscription[]> {
    this.validateCustomerId(customerId);

    return await this.handleStripeOperation(
      async () => {
        const subscriptions = await this.stripe.subscriptions.list({
          customer: customerId,
          limit: options.limit || 10,
          expand: this.buildExpandParams(
            options.expand || [
              'data.latest_invoice',
              'data.items.data.price',
              'data.customer',
              'data.discounts',
              'data.discounts.coupon',
            ]
          ),
          status: options.status === 'all' ? undefined : options.status,
          starting_after: options.startingAfter,
          ending_before: options.endingBefore,
        });
        return subscriptions.data;
      },
      'list_stripe_customer_subscriptions',
      {
        customerId: maskId(customerId),
        options: {
          limit: options.limit,
          status: options.status,
        },
      }
    );
  }

  /**
   * Retrieve single subscription with full details
   */
  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    this.validateSubscriptionId(subscriptionId);

    return await this.handleStripeOperation(
      () =>
        this.stripe.subscriptions.retrieve(subscriptionId, {
          expand: this.buildExpandParams([
            'latest_invoice',
            'items.data.price',
            'customer',
          ]),
        }),
      'retrieve_subscription',
      { subscriptionId: maskId(subscriptionId) }
    );
  }

  /**
   * Get subscription by customer email
   * Used to find user's subscription when only email is known
   */
  async getSubscriptionByCustomerEmail(
    email: string
  ): Promise<Stripe.Subscription | null> {
    // First find the customer by email
    const customer = await this.customerService.findCustomerByEmail(email);

    if (!customer) {
      return null;
    }

    // Then get their active subscription
    return this.getActiveSubscription(customer.id);
  }

  /**
   * Get active subscription for customer - Convenience method
   * Used for quick checks when you know customer should have one active subscription
   */
  async getActiveSubscription(
    customerId: string
  ): Promise<Stripe.Subscription | null> {
    const subscriptions = await this.getStripeSubscriptionsByCustomerId(
      customerId,
      {
        limit: 1,
        status: 'active',
      }
    );

    return subscriptions[0] || null;
  }
}
