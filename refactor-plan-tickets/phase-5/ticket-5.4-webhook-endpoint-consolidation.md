# Ticket 5.4: Webhook Endpoint Consolidation
**Priority:** MEDIUM | **Effort:** 1 day | **Risk:** Low

## Description
Update the main Stripe webhook endpoint to use the new enhanced handlers and ensure proper event routing.

## Implementation
```typescript
// src/app/api/webhooks/stripe/route.ts (updated)
import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe } from '@/lib/stripe';
import { apiLogger } from '@/lib/enhanced-logger';
import { StripeSubscriptionHandler } from '@/webhooks/stripe/enhanced-subscription-handler';

const subscriptionHandler = new StripeSubscriptionHandler();

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');
    
    if (!signature) {
      apiLogger.webhookEvent('stripe', 'missing_signature', {
        url: request.url
      });
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }
    
    // Verify webhook signature
    let event: Stripe.Event;
    
    try {
      event = stripe.webhooks.constructEvent(
        body, 
        signature, 
        process.env.STRIPE_WEBHOOK_SECRET!
      );
    } catch (err) {
      apiLogger.webhookEvent('stripe', 'signature_verification_failed', {
        error: err.message
      });
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }
    
    apiLogger.webhookEvent('stripe', event.type, {
      eventId: event.id,
      livemode: event.livemode,
      created: event.created
    });
    
    // Route events to appropriate handlers
    try {
      switch (event.type) {
        // Subscription lifecycle events
        case 'customer.subscription.created':
          await subscriptionHandler.handleCustomerSubscriptionCreated(event);
          break;
          
        case 'customer.subscription.updated':
          await subscriptionHandler.handleCustomerSubscriptionUpdated(event);
          break;
          
        case 'customer.subscription.deleted':
          await subscriptionHandler.handleCustomerSubscriptionDeleted(event);
          break;
          
        case 'customer.subscription.paused':
          await subscriptionHandler.handleCustomerSubscriptionPaused(event);
          break;
          
        case 'customer.subscription.resumed':
          await subscriptionHandler.handleCustomerSubscriptionResumed(event);
          break;
          
        case 'customer.subscription.trial_will_end':
          await subscriptionHandler.handleTrialWillEnd(event);
          break;
          
        // Payment and invoice events
        case 'invoice.payment_succeeded':
          await subscriptionHandler.handleInvoicePaymentSucceeded(event);
          break;
          
        case 'invoice.payment_failed':
          await subscriptionHandler.handleInvoicePaymentFailed(event);
          break;
          
        case 'invoice.payment_action_required':
          await subscriptionHandler.handleInvoicePaymentActionRequired(event);
          break;
          
        case 'invoice.upcoming':
          await subscriptionHandler.handleInvoiceUpcoming(event);
          break;
          
        case 'invoice.created':
          await subscriptionHandler.handleInvoiceCreated(event);
          break;
          
        case 'invoice.finalized':
          await subscriptionHandler.handleInvoiceFinalized(event);
          break;
          
        // Customer events
        case 'customer.created':
          await subscriptionHandler.handleCustomerCreated(event);
          break;
          
        case 'customer.updated':
          await subscriptionHandler.handleCustomerUpdated(event);
          break;
          
        case 'customer.deleted':
          await subscriptionHandler.handleCustomerDeleted(event);
          break;
          
        // Checkout events
        case 'checkout.session.completed':
          await subscriptionHandler.handleCheckoutSessionCompleted(event);
          break;
          
        default:
          apiLogger.webhookEvent('stripe', 'unhandled_event', {
            eventType: event.type,
            eventId: event.id
          });
          // Don't return error for unhandled events - just log them
      }
      
      apiLogger.webhookEvent('stripe', 'event_processed_successfully', {
        eventType: event.type,
        eventId: event.id
      });
      
    } catch (handlerError) {
      apiLogger.webhookEvent('stripe', 'event_handler_failed', {
        eventType: event.type,
        eventId: event.id,
        error: handlerError.message,
        stack: handlerError.stack
      });
      
      // Return 500 to let Stripe retry the webhook
      return NextResponse.json(
        { error: 'Handler failed', eventType: event.type }, 
        { status: 500 }
      );
    }
    
    return NextResponse.json({ 
      received: true, 
      eventType: event.type,
      eventId: event.id 
    });
    
  } catch (error) {
    apiLogger.webhookEvent('stripe', 'webhook_error', {
      error: error.message,
      stack: error.stack
    });
    
    return NextResponse.json(
      { error: 'Webhook processing failed' }, 
      { status: 500 }
    );
  }
}

// Health check endpoint for Stripe webhook monitoring
export async function GET() {
  return NextResponse.json({ 
    status: 'healthy',
    endpoint: '/api/webhooks/stripe',
    timestamp: new Date().toISOString()
  });
}
```

## Enhanced Handler Methods
Additional methods to implement in `StripeSubscriptionHandler`:

