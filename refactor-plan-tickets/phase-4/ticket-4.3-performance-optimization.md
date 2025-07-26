# Ticket 4.3: Performance Optimization & Monitoring
**Priority:** MEDIUM | **Effort:** 2 days | **Risk:** LOW

## Description
Implement performance optimizations, caching strategies, and monitoring to ensure the refactored codebase performs better than the original.

## Implementation

### Database Query Optimization
```typescript
// src/services/database/performance/query-optimizer.ts
export class QueryOptimizer {
  private static cache = new Map<string, { data: any; timestamp: number; ttl: number }>();
  
  // Cached query wrapper
  static async cachedQuery<T>(
    key: string,
    queryFn: () => Promise<T>,
    ttlSeconds: number = 300
  ): Promise<T> {
    const now = Date.now();
    const cached = this.cache.get(key);
    
    if (cached && now < cached.timestamp + (cached.ttl * 1000)) {
      return cached.data;
    }
    
    const data = await queryFn();
    this.cache.set(key, { data, timestamp: now, ttl: ttlSeconds });
    
    return data;
  }
  
  // Clear cache
  static clearCache(pattern?: string): void {
    if (pattern) {
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }
  
  // Query performance monitoring
  static async monitorQuery<T>(
    operation: string,
    queryFn: () => Promise<T>
  ): Promise<T> {
    const startTime = performance.now();
    
    try {
      const result = await queryFn();
      const duration = performance.now() - startTime;
      
      if (duration > 1000) { // Log slow queries
        console.warn(`🐌 Slow query detected: ${operation} took ${duration.toFixed(2)}ms`);
      }
      
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      console.error(`❌ Query failed: ${operation} after ${duration.toFixed(2)}ms`, error);
      throw error;
    }
  }
}

// Usage in services:
async findByUserIdOrEmail(userIdOrEmail: string): Promise<User | null> {
  return await QueryOptimizer.monitorQuery(
    'findUserByIdOrEmail',
    () => QueryOptimizer.cachedQuery(
      `user:${userIdOrEmail}`,
      () => this.prisma.user.findFirst({
        where: {
          OR: [
            { userId: userIdOrEmail },
            { email: userIdOrEmail },
          ],
        },
      }),
      300 // 5 minute cache
    )
  );
}
```

### API Response Caching
```typescript
// src/lib/cache/api-cache.ts
export class APICache {
  private static redis: Redis | null = null;
  private static memoryCache = new Map<string, { data: any; expires: number }>();
  
  static async get<T>(key: string): Promise<T | null> {
    try {
      // Try Redis first if available
      if (this.redis) {
        const cached = await this.redis.get(key);
        return cached ? JSON.parse(cached) : null;
      }
      
      // Fallback to memory cache
      const memoryCached = this.memoryCache.get(key);
      if (memoryCached && Date.now() < memoryCached.expires) {
        return memoryCached.data;
      }
      
      return null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }
  
  static async set<T>(key: string, data: T, ttlSeconds: number = 300): Promise<void> {
    try {
      // Store in Redis if available
      if (this.redis) {
        await this.redis.setex(key, ttlSeconds, JSON.stringify(data));
      }
      
      // Always store in memory cache as backup
      this.memoryCache.set(key, {
        data,
        expires: Date.now() + (ttlSeconds * 1000)
      });
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }
  
  static async invalidate(pattern: string): Promise<void> {
    try {
      // Clear from Redis
      if (this.redis) {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      }
      
      // Clear from memory cache
      for (const key of this.memoryCache.keys()) {
        if (key.includes(pattern)) {
          this.memoryCache.delete(key);
        }
      }
    } catch (error) {
      console.error('Cache invalidation error:', error);
    }
  }
}

// Caching middleware for API routes
export function withCache(
  handler: (req: Request, context: any) => Promise<NextResponse>,
  ttlSeconds: number = 300
) {
  return async (req: Request, context: any) => {
    const cacheKey = `api:${req.url}:${req.method}`;
    
    // Try cache first for GET requests
    if (req.method === 'GET') {
      const cached = await APICache.get(cacheKey);
      if (cached) {
        return NextResponse.json(cached, {
          headers: { 'X-Cache': 'HIT' }
        });
      }
    }
    
    const response = await handler(req, context);
    
    // Cache successful GET responses
    if (req.method === 'GET' && response.status === 200) {
      const data = await response.json();
      await APICache.set(cacheKey, data, ttlSeconds);
    }
    
    return response;
  };
}
```

