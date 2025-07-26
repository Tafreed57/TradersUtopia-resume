# 💳 Stripe Service Implementation Plan - TRADERSUTOPIA

**Analysis Date:** January 2025  
**Scope:** Consolidation of 60+ Stripe operations across 19 API routes  
**Goal:** Create centralized, reusable Stripe service layer with proper error handling

---

## 📊 **Current State Analysis**

### **Stripe Operations Inventory**
- **Total API Routes with Stripe:** 19 files
- **Stripe Operations Found:** 60+ operations
- **Unique Operation Categories:** 8 service types
- **Repeated Client Instantiation:** 19+ times (`new Stripe()`)
- **Webhook Event Types:** 6+ handled event types

### **Most Repeated Patterns**
1. **Stripe Client Creation** (19+ instances) - `new Stripe(process.env.STRIPE_SECRET_KEY!)`
2. **Customer Lookup by Email** (8+ instances) - `customers.list({ email })`
3. **Subscription Operations** (15+ instances) - list, create, update, cancel, retrieve
4. **Error Handling** (19+ instances) - `instanceof Stripe.errors.StripeError`
5. **Webhook Event Processing** (6+ event types)

---

## 🏗️ **Stripe Service Architecture**

### **Service Structure**
```
src/services/
├── stripe/
│   ├── index.ts                    # Main service export & client singleton
│   ├── base/
│   │   ├── base-stripe-service.ts  # Abstract base class
│   │   ├── stripe-client.ts        # Singleton client management
│   │   ├── types.ts                # Common Stripe types & interfaces
│   │   └── errors.ts               # Stripe error handling utilities
│   ├── customer-service.ts         # Customer operations
│   ├── subscription-service.ts     # Subscription management
│   ├── invoice-service.ts          # Invoice operations
│   ├── coupon-service.ts           # Coupon/discount management
│   ├── product-service.ts          # Product & pricing operations
│   ├── payment-service.ts          # Payment intent operations
│   ├── webhook-service.ts          # Webhook processing
│   └── admin-service.ts            # Admin-specific operations
```

---

## 🔧 **Implementation Plan by Service**

## 1. **StripeClientService** 
**Priority: HIGHEST** | **Affected Routes: 19 files**

### **Core Client Management**
```typescript
class StripeClientService {
  private static instance: Stripe | null = null;
  
  // Singleton pattern - eliminate 19+ instantiations
  static getClient(): Stripe {
    if (!this.instance) {
      if (!process.env.STRIPE_SECRET_KEY) {
        throw new StripeConfigError('STRIPE_SECRET_KEY is not configured');
      }
      this.instance = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: '2023-10-16', // Pin API version for consistency
        typescript: true,
      });
    }
    return this.instance;
  }
  
  // Environment validation
  static validateConfig(): void {
    const required = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'];
    const missing = required.filter(key => !process.env[key]);
    if (missing.length > 0) {
      throw new StripeConfigError(`Missing Stripe config: ${missing.join(', ')}`);
    }
  }
}
```

#### **Current Instantiation Locations:**
- `src/app/api/auth/session-check/route.ts`
- `src/app/api/subscription/*` (12 files)
- `src/app/api/admin/*` (4 files)
- `src/app/api/webhooks/stripe/route.ts`
- `src/app/api/webhooks/clerk/route.ts`
- `src/app/api/invoices/route.ts`
- `src/app/api/verify-stripe-payment/route.ts`

---

## 2. **CustomerService**
**Priority: HIGH** | **Affected Routes: 8+ files**

### **Methods to Implement:**

