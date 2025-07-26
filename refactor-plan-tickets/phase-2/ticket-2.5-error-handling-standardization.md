# Ticket 2.5: Error Handling Standardization
**Priority:** MEDIUM | **Effort:** 2 days | **Risk:** Low

## Description
Standardize error handling across all API routes by implementing centralized error response utilities and consistent logging patterns integrated with the structured logger.

## Current Problem
Every route has custom error handling with inconsistent logging:
```typescript
} catch (error) {
  console.error('❌ [SOME_ACTION] Error:', error);
  return NextResponse.json(
    { error: 'Internal server error' },
    { status: 500 }
  );
}
```

## Implementation
```typescript
// src/lib/error-handling.ts
import { apiLogger } from '@/lib/enhanced-logger';

export class APIError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export class ValidationError extends APIError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class AuthenticationError extends APIError {
  constructor(message: string = 'Not authenticated') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends APIError {
  constructor(message: string = 'Access denied') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends APIError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

// Error response utility with integrated logging
export function createErrorResponse(error: unknown, operation?: string): NextResponse {
  // Use structured logger instead of console.error
  apiLogger.databaseOperation(operation || 'unknown_operation', false, {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    timestamp: new Date().toISOString(),
  });

  // Handle known error types
  if (error instanceof APIError) {
    return NextResponse.json(
      { 
        error: error.message,
        code: error.code,
        details: error.details 
      },
      { status: error.statusCode }
    );
  }

  // Handle Zod validation errors
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { 
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: error.errors 
      },
      { status: 400 }
    );
  }

  // Handle Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    let message = 'Database error';
    let statusCode = 500;

    switch (error.code) {
      case 'P2002':
        message = 'Resource already exists';
        statusCode = 409;
        break;
      case 'P2025':
        message = 'Resource not found';
        statusCode = 404;
        break;
    }

    return NextResponse.json(
      { error: message, code: error.code },
      { status: statusCode }
    );
  }

  // Generic server error
  return NextResponse.json(
    { error: 'Internal server error', code: 'INTERNAL_ERROR' },
    { status: 500 }
  );
}

// Higher-order function for error handling
export function withErrorHandling<T extends any[], R>(
  handler: (...args: T) => Promise<NextResponse | R>,
  operation?: string
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      const result = await handler(...args);
      return result instanceof NextResponse ? result : NextResponse.json(result);
    } catch (error) {
      return createErrorResponse(error, operation);
    }
  };
}

// Usage in API routes:
export const POST = withAuth(
  withErrorHandling(async (req, { user, userId }) => {
    // Handler logic that can throw APIError instances
    if (!userId) {
      throw new AuthenticationError();
    }

    const data = await req.json();
    // ... business logic

    return { success: true, data };
  }, 'create_message'),
  { action: 'CREATE_MESSAGE', requireAdmin: true }
);
```

## Error Types and Usage
```typescript
// Validation errors
throw new ValidationError('Email is required');
throw new ValidationError('Invalid input', { field: 'email', value: 'invalid' });

// Authentication errors
throw new AuthenticationError();
throw new AuthenticationError('Session expired');

// Authorization errors
throw new AuthorizationError();
throw new AuthorizationError('Admin access required');

// Not found errors
throw new NotFoundError('User');
throw new NotFoundError('Channel');

// Generic API errors
throw new APIError('Custom error message', 422, 'CUSTOM_ERROR');
```

## Migration Example
```typescript
// Before - inconsistent error handling
export async function POST(req: Request) {
  try {
    const { channelId } = await req.json();
    
    const channel = await db.channel.findUnique({
      where: { id: channelId }
    });
    
    if (!channel) {
      return NextResponse.json(
        { error: 'Channel not found' },
        { status: 404 }
      );
    }
    
    // ... business logic
    
  } catch (error) {
    console.error('❌ Error:', error);
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    );
  }
}

// After - standardized error handling
export const POST = withAuth(
  withErrorHandling(async (req, { userId }) => {
    const { channelId } = await req.json();
    
    const channelService = new ChannelService();
    const channel = await channelService.findById(channelId);
    
    if (!channel) {
      throw new NotFoundError('Channel');
    }
    
    // ... business logic
    
    return { success: true };
  }, 'update_channel'),
  { action: 'UPDATE_CHANNEL', requireAdmin: true }
);
```

## Acceptance Criteria
- [ ] Create centralized error handling utilities
- [ ] Define common error types (ValidationError, AuthenticationError, etc.)
- [ ] Implement consistent error response format
- [ ] Add `withErrorHandling` higher-order function
- [ ] Migrate 20 API routes to use standardized error handling
- [ ] Ensure all error responses follow same structure

## Error Response Format
```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE",
  "details": {
    // Optional additional details
  }
}
```

## Files to Create/Modify
- `src/lib/error-handling.ts` (new)
- Update `src/middleware/auth-middleware.ts` to use new error types
- Migrate routes that were updated with auth middleware

### Documentation Requirements
- [ ] Create error handling architecture diagram
- [ ] Document error types and status codes in `docs/api/error-handling.md`
- [ ] Add troubleshooting guide for common API errors

### Testing Requirements
- [ ] **Unit Tests**: Error handling functions and error type classification
- [ ] **Integration Tests**: Error scenarios across all API endpoints
- [ ] **Error Response Tests**: Verify consistent error format and appropriate status codes
- [ ] **Security Tests**: Ensure no sensitive information is leaked in error messages
- [ ] **Client Error Handling Tests**: Test how frontend handles standardized errors

## Dependencies
- Ticket 2.4 (Authentication Middleware Migration)
- Ticket 1.1 (Logger Consolidation) 