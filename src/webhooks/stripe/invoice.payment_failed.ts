import { db } from '@/lib/db';
import Stripe from 'stripe';

export const invoicePaymentFailed = async (event: any) => {
  console.log('invoicePaymentFailed', event);
  const failedInvoice = event.data.object as Stripe.Invoice;
  console.log(`⚠️ Payment failed for invoice: ${failedInvoice.id}`);

  if (failedInvoice.customer) {
    try {
      await db.profile.updateMany({
        where: { stripeCustomerId: failedInvoice.customer as string },
        data: {
          subscriptionStatus: 'ACTIVE', // Keep active during retry period
          // Note: Don't immediately cancel - Stripe has retry logic
        },
      });

      console.log(
        `⚠️ Marked payment issue for customer: ${failedInvoice.customer}`
      );
      console.log(
        `⚡ [WEBHOOK-OPTIMIZED] Payment failure processed efficiently`
      );
    } catch (error) {
      console.error('Error handling payment failure:', error);
    }
  }
};