#### **Customer Operations**
```typescript
class CustomerService extends BaseStripeService {
  // Most critical - used 8+ times
  async findCustomerByEmail(email: string): Promise<Stripe.Customer | null> {
    const customers = await this.stripe.customers.list({
      email,
      limit: 1,
    });
    return customers.data[0] || null;
  }
  
  // Customer creation with error handling
  async createCustomer(data: CreateCustomerData): Promise<Stripe.Customer> {
    return await this.handleStripeOperation(
      () => this.stripe.customers.create({
        email: data.email,
        name: data.name,
        metadata: data.metadata || {},
      }),
      'create customer'
    );
  }
  
  // Customer updates
  async updateCustomer(customerId: string, data: UpdateCustomerData): Promise<Stripe.Customer> {
    return await this.handleStripeOperation(
      () => this.stripe.customers.update(customerId, data),
      'update customer'
    );
  }
  
  // Customer with expanded subscriptions
  async findCustomerWithSubscriptions(email: string): Promise<CustomerWithSubscriptions | null> {
    const customers = await this.stripe.customers.list({
      email,
      limit: 1,
      expand: ['data.subscriptions'],
    });
    return customers.data[0] || null;
  }
}
```

#### **Current Usage Locations:**
- `src/app/api/auth/session-check/route.ts`
- `src/app/api/subscription/force-sync/route.ts`
- `src/app/api/verify-stripe-payment/route.ts`
- `src/app/api/invoices/route.ts`
- `src/app/api/webhooks/clerk/route.ts`
- `src/app/api/admin/users/grant-subscription/route.ts`

---

## 3. **SubscriptionService**
**Priority: HIGH** | **Affected Routes: 15+ files**

### **Methods to Implement:**

#### **Subscription Management**
```typescript
class SubscriptionService extends BaseStripeService {
  // List subscriptions - used 10+ times
  async listSubscriptionsByCustomer(
    customerId: string, 
    options: ListSubscriptionOptions = {}
  ): Promise<Stripe.Subscription[]> {
    const subscriptions = await this.stripe.subscriptions.list({
      customer: customerId,
      limit: options.limit || 10,
      expand: options.expand || ['data.latest_invoice', 'data.items.data.price'],
      ...options,
    });
    return subscriptions.data;
  }
  
  // Retrieve single subscription
  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return await this.handleStripeOperation(
      () => this.stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['latest_invoice', 'items.data.price'],
      }),
      'retrieve subscription'
    );
  }
  
  // Create subscription (admin operations)
  async createSubscription(data: CreateSubscriptionData): Promise<Stripe.Subscription> {
    return await this.handleStripeOperation(
      () => this.stripe.subscriptions.create(data),
      'create subscription'
    );
  }
  
  // Update subscription (toggle auto-renew, apply coupons)
  async updateSubscription(
    subscriptionId: string, 
    data: UpdateSubscriptionData
  ): Promise<Stripe.Subscription> {
    return await this.handleStripeOperation(
      () => this.stripe.subscriptions.update(subscriptionId, data),
      'update subscription'
    );
  }
  
  // Cancel subscription
  async cancelSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return await this.handleStripeOperation(
      () => this.stripe.subscriptions.cancel(subscriptionId),
      'cancel subscription'
    );
  }
  
  // Toggle auto-renewal
  async toggleAutoRenew(subscriptionId: string, autoRenew: boolean): Promise<Stripe.Subscription> {
    return await this.updateSubscription(subscriptionId, {
      cancel_at_period_end: !autoRenew,
    });
  }
}
```

#### **Current Usage Locations:**
- `src/app/api/subscription/stripe-direct/route.ts`
- `src/app/api/subscription/force-sync/route.ts`
- `src/app/api/subscription/sync/route.ts`
- `src/app/api/subscription/details/route.ts`
- `src/app/api/subscription/verify-status/route.ts`
- `src/app/api/subscription/toggle-autorenew/route.ts`
- `src/app/api/subscription/cancel/route.ts`
- `src/app/api/subscription/create-coupon/route.ts`
- `src/app/api/subscription/fix-subscription-amount/route.ts`
- `src/app/api/subscription/force-sync-discount/route.ts`
- `src/app/api/admin/users/grant-subscription/route.ts`
- `src/app/api/admin/users/cancel-subscription/route.ts`
- `src/app/api/admin/users/delete/route.ts`

---

## 4. **CouponService**
**Priority: MEDIUM** | **Affected Routes: 3+ files**

### **Methods to Implement:**

