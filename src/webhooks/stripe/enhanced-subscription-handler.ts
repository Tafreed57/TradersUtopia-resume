import Stripe from 'stripe';
import { apiLogger } from '@/lib/enhanced-logger';
import { SubscriptionSyncService } from '@/services/subscription-sync-service';
import { StripeClientService } from '@/services';
import { createNotification } from '@/lib/notifications';

/**
 * Comprehensive handler for all Stripe webhook events related to subscriptions,
 * payments, and customer management.
 */
export class StripeSubscriptionHandler {
  private syncService: SubscriptionSyncService;
  private stripe: Stripe;

  constructor() {
    this.syncService = new SubscriptionSyncService();
    this.stripe = StripeClientService.getClient();
  }

  // ========== SUBSCRIPTION LIFECYCLE EVENTS ==========

  /**
   * Handle customer.subscription.created event
   */
  async handleCustomerSubscriptionCreated(event: Stripe.Event): Promise<void> {
    const subscription = event.data.object as Stripe.Subscription;

    apiLogger.webhookEvent('stripe', 'subscription.created', {
      subscriptionId: subscription.id,
      customerId: subscription.customer,
      status: subscription.status,
      eventId: event.id,
    });

    try {
      await this.syncService.createOrUpdateSubscription(subscription);
      await this.syncService.updateUserAccess(subscription.customer as string);

      // Send welcome notification
      await this.sendWelcomeNotification(subscription.customer as string);

      apiLogger.webhookEvent('stripe', 'subscription.created.success', {
        subscriptionId: subscription.id,
        eventId: event.id,
      });
    } catch (error) {
      this.handleWebhookError(
        error,
        'subscription.created',
        subscription.id,
        event.id
      );
    }
  }

  /**
   * Handle customer.subscription.updated event
   */
  async handleCustomerSubscriptionUpdated(event: Stripe.Event): Promise<void> {
    const subscription = event.data.object as Stripe.Subscription;
    const previousAttributes = event.data.previous_attributes;

    apiLogger.webhookEvent('stripe', 'subscription.updated', {
      subscriptionId: subscription.id,
      customerId: subscription.customer,
      status: subscription.status,
      changes: Object.keys(previousAttributes || {}),
      eventId: event.id,
    });

    try {
      await this.syncService.createOrUpdateSubscription(subscription);

      // Check if status changed to update access
      if (previousAttributes?.status) {
        await this.syncService.updateUserAccess(
          subscription.customer as string
        );

        // Send status change notification
        await this.sendSubscriptionStatusChangeNotification(
          subscription.customer as string,
          previousAttributes.status,
          subscription.status
        );
      }

      apiLogger.webhookEvent('stripe', 'subscription.updated.success', {
        subscriptionId: subscription.id,
        eventId: event.id,
      });
    } catch (error) {
      this.handleWebhookError(
        error,
        'subscription.updated',
        subscription.id,
        event.id
      );
    }
  }

  /**
   * Handle customer.subscription.deleted event
   */
  async handleCustomerSubscriptionDeleted(event: Stripe.Event): Promise<void> {
    const subscription = event.data.object as Stripe.Subscription;

    apiLogger.webhookEvent('stripe', 'subscription.deleted', {
      subscriptionId: subscription.id,
      customerId: subscription.customer,
      eventId: event.id,
    });

    try {
      await this.syncService.handleSubscriptionCancellation(subscription);
      await this.syncService.revokeUserAccess(subscription.customer as string);

      // Send cancellation notification
      await this.sendSubscriptionCancelledNotification(
        subscription.customer as string
      );

      apiLogger.webhookEvent('stripe', 'subscription.deleted.success', {
        subscriptionId: subscription.id,
        eventId: event.id,
      });
    } catch (error) {
      this.handleWebhookError(
        error,
        'subscription.deleted',
        subscription.id,
        event.id
      );
    }
  }

