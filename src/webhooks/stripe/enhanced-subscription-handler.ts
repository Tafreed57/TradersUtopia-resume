import Stripe from 'stripe';
import { SubscriptionSyncService } from '@/services/subscription-sync-service';
import { handleSubscriptionCreated } from './customer.subscription.created';
import { handleSubscriptionUpdated } from './customer.subscription.updated';
import { handleSubscriptionDeleted } from './customer.subscription.deleted';
import { handleCheckoutSessionCompleted } from './checkout.session.completed';
import { handleInvoicePaymentSucceeded } from './invoice.payment_succeeded';
import { handleInvoicePaymentFailed } from './invoice.payment_failed';

interface WebhookResult {
  success: boolean;
  error?: string;
}

export async function handleEnhancedWebhookEvent(
  event: Stripe.Event
): Promise<WebhookResult> {
  try {
    switch (event.type) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(
          event.data.object as Stripe.Subscription
        );
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(
          event.data.object as Stripe.Subscription
        );
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription
        );
        break;

      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(
          event.data.object as Stripe.Checkout.Session
        );
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(
          event.data.object as Stripe.Invoice
        );
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      // Other events we acknowledge but don't process
      case 'customer.subscription.paused':
      case 'customer.subscription.resumed':
      case 'customer.subscription.trial_will_end':
      case 'invoice.payment_action_required':
      case 'invoice.upcoming':
      case 'invoice.created':
      case 'invoice.finalized':
      case 'customer.created':
      case 'customer.updated':
      case 'customer.deleted':
        // Acknowledge these events without processing
        break;

      default:
        // Unhandled event type - just acknowledge
        break;
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