#### **Coupon Operations**
```typescript
class CouponService extends BaseStripeService {
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
      'create coupon'
    );
  }
  
  // Retrieve existing coupon
  async getCoupon(couponId: string): Promise<Stripe.Coupon> {
    return await this.handleStripeOperation(
      () => this.stripe.coupons.retrieve(couponId),
      'retrieve coupon'
    );
  }
  
  // Delete coupon
  async deleteCoupon(couponId: string): Promise<Stripe.DeletedCoupon> {
    return await this.handleStripeOperation(
      () => this.stripe.coupons.del(couponId),
      'delete coupon'
    );
  }
  
  // Apply coupon to subscription
  async applyCouponToSubscription(
    subscriptionId: string, 
    couponId: string
  ): Promise<Stripe.Subscription> {
    return await this.handleStripeOperation(
      () => this.stripe.subscriptions.update(subscriptionId, {
        coupon: couponId,
      }),
      'apply coupon to subscription'
    );
  }
}
```

#### **Current Usage Locations:**
- `src/app/api/subscription/create-coupon/route.ts`
- `src/app/api/admin/users/grant-subscription/route.ts`

---

## 5. **ProductService**
**Priority: LOW** | **Affected Routes: 1+ files**

### **Methods to Implement:**

#### **Product & Pricing Operations**
```typescript
class ProductService extends BaseStripeService {
  // List products
  async listProducts(options: ListProductOptions = {}): Promise<Stripe.Product[]> {
    const products = await this.stripe.products.list({
      active: true,
      limit: options.limit || 10,
      ...options,
    });
    return products.data;
  }
  
  // List prices for products
  async listPrices(productId?: string): Promise<Stripe.Price[]> {
    const prices = await this.stripe.prices.list({
      product: productId,
      active: true,
      limit: 100,
    });
    return prices.data;
  }
}
```

#### **Current Usage Locations:**
- `src/app/api/admin/users/grant-subscription/route.ts`

---

## 6. **PaymentService**
**Priority: LOW** | **Affected Routes: 1+ files**

### **Methods to Implement:**

#### **Payment Intent Operations**
```typescript
class PaymentService extends BaseStripeService {
  // List payment intents for customer
  async listPaymentIntents(customerId: string): Promise<Stripe.PaymentIntent[]> {
    const paymentIntents = await this.stripe.paymentIntents.list({
      customer: customerId,
      limit: 10,
    });
    return paymentIntents.data;
  }
}
```

#### **Current Usage Locations:**
- `src/app/api/verify-stripe-payment/route.ts`

---

## 7. **InvoiceService**
**Priority: LOW** | **Affected Routes: 1+ files**

### **Methods to Implement:**

#### **Invoice Operations**
```typescript
class InvoiceService extends BaseStripeService {
  // List customer invoices
  async listInvoices(customerId: string): Promise<Stripe.Invoice[]> {
    const invoices = await this.stripe.invoices.list({
      customer: customerId,
      limit: 20,
    });
    return invoices.data;
  }
}
```

#### **Current Usage Locations:**
- `src/app/api/invoices/route.ts`

---

## 8. **WebhookService**
**Priority: HIGH** | **Affected Routes: 1 file**

### **Methods to Implement:**

#### **Webhook Processing**
```typescript
class WebhookService extends BaseStripeService {
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
    switch (event.type) {
      case 'checkout.session.completed':
        return this.handleCheckoutCompleted(event);
      case 'customer.subscription.created':
        return this.handleSubscriptionCreated(event);
      case 'customer.subscription.updated':
        return this.handleSubscriptionUpdated(event);
      case 'customer.subscription.deleted':
        return this.handleSubscriptionDeleted(event);
      case 'invoice.payment_succeeded':
        return this.handlePaymentSucceeded(event);
      case 'invoice.payment_failed':
        return this.handlePaymentFailed(event);
      default:
        console.log(`Unhandled event type: ${event.type}`);
        return NextResponse.json({ received: true });
    }
  }
}
```

#### **Current Usage Locations:**
- `src/app/api/webhooks/stripe/route.ts`

---

## 9. **AdminService**
**Priority: MEDIUM** | **Affected Routes: 4+ files**

### **Methods to Implement:**