  /**
   * Handle customer.subscription.paused event
   */
  async handleCustomerSubscriptionPaused(event: Stripe.Event): Promise<void> {
    const subscription = event.data.object as Stripe.Subscription;

    apiLogger.webhookEvent('stripe', 'subscription.paused', {
      subscriptionId: subscription.id,
      customerId: subscription.customer,
      eventId: event.id,
    });

    try {
      await this.syncService.createOrUpdateSubscription(subscription);
      await this.syncService.revokeUserAccess(subscription.customer as string);

      // Send paused notification
      await this.sendSubscriptionPausedNotification(
        subscription.customer as string
      );

      apiLogger.webhookEvent('stripe', 'subscription.paused.success', {
        subscriptionId: subscription.id,
        eventId: event.id,
      });
    } catch (error) {
      this.handleWebhookError(
        error,
        'subscription.paused',
        subscription.id,
        event.id
      );
    }
  }

  /**
   * Handle customer.subscription.resumed event
   */
  async handleCustomerSubscriptionResumed(event: Stripe.Event): Promise<void> {
    const subscription = event.data.object as Stripe.Subscription;

    apiLogger.webhookEvent('stripe', 'subscription.resumed', {
      subscriptionId: subscription.id,
      customerId: subscription.customer,
      eventId: event.id,
    });

    try {
      await this.syncService.createOrUpdateSubscription(subscription);
      await this.syncService.grantUserAccess(subscription.customer as string);

      // Send resumed notification
      await this.sendSubscriptionResumedNotification(
        subscription.customer as string
      );

      apiLogger.webhookEvent('stripe', 'subscription.resumed.success', {
        subscriptionId: subscription.id,
        eventId: event.id,
      });
    } catch (error) {
      this.handleWebhookError(
        error,
        'subscription.resumed',
        subscription.id,
        event.id
      );
    }
  }

  /**
   * Handle customer.subscription.trial_will_end event
   */
  async handleTrialWillEnd(event: Stripe.Event): Promise<void> {
    const subscription = event.data.object as Stripe.Subscription;

    apiLogger.webhookEvent('stripe', 'trial_will_end', {
      subscriptionId: subscription.id,
      customerId: subscription.customer,
      trialEnd: subscription.trial_end,
      eventId: event.id,
    });

    try {
      // Send trial ending notification
      await this.sendTrialEndingNotification(
        subscription.customer as string,
        subscription.trial_end || 0
      );

      apiLogger.webhookEvent('stripe', 'trial_will_end.success', {
        subscriptionId: subscription.id,
        eventId: event.id,
      });
    } catch (error) {
      this.handleWebhookError(
        error,
        'trial_will_end',
        subscription.id,
        event.id
      );
    }
  }

  // ========== PAYMENT AND INVOICE EVENTS ==========

  /**
   * Handle invoice.payment_succeeded event
   */
  async handleInvoicePaymentSucceeded(event: Stripe.Event): Promise<void> {
    const invoice = event.data.object as any; // Using any due to TypeScript issues

    if (!invoice.subscription) return; // Only handle subscription invoices

    const subscriptionId =
      typeof invoice.subscription === 'string'
        ? invoice.subscription
        : invoice.subscription.id;

    apiLogger.webhookEvent('stripe', 'invoice.payment_succeeded', {
      invoiceId: invoice.id,
      subscriptionId,
      amount: invoice.amount_paid,
      eventId: event.id,
    });

    try {
      // Payment succeeded - ensure access is granted
      await this.syncService.syncSubscriptionFromInvoice(invoice);
      await this.syncService.grantUserAccess(invoice.customer as string);

      // Send payment success notification
      await this.sendPaymentSuccessNotification(
        invoice.customer as string,
        invoice.amount_paid,
        invoice.currency
      );

      apiLogger.webhookEvent('stripe', 'invoice.payment_succeeded.success', {
        invoiceId: invoice.id,
        subscriptionId,
        eventId: event.id,
      });
    } catch (error) {
      this.handleWebhookError(
        error,
        'invoice.payment_succeeded',
        invoice.id,
        event.id
      );
    }
  }

