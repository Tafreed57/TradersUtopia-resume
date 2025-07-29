import Stripe from 'stripe';

export async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  try {
    // For now, we just acknowledge the payment success
    // Future logic can be added here for payment processing
  } catch (error) {
    throw error;
  }
}
