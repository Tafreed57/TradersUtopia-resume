import Stripe from 'stripe';
import { BaseStripeService } from './base/base-stripe-service';
import { SubscriptionStatus } from '@prisma/client';
import { apiLogger } from '@/lib/enhanced-logger';
import { ValidationError } from '../database/errors';

// Extended type for invoices that include subscription information (from webhooks)
type StripeInvoiceWithSubscription = Stripe.Invoice & {
  subscription?: string | Stripe.Subscription;
  payment_intent?: string | Stripe.PaymentIntent;
};

// Extended type for checkout sessions with subscription information
type StripeCheckoutSessionWithSubscription = Stripe.Checkout.Session & {
  subscription?: string | Stripe.Subscription;
};

/**
 * Interface representing the extracted subscription data that maps to the database Subscription model
 *
 * @note currentPeriodEnd may be null when extracted from checkout sessions or invoices.
 *       Use extractCompleteSubscriptionDataFromCheckoutSession() for guaranteed currentPeriodEnd.
 */
export interface ExtractedSubscriptionData {
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  status: SubscriptionStatus;
  currentPeriodEnd: Date | null; // May be null for checkout sessions and some invoice extractions
  createdAt?: Date;
  updatedAt?: Date;
  metadata?: {
    customerEmail: string;
  };
}

/**
 * Union type for all supported Stripe objects that contain subscription information
 */
export type StripeObjectWithSubscriptionData =
  | Stripe.Subscription
  | StripeInvoiceWithSubscription
  | StripeCheckoutSessionWithSubscription;

/**
 * StripeDataExtractionService - Unified service for extracting subscription-relevant data
 * from various Stripe objects (subscriptions, invoices, checkout sessions)
 *
 * @example
 * ```typescript
 * const extractor = new StripeDataExtractionService();
 *
 * // From subscription object
 * const subData = await extractor.extractSubscriptionData(stripeSubscription);
 *
 * // From invoice object
 * const invoiceData = await extractor.extractSubscriptionData(stripeInvoice);
 *
 * // From checkout session (basic extraction)
 * const sessionData = await extractor.extractSubscriptionData(checkoutSession);
 *
 * // From checkout session (complete extraction with currentPeriodEnd)
 * const completeSessionData = await extractor.extractCompleteSubscriptionDataFromCheckoutSession(checkoutSession);
 * ```
 */
export class StripeDataExtractionService extends BaseStripeService {
  /**
   * Main method to extract subscription data from any supported Stripe object
   *
   * @param stripeObject - Any Stripe object that contains subscription information
   * @returns Promise resolving to extracted subscription data
   * @throws {ValidationError} If the object doesn't contain valid subscription data
   *
   * @note For checkout sessions, this method provides basic extraction without currentPeriodEnd.
   *       Use extractCompleteSubscriptionDataFromCheckoutSession() for complete data including
   *       currentPeriodEnd by fetching the actual subscription object.
   */
  async extractSubscriptionData(
    stripeObject: StripeObjectWithSubscriptionData
  ): Promise<ExtractedSubscriptionData> {
    try {
      // Determine the object type and route to appropriate extraction method
      if (this.isSubscriptionObject(stripeObject)) {
        return await this.extractFromSubscription(stripeObject);
      } else if (this.isInvoiceObject(stripeObject)) {
        return await this.extractFromInvoice(stripeObject);
      } else if (this.isCheckoutSessionObject(stripeObject)) {
        return await this.extractFromCheckoutSession(stripeObject);
      } else {
        throw new ValidationError(
          'Unsupported Stripe object type for subscription extraction'
        );
      }
    } catch (error) {
      apiLogger.databaseOperation('stripe_data_extraction', false, {
        error: error instanceof Error ? error.message : String(error),
        objectType: this.getObjectType(stripeObject),
      });
      throw error;
    }
  }