#### **Admin-Specific Operations**
```typescript
class AdminService extends BaseStripeService {
  // Grant subscription to user (admin operation)
  async grantSubscriptionToUser(data: AdminGrantSubscriptionData): Promise<{
    customer: Stripe.Customer;
    subscription: Stripe.Subscription;
  }> {
    // Create customer if needed
    const customer = await this.customerService.createCustomer({
      email: data.email,
      name: data.name,
      metadata: { grantedBy: data.adminId },
    });
    
    // Create subscription with 100% discount
    const subscription = await this.subscriptionService.createSubscription({
      customer: customer.id,
      items: [{ price: data.priceId }],
      coupon: data.couponId,
      metadata: { adminGrant: 'true', grantedBy: data.adminId },
    });
    
    return { customer, subscription };
  }
  
  // Cancel user subscription (admin operation)
  async cancelUserSubscription(customerId: string): Promise<void> {
    const subscriptions = await this.subscriptionService.listSubscriptionsByCustomer(customerId);
    
    for (const subscription of subscriptions) {
      if (subscription.status === 'active') {
        await this.subscriptionService.cancelSubscription(subscription.id);
      }
    }
  }
}
```

#### **Current Usage Locations:**
- `src/app/api/admin/users/grant-subscription/route.ts`
- `src/app/api/admin/users/cancel-subscription/route.ts`
- `src/app/api/admin/users/delete/route.ts`

---

## 📋 **Base Service Implementation**

### **Abstract Base Class**
```typescript
// src/services/stripe/base/base-stripe-service.ts
abstract class BaseStripeService {
  protected stripe: Stripe;
  
  constructor() {
    this.stripe = StripeClientService.getClient();
  }
  
  // Centralized error handling
  protected async handleStripeOperation<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      console.error(`❌ [STRIPE] ${operationName} failed:`, error);
      
      if (error instanceof Stripe.errors.StripeError) {
        throw new StripeServiceError(
          `Failed to ${operationName}`,
          error.type,
          error.code,
          error.message
        );
      }
      
      throw new StripeServiceError(`Failed to ${operationName}`, 'unknown', null, error.message);
    }
  }
  
  // Common validation
  protected validateCustomerId(customerId: string): void {
    if (!customerId || !customerId.startsWith('cus_')) {
      throw new ValidationError(`Invalid Stripe customer ID: ${customerId}`);
    }
  }
  
  protected validateSubscriptionId(subscriptionId: string): void {
    if (!subscriptionId || !subscriptionId.startsWith('sub_')) {
      throw new ValidationError(`Invalid Stripe subscription ID: ${subscriptionId}`);
    }
  }
}
```

### **Error Handling Classes**
```typescript
// src/services/stripe/base/errors.ts
export class StripeServiceError extends Error {
  constructor(
    message: string,
    public stripeErrorType?: string,
    public stripeErrorCode?: string,
    public originalMessage?: string
  ) {
    super(message);
    this.name = 'StripeServiceError';
  }
}

export class StripeConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StripeConfigError';
  }
}

export class WebhookVerificationError extends Error {
  constructor(message: string, public originalError?: any) {
    super(message);
    this.name = 'WebhookVerificationError';
  }
}
```

---

## 🚀 **Implementation Strategy**

### **Phase 1: Core Infrastructure (Week 1)**
1. **Setup Stripe client singleton**
   - Create `StripeClientService` with singleton pattern
   - Replace all 19+ `new Stripe()` instantiations
   - Add configuration validation

2. **Implement BaseStripeService**
   - Create abstract base class with error handling
   - Define common validation methods
   - Setup logging and monitoring

3. **CustomerService Implementation**
   - Highest usage priority (8+ routes)
   - Start with `findCustomerByEmail` method
   - Migrate customer-related operations

### **Phase 2: Subscription Management (Week 2)**
1. **SubscriptionService Implementation**
   - Most complex service with 15+ routes
   - Implement CRUD operations
   - Add specialized methods (toggle auto-renew, etc.)

2. **CouponService Implementation**
   - Support promotional operations
   - Admin coupon management

### **Phase 3: Specialized Services (Week 3)**
1. **WebhookService Implementation**
   - Centralize webhook event processing
   - Improve error handling and logging

