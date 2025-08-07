import Stripe from 'stripe';
import { BaseStripeService } from '../base/base-stripe-service';
import { ExtractedSubscriptionData } from '../data-extraction-service';
import { ExtractionUtilities } from './extraction-utilities';
import { SubscriptionExtractor } from './subscription-extractor';
import { ValidationError } from '../../database/errors';
import { SubscriptionStatus } from '@prisma/client';
import { apiLogger } from '@/lib/enhanced-logger';

// Extended type for checkout sessions with subscription information
type StripeCheckoutSessionWithSubscription = Stripe.Checkout.Session & {
  subscription?: string | Stripe.Subscription;
};

/**
 * CheckoutExtractor - Handles subscription data extraction from Stripe.Checkout.Session objects
 *
 * Focused sub-service for processing checkout session objects and extracting subscription data.
 */
export class CheckoutExtractor extends BaseStripeService {
  private utilities: ExtractionUtilities;
  private subscriptionExtractor: SubscriptionExtractor;

  constructor() {
    super();
    this.utilities = new ExtractionUtilities();
    this.subscriptionExtractor = new SubscriptionExtractor();
  }

  /**
   * Extract subscription data from a Stripe.Checkout.Session object
   */
  async extractFromCheckoutSession(
    session: StripeCheckoutSessionWithSubscription
  ): Promise<ExtractedSubscriptionData> {
    if (!session.subscription) {
      throw new ValidationError(
        'Checkout session does not have associated subscription'
      );
    }

    const subscriptionId =
      typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription.id;

    this.utilities.validateSubscriptionId(subscriptionId);

    const customerId = this.utilities.extractCustomerId(session.customer);
    const status = this.inferStatusFromCheckoutSession(session);
    const customerEmail = await this.getCustomerEmailFromSession(session);

    return {
      stripeSubscriptionId: subscriptionId,
      stripeCustomerId: customerId,
      status,
      currentPeriodEnd: null, // Will need to be fetched from actual subscription
      createdAt: new Date(session.created * 1000),
      updatedAt: new Date(),
      metadata: {
        customerEmail,
      },
    };
  }

  /**
   * Extract complete subscription data from a checkout session by fetching the actual subscription
   * This provides more accurate data including currentPeriodEnd
   */
  async extractCompleteSubscriptionDataFromCheckoutSession(
    session: StripeCheckoutSessionWithSubscription
  ): Promise<ExtractedSubscriptionData> {
    if (!session.subscription) {
      throw new ValidationError(
        'Checkout session does not have associated subscription'
      );
    }

    const subscriptionId =
      typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription.id;

    try {
      // Fetch the actual subscription to get complete data
      const subscription = await this.stripe.subscriptions.retrieve(
        subscriptionId
      );

      // Extract data from the subscription object for accuracy
      const subscriptionData =
        await this.subscriptionExtractor.extractFromSubscription(subscription);

      // Use the checkout session email if available, otherwise keep the one from subscription
      const checkoutEmail = await this.getCustomerEmailFromSession(session);

      return {
        ...subscriptionData,
        metadata: {
          customerEmail: checkoutEmail,
        },
      };
    } catch (error) {
      apiLogger.databaseOperation('fetch_subscription_from_checkout', false, {
        error: error instanceof Error ? error.message : String(error),
        subscriptionId,
        checkoutSessionId: session.id,
      });

      // Fallback to basic extraction if subscription fetch fails
      return await this.extractFromCheckoutSession(session);
    }
  }

  /**
   * Get customer email specifically from checkout session
   */
  private async getCustomerEmailFromSession(
    session: StripeCheckoutSessionWithSubscription
  ): Promise<string> {
    // First try to get email directly from session
    const sessionEmail =
      session.customer_details?.email || session.customer_email;
    if (sessionEmail) {
      return sessionEmail;
    }

    // Fallback to fetching from customer object
    return await this.utilities.getCustomerEmail(session.customer);
  }

  /**
   * Infer subscription status from checkout session data
   */
  private inferStatusFromCheckoutSession(
    session: StripeCheckoutSessionWithSubscription
  ): SubscriptionStatus {
    if (session.payment_status === 'paid') {
      return 'ACTIVE';
    } else if (session.payment_status === 'unpaid') {
      return 'INCOMPLETE';
    }

    return 'INCOMPLETE';
  }
}