  /**
   * Handle invoice.payment_failed event
   */
  async handleInvoicePaymentFailed(event: Stripe.Event): Promise<void> {
    const invoice = event.data.object as any; // Using any due to TypeScript issues

    if (!invoice.subscription) return;

    const subscriptionId =
      typeof invoice.subscription === 'string'
        ? invoice.subscription
        : invoice.subscription.id;

    apiLogger.webhookEvent('stripe', 'invoice.payment_failed', {
      invoiceId: invoice.id,
      subscriptionId,
      attemptCount: invoice.attempt_count,
      eventId: event.id,
    });

    try {
      // Update subscription status and potentially revoke access
      await this.syncService.handlePaymentFailure(invoice);

      // Check subscription status to determine if access should be revoked
      const subscription =
        await this.syncService.getSubscriptionById(subscriptionId);
      if (
        subscription?.status === 'PAST_DUE' ||
        subscription?.status === 'UNPAID'
      ) {
        await this.syncService.revokeUserAccess(invoice.customer as string);
      }

      // Send payment failure notification
      await this.sendPaymentFailureNotification(
        invoice.customer as string,
        invoice.attempt_count || 1,
        invoice.next_payment_attempt
      );

      apiLogger.webhookEvent('stripe', 'invoice.payment_failed.success', {
        invoiceId: invoice.id,
        subscriptionId,
        eventId: event.id,
      });
    } catch (error) {
      this.handleWebhookError(
        error,
        'invoice.payment_failed',
        invoice.id,
        event.id
      );
    }
  }

  /**
   * Handle invoice.payment_action_required event
   */
  async handleInvoicePaymentActionRequired(event: Stripe.Event): Promise<void> {
    const invoice = event.data.object as any;

    if (!invoice.subscription) return;

    const subscriptionId =
      typeof invoice.subscription === 'string'
        ? invoice.subscription
        : invoice.subscription.id;

    apiLogger.webhookEvent('stripe', 'invoice.payment_action_required', {
      invoiceId: invoice.id,
      subscriptionId,
      eventId: event.id,
    });

    try {
      // Send payment action required notification
      await this.sendPaymentActionRequiredNotification(
        invoice.customer as string,
        invoice.hosted_invoice_url
      );

      apiLogger.webhookEvent(
        'stripe',
        'invoice.payment_action_required.success',
        {
          invoiceId: invoice.id,
          eventId: event.id,
        }
      );
    } catch (error) {
      this.handleWebhookError(
        error,
        'invoice.payment_action_required',
        invoice.id,
        event.id
      );
    }
  }

  /**
   * Handle invoice.upcoming event
   */
  async handleInvoiceUpcoming(event: Stripe.Event): Promise<void> {
    const invoice = event.data.object as any;

    if (!invoice.subscription) return;

    apiLogger.webhookEvent('stripe', 'invoice.upcoming', {
      invoiceId: invoice.id,
      subscriptionId: invoice.subscription,
      amount: invoice.amount_due,
      eventId: event.id,
    });

    try {
      // Send upcoming invoice notification
      await this.sendUpcomingInvoiceNotification(
        invoice.customer as string,
        invoice.amount_due,
        invoice.currency,
        invoice.period_end
      );

      apiLogger.webhookEvent('stripe', 'invoice.upcoming.success', {
        invoiceId: invoice.id,
        eventId: event.id,
      });
    } catch (error) {
      this.handleWebhookError(error, 'invoice.upcoming', invoice.id, event.id);
    }
  }

  /**
   * Handle invoice.created event
   */
  async handleInvoiceCreated(event: Stripe.Event): Promise<void> {
    const invoice = event.data.object as any;

    apiLogger.webhookEvent('stripe', 'invoice.created', {
      invoiceId: invoice.id,
      subscriptionId: invoice.subscription,
      amount: invoice.amount_due,
      eventId: event.id,
    });

    // Just log for now - no specific action needed for invoice creation
    apiLogger.webhookEvent('stripe', 'invoice.created.success', {
      invoiceId: invoice.id,
      eventId: event.id,
    });
  }

  /**
   * Handle invoice.finalized event
   */
  async handleInvoiceFinalized(event: Stripe.Event): Promise<void> {
    const invoice = event.data.object as any;

    apiLogger.webhookEvent('stripe', 'invoice.finalized', {
      invoiceId: invoice.id,
      subscriptionId: invoice.subscription,
      amount: invoice.amount_due,
      eventId: event.id,
    });

    // Just log for now - no specific action needed for invoice finalization
    apiLogger.webhookEvent('stripe', 'invoice.finalized.success', {
      invoiceId: invoice.id,
      eventId: event.id,
    });
  }

  // ========== CUSTOMER EVENTS ==========