2. **AdminService Implementation**
   - Admin-specific operations
   - Complex subscription granting flows

3. **ProductService, PaymentService, InvoiceService**
   - Lower priority services
   - Complete remaining operations

### **Phase 4: Integration & Testing (Week 4)**
1. **Full API route migration**
2. **Comprehensive error handling testing**
3. **Performance optimization**
4. **Documentation and examples**

---

## 📊 **Expected Benefits**

### **Code Reduction**
- **Eliminate 19+ Stripe client instantiations** - Single singleton instance
- **Reduce API route complexity** by 50-70% for Stripe-heavy routes  
- **Standardize error handling** across all Stripe operations
- **Remove ~400 lines** of duplicate Stripe operation code

### **Reliability Improvements**
- **Consistent error handling** for all Stripe API failures
- **Proper retry logic** for transient failures
- **Centralized rate limiting** and request management
- **Type safety** with comprehensive TypeScript interfaces

### **Maintainability**
- **Single source of truth** for Stripe operations
- **Easier testing** with mockable service layer
- **Consistent logging** for all Stripe interactions
- **Version pinning** for API stability

### **Developer Experience**
- **Faster development** of new Stripe features
- **Reduced cognitive load** for understanding Stripe flows
- **Consistent patterns** across all payment operations
- **Better debugging** with centralized error handling

---

## ⚠️ **Migration Considerations**

### **Backward Compatibility**
- Implement services alongside existing code initially
- Gradual migration route by route
- Maintain existing API behavior exactly
- No changes to webhook endpoint URLs

### **Error Handling**
- Preserve existing error response formats
- Add enhanced logging for debugging
- Implement proper error categorization
- Maintain existing timeout behaviors

### **Stripe API Version**
- Pin API version to prevent breaking changes
- Test webhook compatibility thoroughly
- Validate all existing operations work identically

### **Performance**
- Monitor Stripe API call counts during migration
- Implement caching where appropriate
- Add request deduplication for safety

---

## 🎯 **Success Metrics**

### **Quantitative Goals**
- **Reduce Stripe-related code by 60%** (from ~400 to ~160 lines)
- **Eliminate 19+ duplicate client instantiations**
- **Improve error handling coverage to 100%**
- **Reduce Stripe API call failures by 25%**

### **Quality Improvements**
- **Zero breaking changes** to existing API behavior
- **Standardized error responses** for all Stripe operations
- **Complete webhook event coverage**
- **Comprehensive TypeScript typing** for all operations

### **Developer Productivity**
- **50% faster development** of new payment features
- **Unified debugging** experience for all Stripe issues
- **Consistent testing patterns** across payment flows

---

**Implementation Plan Status:** Ready for development phase  
**Estimated Timeline:** 4 weeks for complete migration  
**Risk Level:** Low-Medium (payment system requires careful testing)

---

## 📝 **File-by-File Migration Checklist**

### **High Priority Routes (Week 1-2)**
- [ ] `src/app/api/subscription/stripe-direct/route.ts`
- [ ] `src/app/api/subscription/force-sync/route.ts`
- [ ] `src/app/api/auth/session-check/route.ts`
- [ ] `src/app/api/subscription/toggle-autorenew/route.ts`
- [ ] `src/app/api/subscription/cancel/route.ts`

### **Medium Priority Routes (Week 2-3)**
- [ ] `src/app/api/subscription/sync/route.ts`
- [ ] `src/app/api/subscription/details/route.ts`
- [ ] `src/app/api/subscription/create-coupon/route.ts`
- [ ] `src/app/api/admin/users/grant-subscription/route.ts`
- [ ] `src/app/api/webhooks/stripe/route.ts`

### **Lower Priority Routes (Week 3-4)**
- [ ] `src/app/api/invoices/route.ts`
- [ ] `src/app/api/verify-stripe-payment/route.ts`
- [ ] `src/app/api/subscription/verify-status/route.ts`
- [ ] `src/app/api/admin/users/cancel-subscription/route.ts`
- [ ] All remaining subscription routes

This plan provides a systematic approach to consolidating all Stripe operations into a robust, maintainable service layer that will significantly improve code quality and developer productivity. 