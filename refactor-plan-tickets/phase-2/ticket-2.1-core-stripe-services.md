# Ticket 2.1: Core Stripe Services Implementation
**Priority:** HIGH | **Effort:** 4 days | **Risk:** Medium

## Description
Implement the most critical Stripe services (Customer and Subscription) that are used across 15+ API routes, eliminating 400+ lines of duplicate Stripe operations while implementing structured logging for all operations.

## Current Problem
- `findCustomerByEmail` pattern repeated 8+ times across routes
- Subscription operations (list, create, update, cancel) repeated 15+ times
- No centralized error handling for Stripe operations
- Manual customer lookup logic scattered everywhere
- Inconsistent console logging for Stripe operations

## Implementation

### CustomerService
```typescript
// src/services/stripe/customer-service.ts
import { apiLogger } from '@/lib/enhanced-logger';

export class CustomerService extends BaseStripeService {
  // Most critical - used 8+ times
  async findCustomerByEmail(email: string): Promise<Stripe.Customer | null> {
    return await this.handleStripeOperation(
      async () => {
        apiLogger.databaseOperation('stripe_find_customer', true, { email: email.substring(0, 3) + '***' });
        const customers = await this.stripe.customers.list({
          email,
          limit: 1,
        });
        return customers.data[0] || null;
      },
      'find customer by email',
      { email: email.substring(0, 3) + '***' } // Mask email for security
    );
  }
  
  // Customer with expanded subscriptions
  async findCustomerWithSubscriptions(email: string): Promise<Stripe.Customer | null> {
    return await this.handleStripeOperation(
      async () => {
        const customers = await this.stripe.customers.list({
          email,
          limit: 1,
          expand: ['data.subscriptions'],
        });
        return customers.data[0] || null;
      },
      'find customer with subscriptions',
      { email }
    );
  }
  
  // Customer creation with error handling
  async createCustomer(data: CreateCustomerData): Promise<Stripe.Customer> {
    return await this.handleStripeOperation(
      () => this.stripe.customers.create({
        email: data.email,
        name: data.name,
        metadata: data.metadata || {},
      }),
      'create customer',
      data
    );
  }
  
  // Customer updates
  async updateCustomer(customerId: string, data: UpdateCustomerData): Promise<Stripe.Customer> {
    this.validateCustomerId(customerId);
    return await this.handleStripeOperation(
      () => this.stripe.customers.update(customerId, data),
      'update customer',
      { customerId, data }
    );
  }
}

interface CreateCustomerData {
  email: string;
  name?: string;
  metadata?: Record<string, string>;
}

interface UpdateCustomerData {
  name?: string;
  email?: string;
  metadata?: Record<string, string>;
}
```

