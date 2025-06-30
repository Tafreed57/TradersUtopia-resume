// Subscription caching system to prevent duplicate API calls
interface SubscriptionCache {
  hasAccess: boolean;
  productId?: string;
  reason: string;
  subscriptionEnd?: string;
  timestamp: number;
}

// In-memory cache (consider using sessionStorage/localStorage for persistence)
const subscriptionCache = new Map<string, SubscriptionCache>();

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function getCacheKey(
  userId: string | undefined,
  allowedProductIds: string[]
): string {
  return `${userId || 'anonymous'}-${allowedProductIds.sort().join(',')}`;
}

export function getCachedSubscription(
  userId: string | undefined,
  allowedProductIds: string[]
): SubscriptionCache | null {
  const key = getCacheKey(userId, allowedProductIds);
  const cached = subscriptionCache.get(key);

  if (!cached) return null;

  // Check if cache is still valid
  if (Date.now() - cached.timestamp > CACHE_DURATION) {
    subscriptionCache.delete(key);
    return null;
  }

  return cached;
}

export function setCachedSubscription(
  userId: string | undefined,
  allowedProductIds: string[],
  result: Omit<SubscriptionCache, 'timestamp'>
): void {
  const key = getCacheKey(userId, allowedProductIds);
  subscriptionCache.set(key, {
    ...result,
    timestamp: Date.now(),
  });
}

export function clearSubscriptionCache(userId?: string): void {
  if (userId) {
    // Clear all cache entries for this user
    subscriptionCache.forEach((_, key) => {
      if (key.startsWith(userId)) {
        subscriptionCache.delete(key);
      }
    });
  } else {
    // Clear all cache
    subscriptionCache.clear();
  }
}

export function getSubscriptionCacheStats() {
  return {
    totalEntries: subscriptionCache.size,
    entries: Array.from(subscriptionCache.entries()).map(([key, value]) => ({
      key,
      age: Date.now() - value.timestamp,
      hasAccess: value.hasAccess,
    })),
  };
}
