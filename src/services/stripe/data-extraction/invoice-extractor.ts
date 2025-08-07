import Stripe from 'stripe';
import { BaseStripeService } from '../base/base-stripe-service';
import { ExtractedSubscriptionData } from '../data-extraction-service';
import { ExtractionUtilities } from './extraction-utilities';
import { ValidationError } from '../../database/errors';
import { SubscriptionStatus } from '@prisma/client';

// Extended type for invoices that include subscription information (from webhooks)
type StripeInvoiceWithSubscription = Stripe.Invoice & {
  subscription?: string | Stripe.Subscription;
  payment_intent?: string | Stripe.PaymentIntent;
};

/**
 * InvoiceExtractor - Handles subscription data extraction from Stripe.Invoice objects
 *
 * Focused sub-service for processing invoice objects and inferring subscription data.
 */
export class InvoiceExtractor extends BaseStripeService {
  private utilities: ExtractionUtilities;

  constructor() {
    super();
    this.utilities = new ExtractionUtilities();
  }

  /**
   * Extract subscription data from a Stripe.Invoice object
   */
  async extractFromInvoice(
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

    this.utilities.validateSubscriptionId(subscriptionId);

    const customerId = this.utilities.extractCustomerId(invoice.customer);
    const status = this.inferStatusFromInvoice(invoice);
    const currentPeriodEnd = this.extractPeriodFromInvoiceLines(invoice);
    const customerEmail = await this.utilities.getCustomerEmail(
      invoice.customer
    );

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
   * Infer subscription status from invoice data
   */
  private inferStatusFromInvoice(
    invoice: StripeInvoiceWithSubscription
  ): SubscriptionStatus {
    // Logic to infer status based on invoice properties
    if (invoice.status === 'paid') {
      return 'ACTIVE';
    } else if (invoice.status === 'open' && invoice.due_date) {
      const now = Date.now() / 1000;
      return invoice.due_date < now ? 'PAST_DUE' : 'ACTIVE';
    } else if (
      invoice.status === 'void' ||
      invoice.status === 'uncollectible'
    ) {
      return 'CANCELED';
    }

    return 'FREE';
  }

  /**
   * Extract current period end from invoice line items
   */
  private extractPeriodFromInvoiceLines(
    invoice: StripeInvoiceWithSubscription
  ): Date | null {
    if (!invoice.lines?.data?.length) {
      return null;
    }

    // Look for subscription line items with period information
    for (const line of invoice.lines.data) {
      if (line.period?.end) {
        return new Date(line.period.end * 1000);
      }
    }

    // Fallback to invoice period_end if available
    if (invoice.period_end) {
      return new Date(invoice.period_end * 1000);
    }

    return null;
  }
}
