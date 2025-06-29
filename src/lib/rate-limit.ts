import { NextRequest, NextResponse } from 'next/server';

// ==============================================
// 🛡️ RATE LIMITING SYSTEM
// ==============================================

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  keyGenerator?: (request: NextRequest) => string;
}

interface RateLimitStore {
  count: number;
  resetTime: number;
  firstRequest: number;
}

// In-memory store (use Redis in production for multi-instance deployments)
const rateLimitStore = new Map<string, RateLimitStore>();

// ==============================================
// 🚨 RATE LIMIT CONFIGURATIONS
// ==============================================

export const RATE_LIMITS = {
  // Admin operations - Very strict
  ADMIN_OPERATIONS: {
    maxRequests: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    message:
      'Too many admin operations. Please wait 15 minutes before trying again.',
  },

  // Password operations - Strict
  PASSWORD_OPERATIONS: {
    maxRequests: 3,
    windowMs: 60 * 60 * 1000, // 1 hour
    message:
      'Too many password change attempts. Please wait 1 hour before trying again.',
  },

  // 2FA operations - Moderate
  TWO_FACTOR_AUTH: {
    maxRequests: 10,
    windowMs: 15 * 60 * 1000, // 15 minutes
    message:
      'Too many 2FA attempts. Please wait 15 minutes before trying again.',
  },

  // File uploads - Moderate
  FILE_UPLOADS: {
    maxRequests: 20,
    windowMs: 60 * 60 * 1000, // 1 hour
    message: 'Too many file uploads. Please wait before uploading more files.',
  },

  // Subscription operations - Moderate
  SUBSCRIPTION_OPERATIONS: {
    maxRequests: 10,
    windowMs: 30 * 60 * 1000, // 30 minutes
    message:
      'Too many subscription operations. Please wait 30 minutes before trying again.',
  },

  // API calls - Generous but still limited
  GENERAL_API: {
    maxRequests: 100,
    windowMs: 15 * 60 * 1000, // 15 minutes
    message: 'Rate limit exceeded. Please slow down your requests.',
  },

  // Debug endpoints - Very strict (development only)
  DEBUG_ENDPOINTS: {
    maxRequests: 10,
    windowMs: 60 * 60 * 1000, // 1 hour
    message: 'Too many debug requests. Please wait 1 hour before trying again.',
  },

  // ✅ NEW: Server/Channel operations - Moderate
  SERVER_OPERATIONS: {
    maxRequests: 15,
    windowMs: 30 * 60 * 1000, // 30 minutes
    message:
      'Too many server operations. Please wait 30 minutes before trying again.',
  },

  // ✅ NEW: Messaging operations - Generous but limited
  MESSAGING_OPERATIONS: {
    maxRequests: 200,
    windowMs: 15 * 60 * 1000, // 15 minutes
    message: 'Too many messages sent. Please slow down for 15 minutes.',
  },

  // ✅ NEW: Authentication operations - Moderate
  AUTH_OPERATIONS: {
    maxRequests: 30,
    windowMs: 15 * 60 * 1000, // 15 minutes
    message: 'Too many authentication requests. Please wait 15 minutes.',
  },

  // ✅ NEW: Webhook operations - Very strict (external systems)
  WEBHOOK_OPERATIONS: {
    maxRequests: 1000,
    windowMs: 60 * 60 * 1000, // 1 hour
    message: 'Webhook rate limit exceeded. Please check your integration.',
  },

  // ✅ NEW: Notification operations - Moderate
  NOTIFICATION_OPERATIONS: {
    maxRequests: 50,
    windowMs: 15 * 60 * 1000, // 15 minutes
    message: 'Too many notification requests. Please wait 15 minutes.',
  },

  // ✅ NEW: Media/Token operations - Moderate
  MEDIA_OPERATIONS: {
    maxRequests: 25,
    windowMs: 15 * 60 * 1000, // 15 minutes
    message: 'Too many media/token requests. Please wait 15 minutes.',
  },
} as const;

// ==============================================
// 🔧 RATE LIMITING FUNCTIONS
// ==============================================

// Clean up expired entries periodically
const cleanupExpiredEntries = () => {
  const now = Date.now();
  for (const [key, store] of Array.from(rateLimitStore.entries())) {
    if (now > store.resetTime) {
      rateLimitStore.delete(key);
    }
  }
};

// Run cleanup every 5 minutes
setInterval(cleanupExpiredEntries, 5 * 60 * 1000);

// Generate rate limit key from request
const generateKey = (request: NextRequest, prefix: string): string => {
  // Try to get user ID from various sources
  const authHeader = request.headers.get('authorization');
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const remoteAddr = forwarded || realIp || 'unknown';

  // Prefer authenticated user identification over IP
  if (authHeader) {
    // In a real implementation, you'd extract the user ID from the JWT/session
    // For now, we'll use a hash of the auth header
    const userHash = Buffer.from(authHeader).toString('base64').slice(0, 16);
    return `${prefix}:user:${userHash}`;
  }

  // Fallback to IP-based rate limiting
  return `${prefix}:ip:${remoteAddr}:${userAgent.slice(0, 50)}`;
};

