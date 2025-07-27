import Stripe from 'stripe';
import { apiLogger } from '@/lib/enhanced-logger';
import { SubscriptionSyncService } from '@/services/subscription-sync-service';

export const invoicePaymentSucceeded = async (event: any) => {
  const successfulInvoice = event.data.object as Stripe.Invoice;

  apiLogger.subscriptionEvent('invoice_payment_succeeded', {
    invoiceId: successfulInvoice.id,
    customerId: successfulInvoice.customer,
    subscriptionId: (successfulInvoice as any).subscription,
  });

  try {
    // ⚡ OPTIMIZATION: Use invoice data directly and sync with centralized service
    if (successfulInvoice.customer) {
      console.log(
        `⚡ [WEBHOOK-OPTIMIZED] Processing payment success using centralized services`
      );

      // Initialize subscription sync service
      const subscriptionSyncService = new SubscriptionSyncService();

      // Sync subscription from successful invoice payment
      const subscription =
        await subscriptionSyncService.syncSubscriptionFromInvoice(
          successfulInvoice
        );

      if (subscription) {
        // Update user access to ensure they have proper permissions
        await subscriptionSyncService.updateUserAccess(
          successfulInvoice.customer as string
        );

        console.log(
          `✅ [WEBHOOK-OPTIMIZED] Successfully updated subscription after payment`
        );
      }

      console.log(
        `💳 [WEBHOOK-OPTIMIZED] Payment succeeded for invoice: ${successfulInvoice.id}`
      );
      console.log(
        `⚡ [PERFORMANCE] Using centralized services for payment success handling`
      );
    } else {
      console.log(
        `⚠️ [WEBHOOK] Invoice missing customer data, skipping update`
      );
    }
  } catch (error) {
    console.error('Error updating subscription after payment:', error);
    apiLogger.databaseOperation('payment_success_handling', false, {
      invoiceId: successfulInvoice.id,
      customerId: successfulInvoice.customer,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
