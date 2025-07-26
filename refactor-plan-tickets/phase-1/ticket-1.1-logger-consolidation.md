# Ticket 1.1: Logger Consolidation & Standardization
**Priority:** HIGH | **Effort:** 2 days | **Risk:** Low

## Description
Consolidate 200+ console.log statements across the codebase into the existing structured logger system. This is critical for production observability and security monitoring.

## Current Problem
The codebase has inconsistent logging patterns:
- 58+ API routes using manual console.log/error/warn
- Webhook handlers with scattered console logging
- Frontend components with unstructured error logging
- Security events not properly categorized
- No centralized logging configuration

## Existing Logger System
The codebase already has a well-designed logger at `src/lib/logger.ts` with:
- Environment-based conditional logging
- Security, webhook, admin, and debug categorization
- Production-ready configuration
- Legacy support patterns

## Implementation Strategy
Replace console.* calls systematically:

```typescript
// Before (repeated 200+ times):
console.log('❌ Error:', error);
console.warn('🚨 Security threat detected');
console.error('Database operation failed');

// After (using existing logger):
import { logger } from '@/lib/logger';

logger.error('Database operation failed', { operation: 'findUser', error });
logger.security('Security threat detected', { threatType: 'CSRF', request });
logger.webhook('Stripe webhook processed', { eventType, subscriptionId });
```

## Priority Replacement Areas
1. **API Routes Security Logging** (40+ instances)
   - Rate limiting violations
   - Authentication failures  
   - Suspicious activity tracking
   
2. **Webhook Event Logging** (25+ instances)
   - Stripe webhook events
   - Clerk webhook events
   - Payment processing

3. **Database Operation Logging** (30+ instances)
   - Transaction failures
   - Connection issues
   - Query performance

4. **Frontend Error Logging** (50+ instances)
   - Component errors
   - API call failures
   - User interaction failures

## Acceptance Criteria
- [ ] Replace all console.* in API routes with structured logger
- [ ] Update webhook handlers to use logger.webhook()
- [ ] Implement logger.security() for all security events
- [ ] Add proper error context (operation name, relevant IDs)
- [ ] Ensure no console.* remains except in development utilities
- [ ] Validate logger works correctly in both local and production environments

## Files to Update (First Batch)
```typescript
// API Routes - Security & Auth
src/app/api/auth/session-check/route.ts
src/app/api/admin/grant-access/route.ts
src/app/api/admin/revoke-access/route.ts
src/app/api/messages/route.ts

// Webhooks
src/webhooks/stripe/checkout.session.completed.ts
src/webhooks/stripe/customer.subscription.deleted.ts
src/webhooks/clerk/user.created.ts
src/app/api/webhooks/stripe/route.ts
src/app/api/webhooks/clerk/route.ts

// High-impact components
src/components/notifications/notification-settings.tsx
src/components/subscription/subscription-manager.tsx
```

## Implementation Pattern
```typescript
// src/lib/enhanced-logger.ts (new utility)
import { logger } from '@/lib/logger';

// Enhanced patterns for common operations
export const apiLogger = {
  securityViolation: (type: string, request: Request, details?: any) => {
    logger.security(`Security violation: ${type}`, {
      ip: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      timestamp: new Date().toISOString(),
      ...details
    });
  },
  
  webhookEvent: (service: string, eventType: string, details?: any) => {
    logger.webhook(`${service} webhook: ${eventType}`, {
      timestamp: new Date().toISOString(),
      ...details
    });
  },
  
  databaseOperation: (operation: string, success: boolean, details?: any) => {
    const logLevel = success ? 'info' : 'error';
    logger[logLevel](`Database ${operation}`, {
      success,
      timestamp: new Date().toISOString(),
      ...details
    });
  }
};
```

## Acceptance Criteria
- [ ] Replace all console.log statements with structured logger calls
- [ ] Implement enhanced logger with security, webhook, and database operation methods
- [ ] Add structured logging to critical operations (auth, payments, database)
- [ ] Ensure production/development environment configuration
- [ ] Validate log output format and structure
- [ ] Zero breaking changes to existing functionality

### Documentation Requirements
- [ ] Create logging architecture diagram showing log flow and categories
- [ ] Document logging standards and usage patterns in `docs/developers/logging-guide.md`
- [ ] Add code examples for each logger method type

### Testing Requirements
- [ ] **Unit Tests**: Logger functionality, log format validation, environment switching
- [ ] **Integration Tests**: Verify logs are written correctly in different scenarios
- [ ] **Test Coverage**: 95%+ coverage for logger module
- [ ] **Performance Tests**: Ensure logging doesn't impact API response times significantly

## Dependencies
None - foundational infrastructure 