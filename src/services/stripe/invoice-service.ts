import { BaseStripeService } from './base/base-stripe-service';
import Stripe from 'stripe';
import { apiLogger } from '@/lib/enhanced-logger';

interface InvoiceListOptions {
  limit?: number;
  expand?: string[];
  status?: Stripe.Invoice.Status;
  starting_after?: string;
}

interface FormattedInvoice {
  id: string;
  number: string | null;
  status: Stripe.Invoice.Status | null;
  created: string;
  due_date: string | null;
  amount_paid: number;
  amount_due: number;
  total: number;
  currency: string;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  description: string;
  period_start: string | null;
  period_end: string | null;
}

/**
 * InvoiceService
 *
 * Centralized invoice management operations including:
 * - Customer invoice retrieval with formatting
 * - Invoice status checking and updates
 * - Payment tracking and history
 * - PDF and hosted invoice URL access
 * - Subscription period handling
 */
export class InvoiceService extends BaseStripeService {
  /**
   * List invoices for a customer with formatting
   */
  async listCustomerInvoices(
    customerId: string,
    options: InvoiceListOptions = {}
  ): Promise<FormattedInvoice[]> {
    try {
      const {
        limit = 50,
        expand = ['data.subscription'],
        status,
        starting_after,
      } = options;

      const listParams: Stripe.InvoiceListParams = {
        customer: customerId,
        limit,
        expand,
        ...(status && { status }),
        ...(starting_after && { starting_after }),
      };

      const invoices = await this.stripe.invoices.list(listParams);

      apiLogger.databaseOperation('customer_invoices_retrieved', true, {
        customerId: customerId.substring(0, 8) + '***',
        invoiceCount: invoices.data.length,
        totalInvoices: invoices.has_more
          ? 'more_available'
          : invoices.data.length,
      });

      return this.formatInvoices(invoices.data);
    } catch (error) {
      return this.handleServiceError(
        'Failed to list customer invoices',
        'listCustomerInvoices',
        error
      );
    }
  }

  /**
   * Get a specific invoice by ID
   */
  async getInvoice(
    invoiceId: string,
    expand?: string[]
  ): Promise<Stripe.Invoice> {
    try {
      const invoice = await this.stripe.invoices.retrieve(invoiceId, {
        expand: expand || ['subscription', 'payment_intent'],
      });

      apiLogger.databaseOperation('invoice_retrieved', true, {
        invoiceId: invoiceId.substring(0, 8) + '***',
        status: invoice.status,
        amount: invoice.total,
      });

      return invoice;
    } catch (error) {
      return this.handleServiceError(
        'Failed to retrieve invoice',
        'getInvoice',
        error
      );
    }
  }

  /**
   * Get upcoming invoice for a customer
   */
  async getUpcomingInvoice(customerId: string): Promise<Stripe.Invoice | null> {
    return await this.handleStripeOperation(
      async () => {
        try {
          // Use createPreview to get upcoming invoice
          const upcomingInvoice = await this.stripe.invoices.createPreview({
            customer: customerId,
          });

          return upcomingInvoice;
        } catch (error) {
          // Upcoming invoice might not exist, so handle gracefully
          if (
            error instanceof Error &&
            error.message.includes('no upcoming invoice')
          ) {
            return null;
          }
          throw error;
        }
      },
      'get_upcoming_invoice',
      { customerId: customerId.substring(0, 8) + '***' }
    );
  }

  /**
   * Pay an invoice (for manually created invoices)
   */
  async payInvoice(invoiceId: string): Promise<Stripe.Invoice> {
    try {
      const paidInvoice = await this.stripe.invoices.pay(invoiceId);

      apiLogger.databaseOperation('invoice_paid', true, {
        invoiceId: invoiceId.substring(0, 8) + '***',
        amount: paidInvoice.amount_paid,
        status: paidInvoice.status,
      });

      return paidInvoice;
    } catch (error) {
      return this.handleServiceError(
        'Failed to pay invoice',
        'payInvoice',
        error
      );
    }
  }

  /**
   * Mark an invoice as uncollectible
   */
  async markUncollectible(invoiceId: string): Promise<Stripe.Invoice> {
    try {
      const invoice = await this.stripe.invoices.markUncollectible(invoiceId);

      apiLogger.databaseOperation('invoice_marked_uncollectible', true, {
        invoiceId: invoiceId.substring(0, 8) + '***',
        amount: invoice.total,
      });

      return invoice;
    } catch (error) {
      return this.handleServiceError(
        'Failed to mark invoice as uncollectible',
        'markUncollectible',
        error
      );
    }
  }

  /**
   * Get invoice payment status summary
   */
  async getInvoicePaymentSummary(customerId: string): Promise<{
    totalPaid: number;
    totalDue: number;
    totalOverdue: number;
    invoiceCount: number;
    currency: string;
  }> {
    try {
      const invoices = await this.stripe.invoices.list({
        customer: customerId,
        limit: 100,
        status: 'open',
      });

      let totalPaid = 0;
      let totalDue = 0;
      let totalOverdue = 0;
      let currency = 'usd';

      for (const invoice of invoices.data) {
        currency = invoice.currency;
        totalPaid += invoice.amount_paid;
        totalDue += invoice.amount_due;

        // Check if invoice is overdue
        if (
          invoice.due_date &&
          new Date(invoice.due_date * 1000) < new Date()
        ) {
          totalOverdue += invoice.amount_due;
        }
      }

      const summary = {
        totalPaid,
        totalDue,
        totalOverdue,
        invoiceCount: invoices.data.length,
        currency,
      };

      apiLogger.databaseOperation('invoice_payment_summary_generated', true, {
        customerId: customerId.substring(0, 8) + '***',
        ...summary,
      });

      return summary;
    } catch (error) {
      return this.handleServiceError(
        'Failed to get invoice payment summary',
        'getInvoicePaymentSummary',
        error
      );
    }
  }

  /**
   * Format raw Stripe invoices into a consistent format
   */
  private formatInvoices(invoices: Stripe.Invoice[]): FormattedInvoice[] {
    return invoices
      .filter(invoice => invoice.id) // Filter out any invoices without IDs
      .map(invoice => ({
        id: invoice.id!, // Now we know it exists due to the filter
        number: invoice.number,
        status: invoice.status,
        created: new Date(invoice.created * 1000).toISOString(),
        due_date: invoice.due_date
          ? new Date(invoice.due_date * 1000).toISOString()
          : null,
        amount_paid: invoice.amount_paid,
        amount_due: invoice.amount_due,
        total: invoice.total,
        currency: invoice.currency,
        hosted_invoice_url: invoice.hosted_invoice_url || null,
        invoice_pdf: invoice.invoice_pdf || null,
        description:
          invoice.description ||
          `Subscription for ${new Date(invoice.created * 1000).toLocaleDateString()}`,
        period_start: invoice.period_start
          ? new Date(invoice.period_start * 1000).toISOString()
          : null,
        period_end: invoice.period_end
          ? new Date(invoice.period_end * 1000).toISOString()
          : null,
      }));
  }
}