### SubscriptionService
```typescript
// src/services/stripe/subscription-service.ts
export class SubscriptionService extends BaseStripeService {
  private customerService = new CustomerService();
  
  // List subscriptions - used 10+ times
  async listSubscriptionsByCustomer(
    customerId: string, 
    options: ListSubscriptionOptions = {}
  ): Promise<Stripe.Subscription[]> {
    this.validateCustomerId(customerId);
    
    return await this.handleStripeOperation(
      async () => {
        const subscriptions = await this.stripe.subscriptions.list({
          customer: customerId,
          limit: options.limit || 10,
          expand: options.expand || ['data.latest_invoice', 'data.items.data.price'],
          status: options.status,
          ...options,
        });
        return subscriptions.data;
      },
      'list customer subscriptions',
      { customerId, options }
    );
  }
  
  // Retrieve single subscription
  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    this.validateSubscriptionId(subscriptionId);
    
    return await this.handleStripeOperation(
      () => this.stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['latest_invoice', 'items.data.price'],
      }),
      'retrieve subscription',
      { subscriptionId }
    );
  }
  
  // Create subscription (admin operations)
  async createSubscription(data: CreateSubscriptionData): Promise<Stripe.Subscription> {
    this.validateCustomerId(data.customer);
    
    return await this.handleStripeOperation(
      () => this.stripe.subscriptions.create(data),
      'create subscription',
      data
    );
  }
  
  // Update subscription (toggle auto-renew, apply coupons)
  async updateSubscription(
    subscriptionId: string, 
    data: UpdateSubscriptionData
  ): Promise<Stripe.Subscription> {
    this.validateSubscriptionId(subscriptionId);
    
    return await this.handleStripeOperation(
      () => this.stripe.subscriptions.update(subscriptionId, data),
      'update subscription',
      { subscriptionId, data }
    );
  }
  
  // Cancel subscription
  async cancelSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    this.validateSubscriptionId(subscriptionId);
    
    return await this.handleStripeOperation(
      () => this.stripe.subscriptions.cancel(subscriptionId),
      'cancel subscription',
      { subscriptionId }
    );
  }
  
  // Toggle auto-renewal (frequently used pattern)
  async toggleAutoRenew(subscriptionId: string, autoRenew: boolean): Promise<Stripe.Subscription> {
    return await this.updateSubscription(subscriptionId, {
      cancel_at_period_end: !autoRenew,
    });
  }
  
  // Force sync subscription from Stripe (used in multiple routes)
  async syncSubscriptionFromStripe(subscriptionId: string): Promise<Stripe.Subscription> {
    return await this.getSubscription(subscriptionId);
  }
}

interface ListSubscriptionOptions {
  limit?: number;
  expand?: string[];
  status?: 'active' | 'canceled' | 'past_due' | 'trialing' | 'all';
}

interface CreateSubscriptionData {
  customer: string;
  items: Array<{ price: string; quantity?: number }>;
  coupon?: string;
  trial_period_days?: number;
  metadata?: Record<string, string>;
}

interface UpdateSubscriptionData {
  cancel_at_period_end?: boolean;
  coupon?: string;
  metadata?: Record<string, string>;
  items?: Array<{ id?: string; price?: string; quantity?: number; deleted?: boolean }>;
}
```

## Acceptance Criteria
- [ ] Implement CustomerService with findCustomerByEmail, create, update methods
- [ ] Implement SubscriptionService with CRUD operations and specialized methods
- [ ] Add proper TypeScript interfaces for all parameters
- [ ] Include comprehensive error handling and logging
- [ ] Create unit tests for each service method
- [ ] Migrate 5 API routes to use new services

### Documentation Requirements
- [ ] Create Stripe services architecture diagram showing service relationships
- [ ] Document subscription lifecycle workflow in `docs/features/subscription-management.md`
- [ ] Add API documentation for all service methods

### Testing Requirements
- [ ] **Unit Tests**: All service methods with mock Stripe responses
- [ ] **Integration Tests**: Full subscription flows with test Stripe accounts
- [ ] **Subscription Flow Tests** (CRITICAL):
  - [ ] **Create Subscription**: Test checkout → webhook → database sync → access granted
  - [ ] **Update Subscription**: Test plan changes and proration handling
  - [ ] **Cancel Subscription**: Test immediate vs. end-of-period cancellation
  - [ ] **Payment Failure**: Test dunning management and access revocation
  - [ ] **Subscription Reactivation**: Test resume after cancellation
- [ ] **Error Handling Tests**: Stripe API failures, network timeouts, webhook validation
- [ ] **Load Tests**: Concurrent subscription operations

## Files to Create/Modify
- `src/services/stripe/customer-service.ts` (new)
- `src/services/stripe/subscription-service.ts` (new)
- `src/services/stripe/types.ts` (new) - All Stripe-related types
- Migrate these routes first:
  - `src/app/api/subscription/force-sync/route.ts`
  - `src/app/api/subscription/toggle-autorenew/route.ts`
  - `src/app/api/subscription/cancel/route.ts`
  - `src/app/api/auth/session-check/route.ts`
  - `src/app/api/admin/users/grant-subscription/route.ts`

## Dependencies
- Ticket 1.5 (Stripe Client Singleton)
- Ticket 1.1 (Logger Consolidation) 