  /**
   * Extract subscription data from a Stripe.Subscription object
   */
  private async extractFromSubscription(
    subscription: Stripe.Subscription
  ): Promise<ExtractedSubscriptionData> {
    this.validateSubscriptionId(subscription.id);

    const customerId = this.extractCustomerId(subscription.customer);
    const status = this.mapStripeStatusToDbStatus(subscription.status);
    const currentPeriodEnd = this.extractCurrentPeriodEnd(subscription);
    const customerEmail = await this.getCustomerEmail(subscription.customer);

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

  /**
   * Extract subscription data from a Stripe.Invoice object
   */
  private async extractFromInvoice(
    invoice: StripeInvoiceWithSubscription
  ): Promise<ExtractedSubscriptionData> {
    if (!invoice.subscription) {
      throw new ValidationError(
        'Invoice does not have associated subscription'
      );
    }

    const subscriptionId =
      typeof invoice.subscription === 'string'
        ? invoice.subscription
        : invoice.subscription.id;

    this.validateSubscriptionId(subscriptionId);

    const customerId = this.extractCustomerId(invoice.customer);
    const status = this.inferStatusFromInvoice(invoice);
    const currentPeriodEnd = this.extractPeriodFromInvoiceLines(invoice);
    const customerEmail = await this.getCustomerEmail(invoice.customer);

    return {
      stripeSubscriptionId: subscriptionId,
      stripeCustomerId: customerId,
      status,
      currentPeriodEnd,
      createdAt: new Date(invoice.created * 1000),
      updatedAt: new Date(),
      metadata: {
        customerEmail,
      },
    };
  }

  /**
   * Extract subscription data from a Stripe.Checkout.Session object
   */
  private async extractFromCheckoutSession(
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

    this.validateSubscriptionId(subscriptionId);

    const customerId = this.extractCustomerId(session.customer);
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
      const subscription =
        await this.stripe.subscriptions.retrieve(subscriptionId);

      // Extract data from the subscription object for accuracy
      const subscriptionData = await this.extractFromSubscription(subscription);

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
   * Batch extract subscription data from multiple Stripe objects
   */
  async batchExtractSubscriptionData(
    stripeObjects: StripeObjectWithSubscriptionData[]
  ): Promise<ExtractedSubscriptionData[]> {
    const results: ExtractedSubscriptionData[] = [];

    for (const obj of stripeObjects) {
      try {
        const extracted = await this.extractSubscriptionData(obj);
        results.push(extracted);
      } catch (error) {
        apiLogger.databaseOperation('batch_extraction_item_failed', false, {
          error: error instanceof Error ? error.message : String(error),
          objectType: this.getObjectType(obj),
        });
        // Continue with other objects even if one fails
      }
    }

    return results;
  }

  /**
   * Extract customer ID from various customer field types
   */
  private extractCustomerId(
    customer: string | Stripe.Customer | Stripe.DeletedCustomer | null
  ): string {
    if (!customer) {
      throw new ValidationError('Customer information is missing');
    }

    if (typeof customer === 'string') {
      this.validateCustomerId(customer);
      return customer;
    }

    if ('id' in customer) {
      this.validateCustomerId(customer.id);
      return customer.id;
    }

    throw new ValidationError('Invalid customer data structure');
  }

  /**
   * Extract current period end from subscription data
   */
  private extractCurrentPeriodEnd(
    subscription: Stripe.Subscription
  ): Date | null {
    // Primary: Use current_period_end from subscription
    // Note: TypeScript types don't include this field but it exists in the API response
    const subscriptionWithPeriod = subscription as Stripe.Subscription & {
      current_period_end?: number;
    };
    if (subscriptionWithPeriod.current_period_end) {
      return new Date(subscriptionWithPeriod.current_period_end * 1000);
    }

    // Fallback: Extract from subscription items if available
    if (subscription.items?.data?.length > 0) {
      const firstItem = subscription.items.data[0];
      if ('current_period_end' in firstItem && firstItem.current_period_end) {
        return new Date(firstItem.current_period_end * 1000);
      }
    }

    return null;
  }

  /**
   * Extract period information from invoice line items
   */
  private extractPeriodFromInvoiceLines(
    invoice: StripeInvoiceWithSubscription
  ): Date | null {
    if (!invoice.lines?.data?.length) {
      return null;
    }

    // Look for subscription line items with period information
    for (const line of invoice.lines.data) {
      // Check if this is a subscription line item with period information
      // The type field exists on the actual invoice line items from Stripe webhooks
      const lineWithType = line as any;
      if (lineWithType.type === 'subscription' && line.period?.end) {
        return new Date(line.period.end * 1000);
      }
    }

    return null;
  }

  /**
   * Infer subscription status from invoice payment status
   */
  private inferStatusFromInvoice(
    invoice: StripeInvoiceWithSubscription
  ): SubscriptionStatus {
    switch (invoice.status) {
      case 'paid':
        return SubscriptionStatus.ACTIVE;
      case 'open':
        return SubscriptionStatus.PAST_DUE;
      case 'void':
      case 'uncollectible':
        return SubscriptionStatus.CANCELED;
      case 'draft':
        return SubscriptionStatus.INCOMPLETE;
      default:
        // Check attempt count for unpaid invoices
        if (invoice.attempt_count && invoice.attempt_count >= 3) {
          return SubscriptionStatus.UNPAID;
        }
        return SubscriptionStatus.PAST_DUE;
    }
  }

  /**
   * Infer subscription status from checkout session
   */
  private inferStatusFromCheckoutSession(
    session: Stripe.Checkout.Session
  ): SubscriptionStatus {
    // First check the overall session status
    if (session.status === 'expired') {
      return SubscriptionStatus.INCOMPLETE_EXPIRED;
    }

    if (session.status === 'open') {
      // Session is still open, check payment status
      switch (session.payment_status) {
        case 'paid':
          return SubscriptionStatus.ACTIVE;
        case 'unpaid':
          return SubscriptionStatus.INCOMPLETE;
        case 'no_payment_required':
          return SubscriptionStatus.TRIALING;
        default:
          return SubscriptionStatus.INCOMPLETE;
      }
    }

    if (session.status === 'complete') {
      // Session completed successfully
      switch (session.payment_status) {
        case 'paid':
          return SubscriptionStatus.ACTIVE;
        case 'no_payment_required':
          return SubscriptionStatus.TRIALING; // Likely a trial or free subscription
        case 'unpaid':
          // Edge case: complete but unpaid might indicate trial or delayed payment
          return SubscriptionStatus.TRIALING;
        default:
          return SubscriptionStatus.ACTIVE; // Default for completed sessions
      }
    }

    // Fallback to payment status only
    switch (session.payment_status) {
      case 'paid':
        return SubscriptionStatus.ACTIVE;
      case 'unpaid':
        return SubscriptionStatus.INCOMPLETE;
      case 'no_payment_required':
        return SubscriptionStatus.TRIALING;
      default:
        return SubscriptionStatus.INCOMPLETE;
    }
  }

  /**
   * Map Stripe subscription status to database SubscriptionStatus enum
   * Reuses the logic from SubscriptionSyncService
   */
  private mapStripeStatusToDbStatus(stripeStatus: string): SubscriptionStatus {
    const statusMap: Record<string, SubscriptionStatus> = {
      incomplete: SubscriptionStatus.INCOMPLETE,
      incomplete_expired: SubscriptionStatus.INCOMPLETE_EXPIRED,
      trialing: SubscriptionStatus.TRIALING,
      active: SubscriptionStatus.ACTIVE,
      past_due: SubscriptionStatus.PAST_DUE,
      canceled: SubscriptionStatus.CANCELED,
      unpaid: SubscriptionStatus.UNPAID,
      paused: SubscriptionStatus.PAUSED,
    };

    return statusMap[stripeStatus] || SubscriptionStatus.FREE;
  }

  /**
   * Type guards for determining Stripe object types
   */
  private isSubscriptionObject(obj: any): obj is Stripe.Subscription {
    return obj.object === 'subscription';
  }

  private isInvoiceObject(obj: any): obj is Stripe.Invoice {
    return obj.object === 'invoice';
  }

  private isCheckoutSessionObject(obj: any): obj is Stripe.Checkout.Session {
    return obj.object === 'checkout.session';
  }

  /**
   * Get object type for logging purposes
   */
  private getObjectType(obj: any): string {
    return obj.object || 'unknown';
  }

  /**
   * Get customer email from various customer field types
   */
  private async getCustomerEmail(
    customer: string | Stripe.Customer | Stripe.DeletedCustomer | null
  ): Promise<string> {
    if (!customer) {
      throw new ValidationError('Customer information is missing');
    }

    // If customer is already an object with email
    if (typeof customer === 'object' && 'email' in customer && customer.email) {
      return customer.email;
    }

    // If customer is a string (ID), fetch the full customer object
    if (typeof customer === 'string') {
      try {
        const customerObject = await this.stripe.customers.retrieve(customer);
        if ('email' in customerObject && customerObject.email) {
          return customerObject.email;
        }
        throw new ValidationError('Customer email not found');
      } catch (error) {
        apiLogger.databaseOperation('fetch_customer_email', false, {
          error: error instanceof Error ? error.message : String(error),
          customerId: customer,
        });
        throw new ValidationError('Failed to fetch customer email');
      }
    }

    // If customer is an object with ID but no email, fetch from Stripe
    if (typeof customer === 'object' && 'id' in customer) {
      try {
        const customerObject = await this.stripe.customers.retrieve(
          customer.id
        );
        if ('email' in customerObject && customerObject.email) {
          return customerObject.email;
        }
        throw new ValidationError('Customer email not found');
      } catch (error) {
        apiLogger.databaseOperation('fetch_customer_email', false, {
          error: error instanceof Error ? error.message : String(error),
          customerId: customer.id,
        });
        throw new ValidationError('Failed to fetch customer email');
      }
    }

    throw new ValidationError('Invalid customer data structure');
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
    return await this.getCustomerEmail(session.customer);
  }
}