```typescript
// Additional methods for complete event coverage
export class StripeSubscriptionHandler {
  // ... existing methods ...

  async handleCustomerSubscriptionPaused(event: Stripe.Event) {
    const subscription = event.data.object as Stripe.Subscription;
    
    apiLogger.webhookEvent('stripe', 'subscription.paused', {
      subscriptionId: subscription.id,
      customerId: subscription.customer
    });

    try {
      await this.syncService.createOrUpdateSubscription(subscription);
      await this.syncService.revokeUserAccess(subscription.customer as string);
      
      // Notify user about paused subscription
      await this.notificationService.sendSubscriptionPausedNotification(
        subscription.customer as string
      );
      
    } catch (error) {
      this.handleWebhookError(error, 'subscription.paused', subscription.id);
    }
  }

  async handleCustomerSubscriptionResumed(event: Stripe.Event) {
    const subscription = event.data.object as Stripe.Subscription;
    
    apiLogger.webhookEvent('stripe', 'subscription.resumed', {
      subscriptionId: subscription.id,
      customerId: subscription.customer
    });

    try {
      await this.syncService.createOrUpdateSubscription(subscription);
      await this.syncService.grantUserAccess(subscription.customer as string);
      
      // Notify user about resumed subscription
      await this.notificationService.sendSubscriptionResumedNotification(
        subscription.customer as string
      );
      
    } catch (error) {
      this.handleWebhookError(error, 'subscription.resumed', subscription.id);
    }
  }

  async handleTrialWillEnd(event: Stripe.Event) {
    const subscription = event.data.object as Stripe.Subscription;
    
    apiLogger.webhookEvent('stripe', 'trial_will_end', {
      subscriptionId: subscription.id,
      customerId: subscription.customer,
      trialEnd: subscription.trial_end
    });

    try {
      // Notify user about ending trial
      await this.notificationService.sendTrialEndingNotification(
        subscription.customer as string,
        subscription.trial_end
      );
      
    } catch (error) {
      this.handleWebhookError(error, 'trial_will_end', subscription.id);
    }
  }

  async handleCheckoutSessionCompleted(event: Stripe.Event) {
    const session = event.data.object as Stripe.Checkout.Session;
    
    apiLogger.webhookEvent('stripe', 'checkout.session.completed', {
      sessionId: session.id,
      customerId: session.customer,
      subscriptionId: session.subscription
    });

    try {
      if (session.subscription) {
        // Fetch the full subscription from Stripe
        const subscription = await stripe.subscriptions.retrieve(
          session.subscription as string
        );
        
        await this.syncService.createOrUpdateSubscription(subscription);
        await this.syncService.grantUserAccess(session.customer as string);
        
        // Send welcome notification
        await this.notificationService.sendWelcomeNotification(
          session.customer as string
        );
      }
      
    } catch (error) {
      this.handleWebhookError(error, 'checkout.session.completed', session.id);
    }
  }

  private handleWebhookError(error: any, eventType: string, id: string) {
    apiLogger.webhookEvent('stripe', `${eventType}.failed`, {
      id,
      error: error.message
    });
    throw error; // Re-throw to trigger Stripe retry
  }
}
```

## Webhook Testing & Monitoring
```typescript
// src/lib/webhook-testing.ts
export class WebhookTester {
  static async testStripeWebhook(eventType: string, testData: any) {
    try {
      const testEvent = stripe.webhooks.generateTestHeaderString({
        payload: JSON.stringify({
          type: eventType,
          data: { object: testData }
        }),
        secret: process.env.STRIPE_WEBHOOK_SECRET!
      });
      
      apiLogger.webhookEvent('stripe', 'test_webhook_generated', {
        eventType,
        testMode: true
      });
      
      return testEvent;
    } catch (error) {
      apiLogger.webhookEvent('stripe', 'test_webhook_failed', {
        eventType,
        error: error.message
      });
      throw error;
    }
  }
}
```

## Acceptance Criteria
- [ ] Update main webhook endpoint to use enhanced handlers
- [ ] Implement proper error handling and Stripe retry logic
- [ ] Add comprehensive logging for all webhook events
- [ ] Support all critical Stripe events with proper routing
- [ ] Include webhook signature verification
- [ ] Provide health check endpoint for monitoring
- [ ] Handle webhook failures gracefully with appropriate HTTP status codes

### Documentation Requirements
- [ ] Create webhook endpoint architecture diagram
- [ ] Document webhook monitoring and debugging in `docs/operations/webhook-monitoring.md`
- [ ] Add webhook deployment and configuration guide

### Testing Requirements
- [ ] **Unit Tests**: Webhook routing and handler selection logic
- [ ] **Integration Tests**: Complete webhook endpoint with real Stripe events
- [ ] **Webhook Endpoint Tests**:
  - [ ] **Event Routing**: Test all event types route to correct handlers
  - [ ] **Signature Verification**: Test webhook signature validation
  - [ ] **Error Handling**: Test webhook failures return appropriate status codes
  - [ ] **Health Check**: Test monitoring endpoint functionality
- [ ] **Security Tests**: Test webhook signature validation and replay protection
- [ ] **Load Tests**: Test webhook endpoint under high event volume

## Files to Create/Modify
- `src/app/api/webhooks/stripe/route.ts` (update)
- `src/webhooks/stripe/enhanced-subscription-handler.ts` (add remaining methods)
- `src/lib/webhook-testing.ts` (new, for development/testing)

## Testing Checklist
- [ ] Test all subscription lifecycle events
- [ ] Test payment success/failure scenarios
- [ ] Test webhook signature verification
- [ ] Test error handling and retry logic
- [ ] Test duplicate event handling
- [ ] Verify database consistency after webhook processing

## Dependencies
- Ticket 5.1 (Comprehensive Stripe Event Handlers)
- Ticket 5.2 (Subscription Sync Service)

## Context
This ticket is part of **Phase 5: Stripe-Database Subscription Synchronization**, which implements comprehensive webhook-based synchronization between Stripe subscription events and the local Subscription table to ensure accurate premium access control. 