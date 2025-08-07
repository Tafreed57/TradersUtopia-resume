import { BaseStripeService } from '../base/base-stripe-service';
import {
  ExtractedSubscriptionData,
  StripeObjectWithSubscriptionData,
} from '../data-extraction-service';
import { SubscriptionExtractor } from './subscription-extractor';
import { InvoiceExtractor } from './invoice-extractor';
import { CheckoutExtractor } from './checkout-extractor';
import { ExtractionUtilities } from './extraction-utilities';
import { apiLogger } from '@/lib/enhanced-logger';

/**
 * BatchExtractor - Handles batch processing and routing of extraction operations
 *
 * Coordinates between different extractors and provides batch processing capabilities.
 */
export class BatchExtractor extends BaseStripeService {
  private subscriptionExtractor: SubscriptionExtractor;
  private invoiceExtractor: InvoiceExtractor;
  private checkoutExtractor: CheckoutExtractor;
  private utilities: ExtractionUtilities;

  constructor() {
    super();
    this.subscriptionExtractor = new SubscriptionExtractor();
    this.invoiceExtractor = new InvoiceExtractor();
    this.checkoutExtractor = new CheckoutExtractor();
    this.utilities = new ExtractionUtilities();
  }

  /**
   * Route extraction to appropriate sub-service based on object type
   */
  async extractSubscriptionData(
    stripeObject: StripeObjectWithSubscriptionData
  ): Promise<ExtractedSubscriptionData> {
    // Determine the object type and route to appropriate extraction method
    if (this.utilities.isSubscriptionObject(stripeObject)) {
      return await this.subscriptionExtractor.extractFromSubscription(
        stripeObject
      );
    } else if (this.utilities.isInvoiceObject(stripeObject)) {
      return await this.invoiceExtractor.extractFromInvoice(stripeObject);
    } else if (this.utilities.isCheckoutSessionObject(stripeObject)) {
      return await this.checkoutExtractor.extractFromCheckoutSession(
        stripeObject
      );
    } else {
      throw new Error(
        'Unsupported Stripe object type for subscription extraction'
      );
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
          objectType: this.utilities.getObjectType(obj),
        });
        // Continue with other objects even if one fails
      }
    }

    return results;
  }
}
