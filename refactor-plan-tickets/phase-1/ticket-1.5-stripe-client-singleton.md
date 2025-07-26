# Ticket 1.5: Stripe Client Singleton Implementation
**Priority:** HIGH | **Effort:** 1 day | **Risk:** Low

## Description
Create centralized Stripe client management to eliminate 19+ duplicate Stripe instantiations across API routes and provide configuration validation with structured logging.

## Current Problem
Every Stripe-using file repeats:
```typescript
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
```
Found in 19+ files including subscription routes, admin routes, and webhook handlers.

## Solution Implementation
```typescript
// src/services/stripe/base/stripe-client.ts
export class StripeClientService {
  private static instance: Stripe | null = null;
  
  static getClient(): Stripe {
    if (!this.instance) {
      this.validateConfig();
      this.instance = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: '2023-10-16', // Pin API version for consistency
        typescript: true,
        telemetry: false, // Disable telemetry for performance
      });
    }
    return this.instance;
  }
  
  // Environment validation
  static validateConfig(): void {
    const required = [
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'STRIPE_PUBLISHABLE_KEY'
    ];
    
    const missing = required.filter(key => !process.env[key]);
    if (missing.length > 0) {
      throw new StripeConfigError(`Missing Stripe configuration: ${missing.join(', ')}`);
    }
  }
  
  // Reset instance (useful for testing)
  static resetInstance(): void {
    this.instance = null;
  }
}

// src/services/stripe/base/base-stripe-service.ts
export abstract class BaseStripeService {
  protected stripe: Stripe;
  
  constructor() {
    this.stripe = StripeClientService.getClient();
  }
  
  // Centralized error handling for Stripe operations with structured logging
  protected async handleStripeOperation<T>(
    operation: () => Promise<T>,
    operationName: string,
    context?: any
  ): Promise<T> {
    try {
      const result = await operation();
      apiLogger.databaseOperation(`stripe_${operationName}`, true, { context });
      return result;
    } catch (error) {
      apiLogger.databaseOperation(`stripe_${operationName}`, false, {
        error: error instanceof Error ? error.message : String(error),
        context,
        stripeError: error instanceof Stripe.errors.StripeError ? {
          type: error.type,
          code: error.code,
          param: error.param
        } : undefined
      });
      
      if (error instanceof Stripe.errors.StripeError) {
        throw new StripeServiceError(
          `Failed to ${operationName}`,
          error.type,
          error.code,
          error.message
        );
      }
      
      throw new StripeServiceError(`Failed to ${operationName}`, 'unknown', null, error?.message);
    }
  }
  
  // Common validation methods
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
```

## Acceptance Criteria
- [ ] Create StripeClientService singleton
- [ ] Implement BaseStripeService with common error handling
- [ ] Add Stripe-specific validation methods
- [ ] Pin Stripe API version for consistency
- [ ] Replace Stripe instantiations in 3-5 routes as proof of concept
- [ ] Validate no changes to existing Stripe behavior

### Documentation Requirements
- [ ] Create Stripe integration architecture diagram
- [ ] Document Stripe service patterns and error handling in `docs/integrations/stripe-architecture.md`
- [ ] Add configuration guide for Stripe environments

### Testing Requirements
- [ ] **Unit Tests**: Singleton pattern, configuration validation, error handling
- [ ] **Integration Tests**: Stripe API connectivity and basic operations
- [ ] **Mock Tests**: Test Stripe operations without hitting actual API
- [ ] **Configuration Tests**: Verify environment switching and validation works correctly

## Files to Create/Modify
- `src/services/stripe/base/stripe-client.ts` (new)
- `src/services/stripe/base/base-stripe-service.ts` (new)
- `src/services/stripe/base/errors.ts` (new)
- Migrate these routes first:
  - `src/app/api/subscription/force-sync/route.ts`
  - `src/app/api/auth/session-check/route.ts`
  - `src/app/api/webhooks/stripe/route.ts`

## Dependencies
- Ticket 1.1 (Logger Consolidation) 