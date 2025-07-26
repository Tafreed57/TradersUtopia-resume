# Ticket 5.1: Comprehensive Stripe Event Handlers
**Priority:** HIGH | **Effort:** 3 days | **Risk:** Medium

## Description
Implement complete webhook handlers for all subscription lifecycle events to maintain perfect sync between Stripe and the local database.

## Stripe Events to Handle

### Core Subscription Events
```typescript
// Essential subscription lifecycle events
customer.subscription.created     // New subscription
customer.subscription.updated     // Plan changes, renewals, modifications
customer.subscription.deleted     // Cancellations and deletions
customer.subscription.paused      // Subscription paused
customer.subscription.resumed     // Subscription resumed
customer.subscription.trial_will_end // Trial ending warning (3 days prior)
```

### Payment and Invoice Events  
```typescript
// Payment processing events
invoice.payment_succeeded         // Successful payment - grant access
invoice.payment_failed           // Failed payment - potential access revocation
invoice.payment_action_required  // Payment needs user action
invoice.upcoming                 // Upcoming renewal notification
invoice.created                  // New invoice generated
invoice.finalized               // Invoice ready for payment
```

### Customer Events
```typescript
// Customer lifecycle events
customer.created                 // New customer (may not have subscription yet)
customer.updated                 // Customer information changes
customer.deleted                 // Customer deletion (rare)
```

## Implementation

### Enhanced Subscription Handler
```typescript
// src/webhooks/stripe/enhanced-subscription-handler.ts
import { apiLogger } from '@/lib/enhanced-logger';
import { SubscriptionSyncService } from '@/services/subscription-sync-service';

export class StripeSubscriptionHandler {
  private syncService = new SubscriptionSyncService();

  async handleCustomerSubscriptionCreated(event: Stripe.Event) {
    const subscription = event.data.object as Stripe.Subscription;
    
    apiLogger.webhookEvent('stripe', 'subscription.created', {
      subscriptionId: subscription.id,
      customerId: subscription.customer,
      status: subscription.status
    });

    try {
      await this.syncService.createOrUpdateSubscription(subscription);
      await this.syncService.updateUserAccess(subscription.customer as string);
      
      apiLogger.webhookEvent('stripe', 'subscription.created.success', {
        subscriptionId: subscription.id
      });
    } catch (error) {
      apiLogger.webhookEvent('stripe', 'subscription.created.failed', {
        subscriptionId: subscription.id,
        error: error.message
      });
      throw error;
    }
  }

  async handleCustomerSubscriptionUpdated(event: Stripe.Event) {
    const subscription = event.data.object as Stripe.Subscription;
    const previousAttributes = event.data.previous_attributes;
    
    apiLogger.webhookEvent('stripe', 'subscription.updated', {
      subscriptionId: subscription.id,
      customerId: subscription.customer,
      status: subscription.status,
      changes: Object.keys(previousAttributes || {})
    });

    try {
      await this.syncService.createOrUpdateSubscription(subscription);
      
      // Check if status changed to update access
      if (previousAttributes?.status) {
        await this.syncService.updateUserAccess(subscription.customer as string);
      }
      
      apiLogger.webhookEvent('stripe', 'subscription.updated.success', {
        subscriptionId: subscription.id
      });
    } catch (error) {
      apiLogger.webhookEvent('stripe', 'subscription.updated.failed', {
        subscriptionId: subscription.id,
        error: error.message
      });
      throw error;
    }
  }

  async handleCustomerSubscriptionDeleted(event: Stripe.Event) {
    const subscription = event.data.object as Stripe.Subscription;
    
    apiLogger.webhookEvent('stripe', 'subscription.deleted', {
      subscriptionId: subscription.id,
      customerId: subscription.customer
    });

    try {
      await this.syncService.handleSubscriptionCancellation(subscription);
      await this.syncService.revokeUserAccess(subscription.customer as string);
      
      apiLogger.webhookEvent('stripe', 'subscription.deleted.success', {
        subscriptionId: subscription.id
      });
    } catch (error) {
      apiLogger.webhookEvent('stripe', 'subscription.deleted.failed', {
        subscriptionId: subscription.id,
        error: error.message
      });
      throw error;
    }
  }

  async handleInvoicePaymentSucceeded(event: Stripe.Event) {
    const invoice = event.data.object as Stripe.Invoice;
    
    if (!invoice.subscription) return; // Only handle subscription invoices
    
    apiLogger.webhookEvent('stripe', 'invoice.payment_succeeded', {
      invoiceId: invoice.id,
      subscriptionId: invoice.subscription,
      amount: invoice.amount_paid
    });

    try {
      // Payment succeeded - ensure access is granted
      const subscription = await this.syncService.syncSubscriptionFromInvoice(invoice);
      await this.syncService.grantUserAccess(invoice.customer as string);
      
      apiLogger.webhookEvent('stripe', 'invoice.payment_succeeded.success', {
        invoiceId: invoice.id,
        subscriptionId: invoice.subscription
      });
    } catch (error) {
      apiLogger.webhookEvent('stripe', 'invoice.payment_succeeded.failed', {
        invoiceId: invoice.id,
        error: error.message
      });
      throw error;
    }
  }

  async handleInvoicePaymentFailed(event: Stripe.Event) {
    const invoice = event.data.object as Stripe.Invoice;
    
    if (!invoice.subscription) return;
    
    apiLogger.webhookEvent('stripe', 'invoice.payment_failed', {
      invoiceId: invoice.id,
      subscriptionId: invoice.subscription,
      attemptCount: invoice.attempt_count
    });

    try {
      // Update subscription status and potentially revoke access
      await this.syncService.handlePaymentFailure(invoice);
      
      // Check subscription status to determine if access should be revoked
      const subscription = await this.syncService.getSubscriptionById(invoice.subscription as string);
      if (subscription?.status === 'past_due' || subscription?.status === 'unpaid') {
        await this.syncService.revokeUserAccess(invoice.customer as string);
      }
      
      apiLogger.webhookEvent('stripe', 'invoice.payment_failed.success', {
        invoiceId: invoice.id,
        subscriptionId: invoice.subscription
      });
    } catch (error) {
      apiLogger.webhookEvent('stripe', 'invoice.payment_failed.failed', {
        invoiceId: invoice.id,
        error: error.message
      });
      throw error;
    }
  }
}
```

