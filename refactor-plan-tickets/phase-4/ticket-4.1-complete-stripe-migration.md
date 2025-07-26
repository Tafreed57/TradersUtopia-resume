# Ticket 4.1: Complete Stripe Service Migration
**Priority:** HIGH | **Effort:** 3 days | **Risk:** LOW

## Description
Complete the migration of all remaining Stripe operations to the centralized service layer, eliminating the last 40+ duplicate Stripe operations across 14 remaining API routes.

## Remaining Routes to Migrate
Based on the Stripe service implementation plan, these routes still need migration:

**High Priority Routes:**
- `src/app/api/subscription/details/route.ts`
- `src/app/api/subscription/sync/route.ts`
- `src/app/api/subscription/create-coupon/route.ts`
- `src/app/api/subscription/fix-subscription-amount/route.ts`
- `src/app/api/subscription/force-sync-discount/route.ts`
- `src/app/api/subscription/backfill-original-amount/route.ts`
- `src/app/api/subscription/backfill-subscription-ids/route.ts`

**Medium Priority Routes:**
- `src/app/api/invoices/route.ts`
- `src/app/api/verify-stripe-payment/route.ts`
- `src/app/api/subscription/verify-status/route.ts`
- `src/app/api/admin/users/cancel-subscription/route.ts`
- `src/app/api/admin/users/delete/route.ts`

**Webhook & Integration:**
- `src/app/api/webhooks/stripe/route.ts`
- `src/app/api/webhooks/clerk/route.ts`

## Implementation Strategy

### Remaining Stripe Services
```typescript
// src/services/stripe/coupon-service.ts
export class CouponService extends BaseStripeService {
  // Create promotional coupons
  async createCoupon(data: CreateCouponData): Promise<Stripe.Coupon> {
    return await this.handleStripeOperation(
      () => this.stripe.coupons.create({
        percent_off: data.percentOff,
        duration: data.duration,
        duration_in_months: data.durationInMonths,
        name: data.name,
        metadata: data.metadata || {},
      }),
      'create coupon',
      data
    );
  }
  
  // Apply coupon to subscription
  async applyCouponToSubscription(
    subscriptionId: string, 
    couponId: string
  ): Promise<Stripe.Subscription> {
    this.validateSubscriptionId(subscriptionId);
    
    return await this.handleStripeOperation(
      () => this.stripe.subscriptions.update(subscriptionId, {
        coupon: couponId,
      }),
      'apply coupon to subscription',
      { subscriptionId, couponId }
    );
  }
}

// src/services/stripe/invoice-service.ts
export class InvoiceService extends BaseStripeService {
  // List customer invoices
  async listInvoices(customerId: string, limit: number = 20): Promise<Stripe.Invoice[]> {
    this.validateCustomerId(customerId);
    
    return await this.handleStripeOperation(
      async () => {
        const invoices = await this.stripe.invoices.list({
          customer: customerId,
          limit,
          expand: ['data.subscription'],
        });
        return invoices.data;
      },
      'list customer invoices',
      { customerId, limit }
    );
  }
  
  // Get invoice details
  async getInvoice(invoiceId: string): Promise<Stripe.Invoice> {
    return await this.handleStripeOperation(
      () => this.stripe.invoices.retrieve(invoiceId, {
        expand: ['subscription', 'payment_intent'],
      }),
      'get invoice details',
      { invoiceId }
    );
  }
}

// src/services/stripe/webhook-service.ts
export class WebhookService extends BaseStripeService {
  // Verify and construct webhook event
  async constructEvent(body: string, signature: string): Promise<Stripe.Event> {
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;
    
    try {
      return this.stripe.webhooks.constructEvent(body, signature, endpointSecret);
    } catch (error) {
      throw new WebhookVerificationError('Webhook signature verification failed', error);
    }
  }
  
  // Process webhook event with proper typing
  async processWebhookEvent(event: Stripe.Event): Promise<NextResponse> {
    try {
      switch (event.type) {
        case 'checkout.session.completed':
          return await this.handleCheckoutCompleted(event);
        case 'customer.subscription.created':
          return await this.handleSubscriptionCreated(event);
        case 'customer.subscription.updated':
          return await this.handleSubscriptionUpdated(event);
        case 'customer.subscription.deleted':
          return await this.handleSubscriptionDeleted(event);
        case 'invoice.payment_succeeded':
          return await this.handlePaymentSucceeded(event);
        case 'invoice.payment_failed':
          return await this.handlePaymentFailed(event);
        default:
          console.log(`Unhandled event type: ${event.type}`);
          return NextResponse.json({ received: true });
      }
    } catch (error) {
      console.error(`Webhook processing error for ${event.type}:`, error);
      return NextResponse.json(
        { error: 'Webhook processing failed' },
        { status: 500 }
      );
    }
  }
  
  private async handleSubscriptionUpdated(event: Stripe.Event): Promise<NextResponse> {
    const subscription = event.data.object as Stripe.Subscription;
    
    // Update subscription in database using SubscriptionService
    const subscriptionService = new SubscriptionService();
    await subscriptionService.syncSubscriptionFromStripe(subscription.id);
    
    // Update user roles based on subscription status
    await this.updateMemberRoleBasedOnSubscription(subscription);
    
    return NextResponse.json({ received: true });
  }
}

// src/services/stripe/admin-service.ts
export class AdminService extends BaseStripeService {
  private customerService = new CustomerService();
  private subscriptionService = new SubscriptionService();
  private couponService = new CouponService();
  
  // Grant subscription to user (admin operation)
  async grantSubscriptionToUser(data: AdminGrantSubscriptionData): Promise<{
    customer: Stripe.Customer;
    subscription: Stripe.Subscription;
  }> {
    // Create customer if needed
    let customer = await this.customerService.findCustomerByEmail(data.email);
    
    if (!customer) {
      customer = await this.customerService.createCustomer({
        email: data.email,
        name: data.name,
        metadata: { grantedBy: data.adminId },
      });
    }
    
    // Create 100% discount coupon
    const coupon = await this.couponService.createCoupon({
      percentOff: 100,
      duration: 'forever',
      name: `Admin Grant - ${data.email}`,
      metadata: { adminGrant: 'true', grantedBy: data.adminId },
    });
    
    // Create subscription with 100% discount
    const subscription = await this.subscriptionService.createSubscription({
      customer: customer.id,
      items: [{ price: data.priceId }],
      coupon: coupon.id,
      metadata: { adminGrant: 'true', grantedBy: data.adminId },
    });
    
    return { customer, subscription };
  }
  
  // Cancel user subscription (admin operation)
  async cancelUserSubscription(customerId: string): Promise<void> {
    this.validateCustomerId(customerId);
    
    const subscriptions = await this.subscriptionService.listSubscriptionsByCustomer(customerId);
    
    for (const subscription of subscriptions) {
      if (subscription.status === 'active') {
        await this.subscriptionService.cancelSubscription(subscription.id);
      }
    }
  }
}
```

