// ============================================
// 🚀 ENHANCED LOGGING UTILITY
// ============================================
// Provides structured logging patterns for production observability
// Integrates with the existing logger.ts for consistent configuration

import { logger } from '@/lib/logger';

// ✅ ENHANCED LOGGING PATTERNS FOR COMMON OPERATIONS
export const apiLogger = {
  // 🔐 SECURITY VIOLATIONS & SUSPICIOUS ACTIVITY
  securityViolation: (type: string, request: Request, details?: any) => {
    logger.security(`Security violation: ${type}`, {
      ip: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent:
        request.headers.get('user-agent')?.substring(0, 100) || 'unknown',
      timestamp: new Date().toISOString(),
      violationType: type,
      ...details,
    });
  },

  // 🎣 WEBHOOK EVENT PROCESSING
  webhookEvent: (service: string, eventType: string, details?: any) => {
    logger.webhook(`${service} webhook: ${eventType}`, {
      timestamp: new Date().toISOString(),
      service,
      eventType,
      ...details,
    });
  },

  // 💾 DATABASE OPERATIONS (SUCCESS & FAILURES)
  databaseOperation: (operation: string, success: boolean, details?: any) => {
    const logLevel = success ? 'info' : 'error';
    logger[logLevel](`Database ${operation}`, {
      success,
      operation,
      timestamp: new Date().toISOString(),
      ...details,
    });
  },

  // 👤 USER AUTHENTICATION & AUTHORIZATION
  authEvent: (event: string, userId?: string, details?: any) => {
    logger.security(`Auth event: ${event}`, {
      timestamp: new Date().toISOString(),
      userId: userId ? userId.substring(0, 4) + '***' : 'unknown',
      event,
      ...details,
    });
  },

  // 💰 STRIPE PAYMENT OPERATIONS
  stripeEvent: (operation: string, success: boolean, details?: any) => {
    const logLevel = success ? 'info' : 'error';
    logger[logLevel](`Stripe ${operation}`, {
      success,
      operation,
      timestamp: new Date().toISOString(),
      // Mask sensitive Stripe data
      customerId: details?.customerId ? 'cus_***' : undefined,
      subscriptionId: details?.subscriptionId ? 'sub_***' : undefined,
      ...details,
    });
  },

  // 🔔 NOTIFICATION SYSTEM
  notificationEvent: (type: string, success: boolean, details?: any) => {
    const logLevel = success ? 'info' : 'warn';
    logger[logLevel](`Notification ${type}`, {
      success,
      type,
      timestamp: new Date().toISOString(),
      ...details,
    });
  },

  // 📊 ADMIN OPERATIONS (REQUIRES AUDIT TRAIL)
  adminOperation: (
    operation: string,
    adminUserId: string,
    targetUserId?: string,
    details?: any
  ) => {
    logger.security(`Admin operation: ${operation}`, {
      timestamp: new Date().toISOString(),
      operation,
      adminUserId: adminUserId.substring(0, 4) + '***',
      targetUserId: targetUserId
        ? targetUserId.substring(0, 4) + '***'
        : undefined,
      ...details,
    });
  },

  // 🚫 RATE LIMITING VIOLATIONS
  rateLimitViolation: (endpoint: string, request: Request, details?: any) => {
    logger.security(`Rate limit exceeded: ${endpoint}`, {
      ip: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent:
        request.headers.get('user-agent')?.substring(0, 100) || 'unknown',
      timestamp: new Date().toISOString(),
      endpoint,
      ...details,
    });
  },

  // 📁 FILE UPLOAD OPERATIONS
  fileOperation: (operation: string, success: boolean, details?: any) => {
    const logLevel = success ? 'info' : 'error';
    logger[logLevel](`File ${operation}`, {
      success,
      operation,
      timestamp: new Date().toISOString(),
      // Mask file paths for security
      fileName: details?.fileName || 'unknown',
      fileSize: details?.fileSize || 0,
      ...details,
    });
  },

  // 🔧 API PERFORMANCE MONITORING
  performanceLog: (operation: string, duration: number, details?: any) => {
    const logLevel = duration > 5000 ? 'warn' : 'info'; // Warn on slow operations
    logger[logLevel](`Performance: ${operation}`, {
      operation,
      duration,
      timestamp: new Date().toISOString(),
      slow: duration > 5000,
      ...details,
    });
  },
};

// ✅ UTILITY FUNCTIONS FOR SAFE LOGGING
export const logUtils = {
  // Mask sensitive user information
  maskUserId: (userId: string): string => {
    if (!userId || userId.length < 4) return 'invalid';
    return userId.substring(0, 4) + '***';
  },

  // Mask email addresses
  maskEmail: (email: string): string => {
    if (!email || !email.includes('@')) return 'invalid';
    const [local, domain] = email.split('@');
    return `${local.substring(0, 3)}***@${domain}`;
  },

  // Mask IP addresses (keep first 2 octets)
  maskIP: (ip: string): string => {
    if (!ip || !ip.includes('.')) return 'unknown';
    const parts = ip.split('.');
    if (parts.length !== 4) return 'invalid';
    return `${parts[0]}.${parts[1]}.***.**`;
  },

  // Create safe error context (remove sensitive stack traces in production)
  safeErrorContext: (error: any): object => {
    const isDevelopment = process.env.NODE_ENV === 'development';

    return {
      message: error?.message || 'Unknown error',
      name: error?.name || 'Error',
      code: error?.code || undefined,
      ...(isDevelopment && { stack: error?.stack }),
    };
  },
};

// ✅ PERFORMANCE WRAPPER FOR DATABASE OPERATIONS
export function withPerformanceLogging<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  return new Promise(async (resolve, reject) => {
    const startTime = Date.now();

    try {
      const result = await fn();
      const duration = Date.now() - startTime;

      apiLogger.performanceLog(operation, duration, { success: true });
      resolve(result);
    } catch (error) {
      const duration = Date.now() - startTime;

      apiLogger.performanceLog(operation, duration, {
        success: false,
        error: logUtils.safeErrorContext(error),
      });
      reject(error);
    }
  });
}

// ✅ EXPORT INDIVIDUAL LOGGER FOR BACKWARDS COMPATIBILITY
export { logger } from '@/lib/logger';
