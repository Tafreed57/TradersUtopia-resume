// ============================================
// 🚀 ENHANCED LOGGING UTILITY
// ============================================
// Provides structured logging patterns for production observability
// Integrates with the existing logger.ts for consistent configuration

import { logger } from '@/lib/logger';

// Enhanced patterns for common operations
export const apiLogger = {
  securityViolation: (type: string, request: Request, details?: any) => {
    logger.security(`Security violation: ${type}`, {
      ip: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      timestamp: new Date().toISOString(),
      ...details,
    });
  },

  webhookEvent: (service: string, eventType: string, details?: any) => {
    logger.webhook(`${service} webhook: ${eventType}`, {
      timestamp: new Date().toISOString(),
      ...details,
    });
  },

  databaseOperation: (operation: string, success: boolean, details?: any) => {
    const logLevel = success ? 'info' : 'error';
    logger[logLevel](`Database ${operation}`, {
      success,
      timestamp: new Date().toISOString(),
      ...details,
    });
  },

  authEvent: (event: string, userEmail?: string, details?: any) => {
    logger.info(`Auth: ${event}`, {
      userEmail: userEmail || 'unknown',
      timestamp: new Date().toISOString(),
      ...details,
    });
  },

  adminAction: (
    action: string,
    adminEmail: string,
    targetUser?: string,
    details?: any
  ) => {
    logger.info(`Admin action: ${action}`, {
      adminEmail,
      targetUser,
      timestamp: new Date().toISOString(),
      ...details,
    });
  },

  subscriptionEvent: (event: string, details?: any) => {
    logger.info(`Subscription: ${event}`, {
      timestamp: new Date().toISOString(),
      ...details,
    });
  },

  notificationEvent: (event: string, details?: any) => {
    logger.info(`Notification: ${event}`, {
      timestamp: new Date().toISOString(),
      ...details,
    });
  },

  csrfViolation: (request: Request, reason: string, details?: any) => {
    logger.security(`CSRF violation: ${reason}`, {
      ip: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      timestamp: new Date().toISOString(),
      ...details,
    });
  },

  rateLimitViolation: (request: Request, endpoint: string, details?: any) => {
    logger.security(`Rate limit exceeded: ${endpoint}`, {
      ip: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      timestamp: new Date().toISOString(),
      ...details,
    });
  },
};

// Re-export the base logger for direct access when needed
export { logger };