## Acceptance Criteria
- [ ] Handle all 10+ critical Stripe subscription/payment events
- [ ] Implement structured logging for all webhook events
- [ ] Ensure atomic database operations with proper transaction handling
- [ ] Provide comprehensive error handling and retry logic
- [ ] Update user access permissions based on subscription status changes
- [ ] Handle edge cases (duplicate events, out-of-order delivery)

### Documentation Requirements
- [ ] Create webhook event flow diagram showing all handled events
- [ ] Document webhook security and validation patterns in `docs/integrations/stripe-webhooks.md`
- [ ] Add troubleshooting guide for webhook delivery issues

### Testing Requirements
- [ ] **Unit Tests**: Individual webhook handler functions with mocked Stripe events
- [ ] **Integration Tests**: End-to-end webhook processing with test Stripe events
- [ ] **Webhook Event Tests** (CRITICAL):
  - [ ] **Subscription Created**: Test new subscription webhook → database sync → access granted
  - [ ] **Subscription Updated**: Test plan changes and status updates
  - [ ] **Subscription Canceled**: Test cancellation webhook → access revocation
  - [ ] **Payment Succeeded**: Test successful payment → subscription activation
  - [ ] **Payment Failed**: Test failed payment → access suspension
- [ ] **Edge Case Tests**: Duplicate events, out-of-order delivery, malformed webhooks
- [ ] **Security Tests**: Webhook signature validation and replay attack prevention

## Files to Create/Modify
- `src/webhooks/stripe/enhanced-subscription-handler.ts` (new)
- Update existing handlers in `src/webhooks/stripe/` to use new structured approach
- `src/app/api/webhooks/stripe/route.ts` (update to use new handlers)

## Dependencies
- Ticket 1.1 (Logger Consolidation)
- Ticket 5.2 (Subscription Sync Service)

## Context
This ticket is part of **Phase 5: Stripe-Database Subscription Synchronization**, which implements comprehensive webhook-based synchronization between Stripe subscription events and the local Subscription table to ensure accurate premium access control. 