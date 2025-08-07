import Stripe from 'stripe';
import { BaseStripeService } from '../base/base-stripe-service';
import { ExtractedSubscriptionData } from '../data-extraction-service';
import { ExtractionUtilities } from './extraction-utilities';

/**
 * SubscriptionExtractor - Handles subscription data extraction from Stripe.Subscription objects
 *
 * Focused sub-service for processing subscription objects specifically.
 */
export class SubscriptionExtractor extends BaseStripeService {
  private utilities: ExtractionUtilities;

  constructor() {
    super();
    this.utilities = new ExtractionUtilities();
  }

  /**
   * Extract subscription data from a Stripe.Subscription object
   */
  async extractFromSubscription(
    subscription: Stripe.Subscription
  ): Promise<ExtractedSubscriptionData> {
    this.utilities.validateSubscriptionId(subscription.id);

    const customerId = this.utilities.extractCustomerId(subscription.customer);
    const status = this.utilities.mapStripeStatusToDbStatus(
      subscription.status
    );
    const currentPeriodEnd =
      this.utilities.extractCurrentPeriodEnd(subscription);
    const customerEmail = await this.utilities.getCustomerEmail(
      subscription.customer
    );

    return {
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: customerId,
      status,
      currentPeriodEnd,
      createdAt: new Date(subscription.created * 1000),
      updatedAt: new Date(),
      metadata: {
        customerEmail,
      },
    };
  }
}