### Main Stripe Service Export
```typescript
// src/services/stripe/index.ts
export { StripeClientService } from './base/stripe-client';
export { CustomerService } from './customer-service';
export { SubscriptionService } from './subscription-service';
export { CouponService } from './coupon-service';
export { InvoiceService } from './invoice-service';
export { WebhookService } from './webhook-service';
export { AdminService } from './admin-service';

// Convenience service factory
export class StripeServices {
  static customer = new CustomerService();
  static subscription = new SubscriptionService();
  static coupon = new CouponService();
  static invoice = new InvoiceService();
  static webhook = new WebhookService();
  static admin = new AdminService();
}

// Usage in API routes:
// import { StripeServices } from '@/services/stripe';
// const customer = await StripeServices.customer.findCustomerByEmail(email);
```

## Acceptance Criteria
- [ ] Implement remaining Stripe services (Coupon, Invoice, Webhook, Admin)
- [ ] Migrate all 14 remaining API routes to use Stripe services
- [ ] Eliminate all manual Stripe client instantiations
- [ ] Create centralized StripeServices export for easy usage
- [ ] Ensure webhook processing is fully centralized
- [ ] Validate all Stripe operations maintain exact same behavior
- [ ] Add comprehensive error handling and logging

## Files to Create/Modify
- `src/services/stripe/coupon-service.ts` (new)
- `src/services/stripe/invoice-service.ts` (new)
- `src/services/stripe/webhook-service.ts` (new)
- `src/services/stripe/admin-service.ts` (new)
- `src/services/stripe/index.ts` (update main export)
- Migrate all remaining API routes

### Documentation Requirements
- [ ] Create complete Stripe integration architecture diagram
- [ ] Document all Stripe services and their relationships in `docs/integrations/stripe-services.md`
- [ ] Add webhook handling documentation with security guidelines

### Testing Requirements
- [ ] **Unit Tests**: All new Stripe services with comprehensive mocking
- [ ] **Integration Tests**: Full Stripe workflow testing with test API keys
- [ ] **Webhook Tests**: Test all webhook handlers with various event scenarios
- [ ] **Error Handling Tests**: Stripe API failures, network issues, invalid requests
- [ ] **Subscription Flow Tests** (CRITICAL):
  - [ ] **Complete Subscription Lifecycle**: Create → Update → Cancel → Reactivate
  - [ ] **Admin Operations**: Admin-initiated subscription changes and grants
  - [ ] **Invoice Management**: Invoice creation, payment, and failure handling
  - [ ] **Coupon Management**: Discount application and validation

## Dependencies
- Ticket 2.1 (Core Stripe Services Implementation) 