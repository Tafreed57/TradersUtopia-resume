import Stripe from 'stripe';
import { BaseStripeService } from '../base/base-stripe-service';
import { SubscriptionLookup } from './subscription-lookup';
import { CreateSubscriptionData, UpdateSubscriptionData } from '../../types';
import { maskId } from '@/lib/error-handling';

/**
 * SubscriptionManagement - Handles subscription create, update, cancel operations
 *
 * Focused sub-service for subscription lifecycle management operations.
 */
export class SubscriptionManagement extends BaseStripeService {
  private lookup: SubscriptionLookup;

  constructor() {
    super();
    this.lookup = new SubscriptionLookup();
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
          ...(data.coupon && { discounts: [{ coupon: data.coupon }] }),
          payment_behavior: data.payment_behavior || 'default_incomplete',
          expand: this.buildExpandParams([
            'latest_invoice',
            'customer',
            'discounts',
            'discounts.coupon',
          ]),
          metadata: data.metadata
            ? this.buildMetadata(data.metadata)
            : undefined,
        }),
      'update_subscription',
      {
        subscriptionId: maskId(subscriptionId),
        cancelAtPeriodEnd: data.cancel_at_period_end,
        itemsUpdated: !!data.items,
        couponApplied: !!data.coupon,
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
      () =>
        this.stripe.subscriptions.cancel(subscriptionId, {
          expand: this.buildExpandParams(['customer']),
        }),
      'cancel_subscription',
      { subscriptionId: maskId(subscriptionId) }
    );
  }

  /**
   * Apply coupon to subscription
   * Used for applying discounts to existing subscriptions
   */
  async applyCouponToSubscription(
    subscriptionId: string,
    couponId: string
  ): Promise<Stripe.Subscription> {
    this.validateSubscriptionId(subscriptionId);

    return await this.handleStripeOperation(
      () =>
        this.stripe.subscriptions.update(subscriptionId, {
          discounts: [{ coupon: couponId }],
          expand: this.buildExpandParams([
            'latest_invoice',
            'customer',
            'discounts',
            'discounts.coupon',
          ]),
        }),
      'apply_coupon_to_subscription',
      {
        subscriptionId: maskId(subscriptionId),
        couponId,
      }
    );
  }

  /**
   * Toggle auto-renewal for subscription (cancel at period end)
   * Used for soft cancellation - subscription continues until period end
   */
  async toggleAutoRenew(
    subscriptionId: string,
    autoRenew: boolean
  ): Promise<Stripe.Subscription> {
    this.validateSubscriptionId(subscriptionId);

    return await this.handleStripeOperation(
      () =>
        this.stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: !autoRenew,
          expand: this.buildExpandParams(['latest_invoice', 'customer']),
        }),
      'toggle_auto_renew',
      {
        subscriptionId: maskId(subscriptionId),
        autoRenew,
        cancelAtPeriodEnd: !autoRenew,
      }
    );
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
        const subscription = await this.lookup.getSubscription(subscriptionId);
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
}
