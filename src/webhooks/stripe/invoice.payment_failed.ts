import Stripe from 'stripe';

export async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  try {
    // For now, we just acknowledge the payment failure
    // Future logic can be added here for failed payment handling
  } catch (error) {
    throw error;
  }
}
