# Ticket 1.4: Base Service Architecture Setup
**Priority:** MEDIUM | **Effort:** 2 days | **Risk:** Low

## Description
Create foundational service architecture with base classes, error handling, and common utilities that all subsequent service implementations will inherit from.

## Implementation
```typescript
// src/services/base/base-service.ts
import { apiLogger } from '@/lib/enhanced-logger';

export abstract class BaseService {
  protected prisma: PrismaClient;
  
  constructor(prisma?: PrismaClient) {
    this.prisma = prisma || db;
  }
  
  // Common error handling with structured logging
  protected handleError(error: unknown, operation: string, context?: any): never {
    apiLogger.databaseOperation(operation, false, {
      service: this.constructor.name,
      error: error instanceof Error ? error.message : String(error),
      context,
      stack: error instanceof Error ? error.stack : undefined
    });
    
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(`Failed to ${operation}: ${error.message}`, error.code);
    }
    
    throw new ServiceError(`Failed to ${operation}`, error);
  }
  
  // Common validation
  protected validateId(id: string, fieldName: string): void {
    if (!id || typeof id !== 'string') {
      throw new ValidationError(`Invalid ${fieldName}: ${id}`);
    }
    
    // CUID validation
    if (!/^c[a-z0-9]{24}$/.test(id)) {
      throw new ValidationError(`Invalid ${fieldName} format: ${id}`);
    }
  }
  
  // Pagination helper
  protected buildPaginationOptions(cursor?: string, limit: number = 10) {
    return {
      take: Math.min(limit, 100), // Max 100 items
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
    };
  }
  
  // Transaction wrapper
  protected async executeTransaction<T>(
    operation: (tx: PrismaTransaction) => Promise<T>
  ): Promise<T> {
    return await this.prisma.$transaction(operation);
  }
}

// src/services/base/errors.ts
export class ServiceError extends Error {
  constructor(message: string, public originalError?: any) {
    super(message);
    this.name = 'ServiceError';
  }
}

export class DatabaseError extends ServiceError {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class ValidationError extends ServiceError {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// src/services/base/types.ts
export interface PaginationOptions {
  cursor?: string;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  nextCursor?: string;
  hasMore: boolean;
}

export type PrismaTransaction = Parameters<Parameters<typeof db.$transaction>[0]>[0];
```

## Acceptance Criteria
- [ ] Create BaseService abstract class with common methods
- [ ] Implement error handling hierarchy (ServiceError, DatabaseError, ValidationError)
- [ ] Add validation utilities (CUID validation, etc.)
- [ ] Create pagination and transaction helpers
- [ ] Define TypeScript interfaces for common patterns
- [ ] Add comprehensive JSDoc documentation

### Documentation Requirements
- [ ] Create service architecture diagram showing inheritance hierarchy
- [ ] Document service patterns and usage guidelines in `docs/developers/service-patterns.md`
- [ ] Add transaction management documentation with examples

### Testing Requirements
- [ ] **Unit Tests**: BaseService methods, error handling, transaction management
- [ ] **Integration Tests**: Database operations through base service
- [ ] **Error Scenario Tests**: Verify error hierarchy and handling works correctly
- [ ] **Transaction Tests**: Test rollback scenarios and data consistency

## Files to Create
- `src/services/base/base-service.ts`
- `src/services/base/errors.ts`
- `src/services/base/types.ts`
- `src/services/index.ts` (main export file)

## Dependencies
- Ticket 1.1 (Logger Consolidation) 