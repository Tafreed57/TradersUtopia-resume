// ============================================
// 🚀 ENHANCED LOGGING UTILITY
// ============================================
// Provides simple timestamp + event logging for clean output
// Integrates with the existing logger.ts for consistent configuration

import { logger } from '@/lib/logger';

// Helper to get formatted timestamp
const getTimestamp = () => new Date().toISOString();

// Simple logging patterns with timestamp + event format
export const apiLogger = {
  securityViolation: (type: string, request: Request, details?: any) => {
    logger.security(`${getTimestamp()} Security violation: ${type}`);
  },

  webhookEvent: (service: string, eventType: string, details?: any) => {
    logger.webhook(`${getTimestamp()} ${service} webhook: ${eventType}`);
  },

  databaseOperation: (operation: string, success: boolean, details?: any) => {
    const status = success ? 'success' : 'failed';
    const logLevel = success ? 'info' : 'error';
    logger[logLevel](`${getTimestamp()} Database ${operation} ${status}`);
  },

  authEvent: (event: string, userEmail?: string, details?: any) => {
    logger.info(`${getTimestamp()} Auth: ${event}`);
  },

  adminAction: (
    action: string,
    adminEmail: string,
    targetUser?: string,
    details?: any
  ) => {
    logger.info(`${getTimestamp()} Admin action: ${action}`);
  },

  subscriptionEvent: (event: string, details?: any) => {
    logger.info(`${getTimestamp()} Subscription: ${event}`);
  },

  notificationEvent: (event: string, details?: any) => {
    logger.info(`${getTimestamp()} Notification: ${event}`);
  },

  csrfViolation: (request: Request, reason: string, details?: any) => {
    logger.security(`${getTimestamp()} CSRF violation: ${reason}`);
  },

  rateLimitViolation: (request: Request, endpoint: string, details?: any) => {
    logger.security(`${getTimestamp()} Rate limit exceeded: ${endpoint}`);
  },
};

// Re-export the base logger for direct access when needed
export { logger };