  /**
   * Handle customer.created event
   */
  async handleCustomerCreated(event: Stripe.Event): Promise<void> {
    const customer = event.data.object as Stripe.Customer;

    apiLogger.webhookEvent('stripe', 'customer.created', {
      customerId: customer.id,
      email: customer.email,
      eventId: event.id,
    });

    // Just log for now - customer creation doesn't require specific action
    apiLogger.webhookEvent('stripe', 'customer.created.success', {
      customerId: customer.id,
      eventId: event.id,
    });
  }

  /**
   * Handle customer.updated event
   */
  async handleCustomerUpdated(event: Stripe.Event): Promise<void> {
    const customer = event.data.object as Stripe.Customer;
    const previousAttributes = event.data.previous_attributes;

    apiLogger.webhookEvent('stripe', 'customer.updated', {
      customerId: customer.id,
      email: customer.email,
      changes: Object.keys(previousAttributes || {}),
      eventId: event.id,
    });

    // Just log for now - customer updates don't require specific action
    apiLogger.webhookEvent('stripe', 'customer.updated.success', {
      customerId: customer.id,
      eventId: event.id,
    });
  }

  /**
   * Handle customer.deleted event
   */
  async handleCustomerDeleted(event: Stripe.Event): Promise<void> {
    const customer = event.data.object as Stripe.Customer;

    apiLogger.webhookEvent('stripe', 'customer.deleted', {
      customerId: customer.id,
      eventId: event.id,
    });

    try {
      // Revoke access when customer is deleted
      await this.syncService.revokeUserAccess(customer.id);

      apiLogger.webhookEvent('stripe', 'customer.deleted.success', {
        customerId: customer.id,
        eventId: event.id,
      });
    } catch (error) {
      this.handleWebhookError(error, 'customer.deleted', customer.id, event.id);
    }
  }

  /**
   * Handle checkout.session.completed event
   */
  async handleCheckoutSessionCompleted(event: Stripe.Event): Promise<void> {
    const session = event.data.object as Stripe.Checkout.Session;

    apiLogger.webhookEvent('stripe', 'checkout.session.completed', {
      sessionId: session.id,
      customerId: session.customer,
      subscriptionId: session.subscription,
      eventId: event.id,
    });

    try {
      if (session.subscription) {
        // Fetch the full subscription from Stripe
        const subscription = await this.stripe.subscriptions.retrieve(
          session.subscription as string
        );

        await this.syncService.createOrUpdateSubscription(subscription);
        await this.syncService.grantUserAccess(session.customer as string);

        // Send welcome notification
        await this.sendWelcomeNotification(session.customer as string);
      }

      apiLogger.webhookEvent('stripe', 'checkout.session.completed.success', {
        sessionId: session.id,
        eventId: event.id,
      });
    } catch (error) {
      this.handleWebhookError(
        error,
        'checkout.session.completed',
        session.id,
        event.id
      );
    }
  }

  // ========== NOTIFICATION HELPERS ==========

