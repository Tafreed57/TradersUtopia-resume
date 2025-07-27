import Stripe from 'stripe';
import { apiLogger } from '@/lib/enhanced-logger';
import { SubscriptionSyncService } from '@/services/subscription-sync-service';

export const invoicePaymentFailed = async (event: any) => {
  const failedInvoice = event.data.object as Stripe.Invoice;

  apiLogger.subscriptionEvent('invoice_payment_failed', {
    invoiceId: failedInvoice.id,
    customerId: failedInvoice.customer,
    attemptCount: failedInvoice.attempt_count,
  });

  if (failedInvoice.customer) {
    try {
      // Initialize subscription sync service
      const subscriptionSyncService = new SubscriptionSyncService();

      // Handle payment failure using centralized service
      await subscriptionSyncService.handlePaymentFailure(failedInvoice);

      console.log(
        `⚠️ [WEBHOOK-OPTIMIZED] Payment failed for invoice: ${failedInvoice.id}`
      );
      console.log(
        `🔄 Attempt count: ${failedInvoice.attempt_count || 1}/3 - Status updated accordingly`
      );
      console.log(
        `⚡ [PERFORMANCE] Using centralized services for payment failure handling`
      );
    } catch (error) {
      console.error('Error handling payment failure:', error);
      apiLogger.databaseOperation('payment_failure_handling', false, {
        invoiceId: failedInvoice.id,
        customerId: failedInvoice.customer,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  } else {
    console.log(
      '⚠️ No customer ID found in failed invoice, skipping processing'
    );
  }
};
