# Ticket 1.3: Authentication Middleware Implementation
**Priority:** HIGH | **Effort:** 3 days | **Risk:** Low

## Description
Create centralized authentication middleware to eliminate 1200+ lines of duplicate security boilerplate across 58 API routes, with integrated structured logging.

## Current Problem
Every API route repeats this pattern:
```typescript
// ✅ SECURITY: CSRF and Rate limiting (repeated 58 times)
const csrfValid = await strictCSRFValidation(request);
if (!csrfValid) {
  trackSuspiciousActivity(request, 'SOME_ACTION_CSRF_FAILED');
  return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
}

const rateLimitResult = await rateLimitGeneral()(request);
if (!rateLimitResult.success) {
  trackSuspiciousActivity(request, 'SOME_ACTION_RATE_LIMITED');
  return rateLimitResult.error;
}

const user = await currentUser();
if (!user) {
  return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
}
```

## Solution Implementation
```typescript
// src/middleware/auth-middleware.ts
import { apiLogger } from '@/lib/enhanced-logger';

export function withAuth(
  handler: (req: Request, context: AuthContext) => Promise<NextResponse>,
  options: AuthOptions = {}
) {
  return async (req: Request, params: any) => {
    try {
      // 1. CSRF validation
      if (options.requireCSRF !== false) {
        const csrfValid = await strictCSRFValidation(req);
        if (!csrfValid) {
          apiLogger.securityViolation('CSRF_VALIDATION_FAILED', req, { action: options.action });
          trackSuspiciousActivity(req, `${options.action || 'UNKNOWN'}_CSRF_FAILED`);
          return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
        }
      }

      // 2. Rate limiting
      if (options.rateLimit !== false) {
        const rateLimitResult = await rateLimitGeneral()(req);
        if (!rateLimitResult.success) {
          apiLogger.securityViolation('RATE_LIMIT_EXCEEDED', req, { action: options.action });
          trackSuspiciousActivity(req, `${options.action || 'UNKNOWN'}_RATE_LIMITED`);
          return rateLimitResult.error;
        }
      }

      // 3. Authentication
      const user = await currentUser();
      if (!user) {
        apiLogger.securityViolation('UNAUTHENTICATED_REQUEST', req, { action: options.action });
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
      }

      // 4. Admin check (if required)
      if (options.requireAdmin) {
        const profile = await getUserProfile(user.id);
        if (!profile?.isAdmin) {
          apiLogger.securityViolation('UNAUTHORIZED_ADMIN_ACCESS', req, { 
            action: options.action, 
            userId: user.id 
          });
          trackSuspiciousActivity(req, `${options.action || 'UNKNOWN'}_ADMIN_REQUIRED`);
          return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
        }
      }

      // 5. Build auth context
      const authContext: AuthContext = {
        user,
        userId: user.id,
        isAdmin: options.requireAdmin || false,
        params
      };

      return await handler(req, authContext);
    } catch (error) {
      apiLogger.databaseOperation('auth_middleware', false, { error: error.message, action: options.action });
      trackSuspiciousActivity(req, `${options.action || 'UNKNOWN'}_AUTH_ERROR`);
      return NextResponse.json({ error: 'Authentication failed' }, { status: 500 });
    }
  };
}

// Usage in API routes:
export const POST = withAuth(async (req, { user, userId }) => {
  // Handler logic here - user is guaranteed to exist
  const { content, channelId } = await req.json();
  // ... rest of handler
}, { 
  action: 'CREATE_MESSAGE',
  requireAdmin: true,
  requireCSRF: true 
});
```

## Acceptance Criteria
- [ ] Create `withAuth` higher-order function
- [ ] Support different auth levels (user, admin, public)
- [ ] Integrate CSRF validation, rate limiting, and suspicious activity tracking
- [ ] Provide clean `AuthContext` to route handlers
- [ ] Migrate 5 API routes as proof of concept
- [ ] Validate no breaking changes to existing API behavior

### Documentation Requirements
- [ ] Create authentication flow diagram showing middleware integration
- [ ] Document middleware usage patterns and configuration options in `docs/security/authentication-middleware.md`
- [ ] Add security architecture documentation with examples

### Testing Requirements
- [ ] **Unit Tests**: Middleware functions, CSRF validation, rate limiting logic
- [ ] **Integration Tests**: End-to-end authentication flows with various configurations
- [ ] **Security Tests**: Test authentication bypass attempts, token validation edge cases
- [ ] **Performance Tests**: Ensure middleware doesn't add significant latency to API calls

## Files to Create/Modify
- `src/middleware/auth-middleware.ts` (new)
- `src/types/auth.ts` (new) - AuthContext and AuthOptions types
- Test migrations on these routes first:
  - `src/app/api/messages/route.ts`
  - `src/app/api/channels/route.ts`
  - `src/app/api/servers/route.ts`
  - `src/app/api/subscription/cancel/route.ts`
  - `src/app/api/admin/users/route.ts`

## Dependencies
- Ticket 1.1 (Logger Consolidation)
- Ticket 1.4 (Base Service Architecture) for getUserProfile helper 