### Performance Monitoring
```typescript
// src/lib/monitoring/performance-monitor.ts
export class PerformanceMonitor {
  private static metrics = new Map<string, number[]>();
  
  static recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    
    const values = this.metrics.get(name)!;
    values.push(value);
    
    // Keep only last 100 measurements
    if (values.length > 100) {
      values.shift();
    }
  }
  
  static getMetrics(name: string): PerformanceMetrics | null {
    const values = this.metrics.get(name);
    if (!values || values.length === 0) return null;
    
    const sorted = [...values].sort((a, b) => a - b);
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];
    
    return {
      count: values.length,
      average: avg,
      p50,
      p95,
      p99,
      min: sorted[0],
      max: sorted[sorted.length - 1]
    };
  }
  
  static getAllMetrics(): Record<string, PerformanceMetrics> {
    const allMetrics: Record<string, PerformanceMetrics> = {};
    
    for (const [name] of this.metrics.entries()) {
      const metrics = this.getMetrics(name);
      if (metrics) {
        allMetrics[name] = metrics;
      }
    }
    
    return allMetrics;
  }
}

// API route performance wrapper
export function withPerformanceMonitoring(
  handler: (req: Request, context: any) => Promise<NextResponse>,
  operationName: string
) {
  return async (req: Request, context: any) => {
    const startTime = performance.now();
    
    try {
      const response = await handler(req, context);
      const duration = performance.now() - startTime;
      
      PerformanceMonitor.recordMetric(`api.${operationName}.duration`, duration);
      PerformanceMonitor.recordMetric(`api.${operationName}.success`, 1);
      
      return response;
    } catch (error) {
      const duration = performance.now() - startTime;
      
      PerformanceMonitor.recordMetric(`api.${operationName}.duration`, duration);
      PerformanceMonitor.recordMetric(`api.${operationName}.error`, 1);
      
      throw error;
    }
  };
}

interface PerformanceMetrics {
  count: number;
  average: number;
  p50: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
}
```

### Bundle Size Optimization
```typescript
// scripts/analyze-bundle-size.ts
import { analyzeMetafile } from 'esbuild';
import { promises as fs } from 'fs';

export async function analyzeBundleSize() {
  const metafile = await fs.readFile('.next/analyze/bundlemetafile.json', 'utf-8');
  const analysis = await analyzeMetafile(JSON.parse(metafile));
  
  console.log('📦 Bundle Analysis:', analysis);
  
  // Check for large dependencies
  const largeDependencies = analysis.inputs
    .filter(input => input.bytes > 100000) // > 100KB
    .sort((a, b) => b.bytes - a.bytes);
  
  if (largeDependencies.length > 0) {
    console.log('🚨 Large dependencies found:');
    largeDependencies.forEach(dep => {
      console.log(`  ${dep.path}: ${(dep.bytes / 1024).toFixed(1)}KB`);
    });
  }
  
  return analysis;
}
```

## Acceptance Criteria
- [ ] Implement query caching with Redis/memory fallback
- [ ] Add performance monitoring for all API routes
- [ ] Create bundle size analysis and optimization
- [ ] Achieve 20%+ improvement in API response times
- [ ] Reduce bundle size by 15%+ compared to pre-refactor
- [ ] Monitor and alert on slow queries (>1s)
- [ ] Cache frequently accessed data (user profiles, server lists)

## Files to Create/Modify
- `src/services/database/performance/query-optimizer.ts` (new)
- `src/lib/cache/api-cache.ts` (new)
- `src/lib/monitoring/performance-monitor.ts` (new)
- `scripts/analyze-bundle-size.ts` (new)
- Update service methods to use caching and monitoring

### Documentation Requirements
- [ ] Create performance monitoring architecture diagram
- [ ] Document caching strategies and optimization patterns in `docs/performance/optimization.md`
- [ ] Add performance troubleshooting guide

### Testing Requirements
- [ ] **Performance Tests**: API response times under various load conditions
- [ ] **Load Tests**: Database query performance with large datasets
- [ ] **Caching Tests**: Cache hit/miss ratios and invalidation strategies
- [ ] **Monitoring Tests**: Verify performance metrics collection works correctly
- [ ] **Stress Tests**: System behavior under high concurrent usage

## Dependencies
- All previous service implementations 