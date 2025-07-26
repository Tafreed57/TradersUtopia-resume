# Ticket 1.6: Database Connection & Transaction Management  
**Priority:** MEDIUM | **Effort:** 1 day | **Risk:** Low

## Description
Improve database connection management and create transaction utilities for complex operations with integrated logging.

## Implementation
```typescript
// src/lib/database/connection.ts
import { PrismaClient } from '@prisma/client';
import { apiLogger } from '@/lib/enhanced-logger';

declare global {
  var __prisma: PrismaClient | undefined;
}

class DatabaseManager {
  private static instance: PrismaClient;
  
  static getInstance(): PrismaClient {
    if (!this.instance) {
      this.instance = globalThis.__prisma || new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
        errorFormat: 'pretty',
      });
      
      if (process.env.NODE_ENV === 'development') {
        globalThis.__prisma = this.instance;
      }
      
      apiLogger.databaseOperation('database_connection_initialized', true, {
        environment: process.env.NODE_ENV
      });
    }
    
    return this.instance;
  }
  
  static async disconnect(): Promise<void> {
    if (this.instance) {
      await this.instance.$disconnect();
    }
  }
  
  // Transaction utilities
  static async withTransaction<T>(
    operation: (prisma: PrismaClient) => Promise<T>
  ): Promise<T> {
    const prisma = this.getInstance();
    return await prisma.$transaction(operation);
  }
}

export const db = DatabaseManager.getInstance();
export { DatabaseManager };

// src/lib/database/helpers.ts
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }
  
  throw lastError!;
}
```

## Acceptance Criteria
- [ ] Create DatabaseManager singleton for connection management
- [ ] Add transaction utilities and helpers
- [ ] Implement retry logic for transient failures
- [ ] Add proper logging for development vs production
- [ ] Update existing db imports to use new manager

### Documentation Requirements
- [ ] Create database connection architecture diagram
- [ ] Document connection management patterns in `docs/database/connection-management.md`
- [ ] Add troubleshooting guide for database connectivity issues

### Testing Requirements
- [ ] **Unit Tests**: Connection pooling, retry logic, health monitoring
- [ ] **Integration Tests**: Database operations under various connection states
- [ ] **Load Tests**: Connection pool performance under high concurrency
- [ ] **Failure Tests**: Test retry logic and graceful degradation scenarios

## Files to Create/Modify
- `src/lib/database/connection.ts` (new)
- `src/lib/database/helpers.ts` (new)
- Update `src/lib/db.ts` to use new DatabaseManager

## Dependencies
None - foundational infrastructure 