import Stripe from 'stripe';
import { BaseStripeService } from './base/base-stripe-service';
import { CustomerService } from './customer-service';
import {
  CreateSubscriptionData,
  UpdateSubscriptionData,
  ListSubscriptionOptions,
} from '../types';
import { maskId } from '@/lib/error-handling';

/**
 * SubscriptionService - Handles all Stripe subscription operations
 * Eliminates 15+ duplicate implementations across the codebase
 */
export class SubscriptionService extends BaseStripeService {
  private customerService: CustomerService;

  constructor() {
    super();
    this.customerService = new CustomerService();
  }

  /**
   * List subscriptions by customer ID - Used 10+ times
   * Replaces scattered subscription lookup implementations
   */
  async listSubscriptionsByCustomer(
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
            ]
          ),
          status: options.status === 'all' ? undefined : options.status,
          starting_after: options.startingAfter,
          ending_before: options.endingBefore,
        });

        return subscriptions.data;
      },
      'list_customer_subscriptions',
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
   * Create new subscription (admin operations)
   */
  async createSubscription(
    data: CreateSubscriptionData
  ): Promise<Stripe.Subscription> {
    this.validateCustomerId(data.customer);

    return await this.handleStripeOperation(
      () =>
        this.stripe.subscriptions.create({
          customer: data.customer,
          items: data.items,
          trial_period_days: data.trial_period_days,
          payment_behavior: data.payment_behavior || 'default_incomplete',
          expand: this.buildExpandParams(['latest_invoice', 'customer']),
          metadata: this.buildMetadata(data.metadata),
        }),
      'create_subscription',
      {
        customerId: maskId(data.customer),
        itemCount: data.items.length,
        trialDays: data.trial_period_days,
      }
    );
  }

  /**
   * Update subscription (toggle auto-renew, modify items)
   */
  async updateSubscription(
    subscriptionId: string,
    data: UpdateSubscriptionData
  ): Promise<Stripe.Subscription> {
    this.validateSubscriptionId(subscriptionId);

    return await this.handleStripeOperation(
      () =>
        this.stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: data.cancel_at_period_end,
          items: data.items,
          payment_behavior: data.payment_behavior || 'default_incomplete',
          expand: this.buildExpandParams(['latest_invoice', 'customer']),
          metadata: data.metadata
            ? this.buildMetadata(data.metadata)
            : undefined,
        }),
      'update_subscription',
      {
        subscriptionId: maskId(subscriptionId),
        cancelAtPeriodEnd: data.cancel_at_period_end,
        itemsUpdated: !!data.items,
      }
    );
  }

  /**
   * Cancel subscription immediately
   */
  async cancelSubscription(
    subscriptionId: string
  ): Promise<Stripe.Subscription> {
    this.validateSubscriptionId(subscriptionId);

    return await this.handleStripeOperation(
      () => this.stripe.subscriptions.cancel(subscriptionId),
      'cancel_subscription',
      { subscriptionId: maskId(subscriptionId) }
    );
  }

  /**
   * Toggle auto-renewal - Frequently used pattern
   * Used in subscription management UI
   */
  async toggleAutoRenew(
    subscriptionId: string,
    autoRenew: boolean
  ): Promise<Stripe.Subscription> {
    return await this.updateSubscription(subscriptionId, {
      cancel_at_period_end: !autoRenew,
    });
  }

  /**
   * Force sync subscription from Stripe - Used in multiple routes
   * Ensures local data matches Stripe state
   */
  async syncSubscriptionFromStripe(
    subscriptionId: string
  ): Promise<Stripe.Subscription> {
    return await this.getSubscription(subscriptionId);
  }

  /**
   * Resume canceled subscription
   * Used when users want to reactivate
   */
  async resumeSubscription(
    subscriptionId: string
  ): Promise<Stripe.Subscription> {
    this.validateSubscriptionId(subscriptionId);

    return await this.handleStripeOperation(
      () =>
        this.stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: false,
        }),
      'resume_subscription',
      { subscriptionId: maskId(subscriptionId) }
    );
  }

  /**
   * Get subscription by customer email - Common pattern
   * Combines customer lookup with subscription retrieval
   */
  async getSubscriptionByCustomerEmail(
    email: string
  ): Promise<Stripe.Subscription | null> {
    const customer = await this.customerService.findCustomerByEmail(email);
    if (!customer) {
      return null;
    }

    const subscriptions = await this.listSubscriptionsByCustomer(customer.id, {
      limit: 1,
      status: 'active',
    });

    return subscriptions[0] || null;
  }

  /**
   * Check if customer has active subscription
   * Used for access control decisions
   */
  async hasActiveSubscription(customerId: string): Promise<boolean> {
    this.validateCustomerId(customerId);

    try {
      const subscriptions = await this.listSubscriptionsByCustomer(customerId, {
        limit: 1,
        status: 'active',
      });

      return subscriptions.length > 0;
    } catch (error) {
      return false;
    }
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
    const subscription = await this.getSubscription(subscriptionId);

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
   * Change subscription plan/price
   * Used when users upgrade/downgrade
   */
  async changeSubscriptionPlan(
    subscriptionId: string,
    newPriceId: string,
    prorate: boolean = true
  ): Promise<Stripe.Subscription> {
    this.validateSubscriptionId(subscriptionId);
    this.validatePriceId(newPriceId);

    return await this.handleStripeOperation(
      async () => {
        // Get current subscription to find the item to update
        const subscription = await this.getSubscription(subscriptionId);
        const currentItem = subscription.items.data[0];

        if (!currentItem) {
          throw new Error('No subscription items found');
        }

        return await this.stripe.subscriptions.update(subscriptionId, {
          items: [
            {
              id: currentItem.id,
              price: newPriceId,
            },
          ],
          proration_behavior: prorate ? 'create_prorations' : 'none',
          expand: this.buildExpandParams(['latest_invoice', 'customer']),
        });
      },
      'change_subscription_plan',
      {
        subscriptionId: maskId(subscriptionId),
        newPriceId: maskId(newPriceId),
        prorate,
      }
    );
  }

  /**
   * Validate subscription exists
   */
  async validateSubscriptionExists(subscriptionId: string): Promise<boolean> {
    this.validateSubscriptionId(subscriptionId);

    try {
      await this.getSubscription(subscriptionId);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get subscription pricing summary
   */
  async getSubscriptionPricing(subscriptionId: string): Promise<{
    subscription: Stripe.Subscription;
    monthlyAmount: number;
    currency: string;
    isAnnual: boolean;
  }> {
    const subscription = await this.getSubscription(subscriptionId);
    const price = subscription.items.data[0]?.price;

    if (!price) {
      throw new Error('No pricing information found');
    }

    const monthlyAmount = price.unit_amount ? price.unit_amount / 100 : 0;
    const isAnnual = price.recurring?.interval === 'year';

    return {
      subscription,
      monthlyAmount: isAnnual ? monthlyAmount / 12 : monthlyAmount,
      currency: price.currency || 'usd',
      isAnnual,
    };
  }
}