// Main rate limiting function
export const rateLimit = (
  config: RateLimitConfig,
  prefix: string = 'default'
) => {
  return async (
    request: NextRequest
  ): Promise<{ success: true } | { success: false; error: NextResponse }> => {
    const key = config.keyGenerator
      ? config.keyGenerator(request)
      : generateKey(request, prefix);
    const now = Date.now();

    // Get or create store entry
    let store = rateLimitStore.get(key);

    if (!store || now > store.resetTime) {
      // Create new window
      store = {
        count: 1,
        resetTime: now + config.windowMs,
        firstRequest: now,
      };
      rateLimitStore.set(key, store);
      return { success: true };
    }

    // Check if limit exceeded
    if (store.count >= config.maxRequests) {
      const retryAfter = Math.ceil((store.resetTime - now) / 1000);

      // Log rate limit violation for security monitoring
      console.warn(
        `⚠️ [RATE LIMIT] ${prefix} - Key: ${key.slice(0, 20)}... - Limit exceeded`
      );

      return {
        success: false,
        error: NextResponse.json(
          {
            error: 'Rate limit exceeded',
            message:
              config.message || 'Too many requests. Please try again later.',
            retryAfter: retryAfter,
            limit: config.maxRequests,
            windowMs: config.windowMs,
          },
          {
            status: 429,
            headers: {
              'Retry-After': retryAfter.toString(),
              'X-RateLimit-Limit': config.maxRequests.toString(),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset': new Date(store.resetTime).toISOString(),
            },
          }
        ),
      };
    }

    // Increment counter
    store.count++;
    rateLimitStore.set(key, store);

    return { success: true };
  };
};

// ==============================================
// 🎯 SPECIFIC RATE LIMITERS
// ==============================================

export const rateLimitAdmin = () =>
  rateLimit(RATE_LIMITS.ADMIN_OPERATIONS, 'admin');
export const rateLimitPassword = () =>
  rateLimit(RATE_LIMITS.PASSWORD_OPERATIONS, 'password');
export const rateLimit2FA = () => rateLimit(RATE_LIMITS.TWO_FACTOR_AUTH, '2fa');
export const rateLimitUpload = () =>
  rateLimit(RATE_LIMITS.FILE_UPLOADS, 'upload');
export const rateLimitSubscription = () =>
  rateLimit(RATE_LIMITS.SUBSCRIPTION_OPERATIONS, 'subscription');
export const rateLimitGeneral = () =>
  rateLimit(RATE_LIMITS.GENERAL_API, 'general');
export const rateLimitDebug = () =>
  rateLimit(RATE_LIMITS.DEBUG_ENDPOINTS, 'debug');

// ✅ NEW: Additional rate limiters for comprehensive protection
export const rateLimitServer = () =>
  rateLimit(RATE_LIMITS.SERVER_OPERATIONS, 'server');
export const rateLimitMessaging = () =>
  rateLimit(RATE_LIMITS.MESSAGING_OPERATIONS, 'messaging');
export const rateLimitAuth = () =>
  rateLimit(RATE_LIMITS.AUTH_OPERATIONS, 'auth');
export const rateLimitWebhook = () =>
  rateLimit(RATE_LIMITS.WEBHOOK_OPERATIONS, 'webhook');
export const rateLimitNotification = () =>
  rateLimit(RATE_LIMITS.NOTIFICATION_OPERATIONS, 'notification');
export const rateLimitMedia = () =>
  rateLimit(RATE_LIMITS.MEDIA_OPERATIONS, 'media');

// ==============================================
// 🛡️ SECURITY MONITORING
// ==============================================

// Track suspicious activity
const suspiciousActivity = new Map<
  string,
  { count: number; lastSeen: number }
>();

export const trackSuspiciousActivity = (
  request: NextRequest,
  reason: string
) => {
  const key = generateKey(request, 'suspicious');
  const now = Date.now();

  let activity = suspiciousActivity.get(key);
  if (!activity || now - activity.lastSeen > 24 * 60 * 60 * 1000) {
    // 24 hours
    activity = { count: 0, lastSeen: now };
  }

  activity.count++;
  activity.lastSeen = now;
  suspiciousActivity.set(key, activity);

  // Log high-risk activity
  if (activity.count > 5) {
    console.error(
      `🚨 [SECURITY ALERT] High suspicious activity from ${key.slice(0, 30)}... - Reason: ${reason} - Count: ${activity.count}`
    );
  }

  return activity.count;
};

// Get rate limit info for monitoring
export const getRateLimitInfo = (request: NextRequest, prefix: string) => {
  const key = generateKey(request, prefix);
  const store = rateLimitStore.get(key);

  if (!store) {
    return {
      limit: 0,
      remaining: 0,
      reset: null,
      total: 0,
    };
  }

  const remaining = Math.max(
    0,
    RATE_LIMITS.GENERAL_API.maxRequests - store.count
  );

  return {
    limit: RATE_LIMITS.GENERAL_API.maxRequests,
    remaining,
    reset: new Date(store.resetTime),
    total: store.count,
  };
};

// ==============================================
// 🧪 RATE LIMIT TESTING UTILITIES
// ==============================================

export const clearRateLimit = (request: NextRequest, prefix: string) => {
  if (process.env.NODE_ENV !== 'development') {
    console.warn('⚠️ Rate limit clearing is only available in development');
    return false;
  }

  const key = generateKey(request, prefix);
  return rateLimitStore.delete(key);
};

export const getRateLimitStats = () => {
  if (process.env.NODE_ENV !== 'development') {
    return { error: 'Stats only available in development' };
  }

  return {
    totalKeys: rateLimitStore.size,
    memoryUsage: process.memoryUsage(),
    configs: RATE_LIMITS,
    activeKeys: Array.from(rateLimitStore.keys()).slice(0, 10), // First 10 keys for debugging
  };
};

export default {
  rateLimit,
  rateLimitAdmin,
  rateLimitPassword,
  rateLimit2FA,
  rateLimitUpload,
  rateLimitSubscription,
  rateLimitGeneral,
  rateLimitDebug,
  rateLimitServer,
  rateLimitMessaging,
  rateLimitAuth,
  rateLimitWebhook,
  rateLimitNotification,
  rateLimitMedia,
  trackSuspiciousActivity,
  getRateLimitInfo,
  clearRateLimit,
  getRateLimitStats,
  RATE_LIMITS,
};