  private async sendWelcomeNotification(customerId: string): Promise<void> {
    try {
      await createNotification({
        type: 'SUBSCRIPTION_WELCOME',
        title: 'Welcome to Premium!',
        message:
          'Your premium subscription is now active. Enjoy exclusive access!',
        metadata: { customerId },
      });
    } catch (error) {
      apiLogger.webhookEvent('stripe', 'notification_failed', {
        type: 'welcome',
        customerId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async sendSubscriptionStatusChangeNotification(
    customerId: string,
    oldStatus: string,
    newStatus: string
  ): Promise<void> {
    try {
      await createNotification({
        type: 'SUBSCRIPTION_STATUS_CHANGE',
        title: 'Subscription Status Updated',
        message: `Your subscription status changed from ${oldStatus} to ${newStatus}`,
        metadata: { customerId, oldStatus, newStatus },
      });
    } catch (error) {
      apiLogger.webhookEvent('stripe', 'notification_failed', {
        type: 'status_change',
        customerId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async sendSubscriptionCancelledNotification(
    customerId: string
  ): Promise<void> {
    try {
      await createNotification({
        type: 'SUBSCRIPTION_CANCELLED',
        title: 'Subscription Cancelled',
        message:
          'Your subscription has been cancelled. You will lose premium access at the end of your billing period.',
        metadata: { customerId },
      });
    } catch (error) {
      apiLogger.webhookEvent('stripe', 'notification_failed', {
        type: 'cancelled',
        customerId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async sendSubscriptionPausedNotification(
    customerId: string
  ): Promise<void> {
    try {
      await createNotification({
        type: 'SUBSCRIPTION_PAUSED',
        title: 'Subscription Paused',
        message:
          'Your subscription has been paused. Premium access is temporarily disabled.',
        metadata: { customerId },
      });
    } catch (error) {
      apiLogger.webhookEvent('stripe', 'notification_failed', {
        type: 'paused',
        customerId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async sendSubscriptionResumedNotification(
    customerId: string
  ): Promise<void> {
    try {
      await createNotification({
        type: 'SUBSCRIPTION_RESUMED',
        title: 'Subscription Resumed',
        message: 'Your subscription has been resumed. Welcome back to premium!',
        metadata: { customerId },
      });
    } catch (error) {
      apiLogger.webhookEvent('stripe', 'notification_failed', {
        type: 'resumed',
        customerId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async sendTrialEndingNotification(
    customerId: string,
    trialEnd: number
  ): Promise<void> {
    try {
      const endDate = new Date(trialEnd * 1000);
      await createNotification({
        type: 'TRIAL_ENDING',
        title: 'Trial Ending Soon',
        message: `Your trial ends on ${endDate.toLocaleDateString()}. Subscribe to continue enjoying premium features!`,
        metadata: { customerId, trialEnd },
      });
    } catch (error) {
      apiLogger.webhookEvent('stripe', 'notification_failed', {
        type: 'trial_ending',
        customerId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async sendPaymentSuccessNotification(
    customerId: string,
    amount: number,
    currency: string
  ): Promise<void> {
    try {
      const formattedAmount = (amount / 100).toFixed(2);
      await createNotification({
        type: 'PAYMENT_SUCCESS',
        title: 'Payment Successful',
        message: `Your payment of ${formattedAmount} ${currency.toUpperCase()} was processed successfully.`,
        metadata: { customerId, amount, currency },
      });
    } catch (error) {
      apiLogger.webhookEvent('stripe', 'notification_failed', {
        type: 'payment_success',
        customerId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async sendPaymentFailureNotification(
    customerId: string,
    attemptCount: number,
    nextAttempt?: number
  ): Promise<void> {
    try {
      let message = `Payment attempt ${attemptCount} failed.`;
      if (nextAttempt) {
        const nextDate = new Date(nextAttempt * 1000);
        message += ` Next attempt: ${nextDate.toLocaleDateString()}`;
      }

      await createNotification({
        type: 'PAYMENT_FAILED',
        title: 'Payment Failed',
        message,
        metadata: { customerId, attemptCount, nextAttempt },
      });
    } catch (error) {
      apiLogger.webhookEvent('stripe', 'notification_failed', {
        type: 'payment_failure',
        customerId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async sendPaymentActionRequiredNotification(
    customerId: string,
    invoiceUrl?: string
  ): Promise<void> {
    try {
      await createNotification({
        type: 'PAYMENT_ACTION_REQUIRED',
        title: 'Payment Action Required',
        message:
          'Your payment requires additional authentication. Please complete the payment process.',
        actionUrl: invoiceUrl,
        metadata: { customerId, invoiceUrl },
      });
    } catch (error) {
      apiLogger.webhookEvent('stripe', 'notification_failed', {
        type: 'payment_action_required',
        customerId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async sendUpcomingInvoiceNotification(
    customerId: string,
    amount: number,
    currency: string,
    periodEnd: number
  ): Promise<void> {
    try {
      const formattedAmount = (amount / 100).toFixed(2);
      const endDate = new Date(periodEnd * 1000);
      await createNotification({
        type: 'UPCOMING_INVOICE',
        title: 'Upcoming Payment',
        message: `Your next payment of ${formattedAmount} ${currency.toUpperCase()} is due on ${endDate.toLocaleDateString()}.`,
        metadata: { customerId, amount, currency, periodEnd },
      });
    } catch (error) {
      apiLogger.webhookEvent('stripe', 'notification_failed', {
        type: 'upcoming_invoice',
        customerId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // ========== ERROR HANDLING ==========

  private handleWebhookError(
    error: any,
    eventType: string,
    id: string,
    eventId?: string
  ): never {
    apiLogger.webhookEvent('stripe', `${eventType}.failed`, {
      id,
      eventId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error; // Re-throw to trigger Stripe retry
  }
}
