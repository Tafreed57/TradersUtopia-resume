import Stripe from 'stripe';
import { BaseStripeService } from './base/base-stripe-service';
import { SubscriptionStatus } from '@prisma/client';
import { apiLogger } from '@/lib/enhanced-logger';
import { BatchExtractor } from './data-extraction/batch-extractor';
import { CheckoutExtractor } from './data-extraction/checkout-extractor';

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
 * StripeDataExtractionService - Main facade for subscription data extraction
 *
 * This facade maintains the exact same public interface as the original StripeDataExtractionService
 * while delegating to focused sub-services for better organization and maintainability.
 *
 * Unified service for extracting subscription-relevant data from various Stripe objects
 * (subscriptions, invoices, checkout sessions)
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
  private batchExtractor: BatchExtractor;
  private checkoutExtractor: CheckoutExtractor;

  constructor() {
    super();
    this.batchExtractor = new BatchExtractor();
    this.checkoutExtractor = new CheckoutExtractor();
  }

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
      return await this.batchExtractor.extractSubscriptionData(stripeObject);
    } catch (error) {
      apiLogger.databaseOperation('stripe_data_extraction', false, {
        error: error instanceof Error ? error.message : String(error),
        objectType: this.getObjectType(stripeObject),
      });
      throw error;
    }
  }

  /**
   * Extract complete subscription data from a checkout session by fetching the actual subscription
   * This provides more accurate data including currentPeriodEnd
   */
  async extractCompleteSubscriptionDataFromCheckoutSession(
    session: StripeCheckoutSessionWithSubscription
  ): Promise<ExtractedSubscriptionData> {
    return this.checkoutExtractor.extractCompleteSubscriptionDataFromCheckoutSession(
      session
    );
  }

  /**
   * Batch extract subscription data from multiple Stripe objects
   */
  async batchExtractSubscriptionData(
    stripeObjects: StripeObjectWithSubscriptionData[]
  ): Promise<ExtractedSubscriptionData[]> {
    return this.batchExtractor.batchExtractSubscriptionData(stripeObjects);
  }

  /**
   * Get object type for logging purposes
   */
  private getObjectType(obj: any): string {
    return obj.object || 'unknown';
  }
}
