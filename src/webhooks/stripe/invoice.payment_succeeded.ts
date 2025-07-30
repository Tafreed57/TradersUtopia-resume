import Stripe from 'stripe';
import { SubscriptionSyncService } from '../../services/subscription-sync-service';
import { apiLogger } from '@/lib/enhanced-logger';

export async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  try {
    apiLogger.databaseOperation('invoice_payment_succeeded_webhook', true, {
      invoiceId: invoice.id,
      customerId:
        typeof invoice.customer === 'string'
          ? invoice.customer
          : invoice.customer?.id,
    });

    // Sync the subscription data to the database using the refactored service
    // The syncFromStripeObject method will handle data extraction internally
    const syncService = new SubscriptionSyncService();
    await syncService.syncFromStripeObject(invoice);

    // Update user access based on successful payment
    const customerId =
      typeof invoice.customer === 'string'
        ? invoice.customer
        : invoice.customer?.id;

    if (customerId) {
      await syncService.updateUserAccess(customerId);
    }
  } catch (error) {
    apiLogger.databaseOperation('invoice_payment_succeeded_error', false, {
      error: error instanceof Error ? error.message : String(error),
      invoiceId: invoice.id,
    });
    throw error;
  }
}
