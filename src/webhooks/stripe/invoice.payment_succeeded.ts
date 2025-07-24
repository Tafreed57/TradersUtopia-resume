import { db } from '@/lib/db';
import Stripe from 'stripe';

export const invoicePaymentSucceeded = async (event: any) => {
  console.log('invoicePaymentSucceeded', event);
  const successfulInvoice = event.data.object as Stripe.Invoice;
  console.log(`💳 Payment succeeded for invoice: ${successfulInvoice.id}`);

  try {
    // ⚡ OPTIMIZATION: Use invoice data directly instead of API call
    if (successfulInvoice.customer) {
      console.log(
        `⚡ [WEBHOOK-OPTIMIZED] Processing payment success using invoice data only`
      );

      // Update subscription status using invoice data - no API call needed
      const updateResult = await db.profile.updateMany({
        where: {
          stripeCustomerId: successfulInvoice.customer as string,
          stripeSubscriptionId: successfulInvoice.id,
        },
        data: {
          subscriptionStatus: 'ACTIVE',

          updatedAt: new Date(),
        },
      });

      console.log(
        `✅ [WEBHOOK-OPTIMIZED] Updated ${updateResult.count} profile(s) after successful payment`
      );
      console.log(
        `⚡ [WEBHOOK-OPTIMIZED] Payment success processed with zero API calls`
      );
    } else {
      console.log(
        `⚠️ [WEBHOOK] Invoice missing subscription or customer data, skipping update`
      );
    }
  } catch (error) {
    console.error('Error updating subscription after payment:', error);
  }
};
