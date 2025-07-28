// ============================================
// ENHANCED LOGGING UTILITY
// ============================================
// Provides color-coded, timestamped logging for clean output
// Integrates with the existing logger.ts for consistent configuration
//
// COLOR CODING:
// DEBUG   - Gray (development only)
// VERBOSE - Cyan (when verbose enabled)
// INFO    - Blue (important operations)
// WARN    - Yellow (warnings)
// ERROR   - Red (errors)
// WEBHOOK - Magenta (webhook events)
// SECURITY- Red background (security issues)
//
// Usage: Colors automatically disabled in CI/CD or when NO_COLOR=true

import { logger } from '@/lib/logger';

// Color helper for timestamps
const colors = {
  reset: '\x1b[0m',
  gray: '\x1b[90m',
} as const;

const colorize = (text: string, color: keyof typeof colors): string => {
  if (process.env.NO_COLOR === 'true') return text;
  return `${colors[color]}${text}${colors.reset}`;
};

// Helper to get colored timestamp
const getTimestamp = () => {
  const timestamp = new Date().toISOString();
  return colorize(`[${timestamp}]`, 'gray');
};

// Helper to format event messages with consistent styling
const formatEventMessage = (
  category: string,
  event: string,
  details?: string
) => {
  let message = `${category}: ${event}`;
  if (details) {
    message += ` | ${details}`;
  }
  return message;
};

// Enhanced logging patterns with consistent formatting and color-coding
export const apiLogger = {
  securityViolation: (type: string, request: Request, details?: any) => {
    const url = new URL(request.url);
    const message = formatEventMessage(
      'Security Violation',
      type,
      `${request.method} ${url.pathname}`
    );
    logger.security(`${getTimestamp()} ${message}`);
  },

  webhookEvent: (service: string, eventType: string, details?: any) => {
    const message = formatEventMessage('Webhook', `${service}`, eventType);
    logger.webhook(`${getTimestamp()} ${message}`);
  },

  databaseOperation: (operation: string, success: boolean, details?: any) => {
    const status = success ? 'SUCCESS' : 'FAILED';
    const message = formatEventMessage('Database', operation, status);
    const logLevel = success ? 'info' : 'error';
    logger[logLevel](`${getTimestamp()} ${message}`);
  },

  authEvent: (event: string, userEmail?: string, details?: any) => {
    const message = formatEventMessage(
      'Authentication',
      event,
      userEmail ? `User: ${userEmail}` : undefined
    );
    logger.info(`${getTimestamp()} ${message}`);
  },

  adminAction: (
    action: string,
    adminEmail: string,
    targetUser?: string,
    details?: any
  ) => {
    const message = formatEventMessage(
      'Admin Action',
      action,
      `Admin: ${adminEmail}${targetUser ? ` | Target: ${targetUser}` : ''}`
    );
    logger.info(`${getTimestamp()} ${message}`);
  },

  subscriptionEvent: (event: string, details?: any) => {
    const message = formatEventMessage('Subscription', event);
    logger.info(`${getTimestamp()} ${message}`);
  },

  notificationEvent: (event: string, details?: any) => {
    const message = formatEventMessage('Notification', event);
    logger.info(`${getTimestamp()} ${message}`);
  },

  csrfViolation: (request: Request, reason: string, details?: any) => {
    const url = new URL(request.url);
    const message = formatEventMessage(
      'CSRF Violation',
      reason,
      `${request.method} ${url.pathname}`
    );
    logger.security(`${getTimestamp()} ${message}`);
  },

  rateLimitViolation: (request: Request, endpoint: string, details?: any) => {
    const url = new URL(request.url);
    const message = formatEventMessage(
      'Rate Limit Exceeded',
      endpoint,
      `${request.method} ${url.pathname}`
    );
    logger.security(`${getTimestamp()} ${message}`);
  },
};

// Re-export the base logger for direct access when needed
export { logger };

// TEST FUNCTION: Demonstrate all color-coded log levels
// Usage: Call this in development to see the color coding in action
export const testColorCodedLogs = () => {
  if (process.env.NODE_ENV !== 'development') {
    console.log('Color log test only available in development mode');
    return;
  }

  console.log('\n=== COLOR-CODED LOGGING TEST ===\n');

  logger.debug('This is a debug message (gray, dev only)');
  logger.verbose('This is a verbose message (cyan)');
  logger.info('This is an info message (blue)');
  logger.warn('This is a warning message (yellow)');
  logger.error('This is an error message (red)');
  logger.webhook('This is a webhook message (magenta)');
  logger.security('This is a security message (red background)');

  console.log('\n=== ENHANCED API LOGGER EXAMPLES ===\n');

  // Mock request for testing
  const mockRequest = new Request('https://example.com/api/test', {
    method: 'POST',
  });

  apiLogger.authEvent('User login', 'test@example.com');
  apiLogger.databaseOperation('user_create', true);
  apiLogger.databaseOperation('user_update', false);
  apiLogger.subscriptionEvent('subscription_created');
  apiLogger.webhookEvent('stripe', 'customer.subscription.created');
  apiLogger.securityViolation('Invalid token', mockRequest);
  apiLogger.rateLimitViolation(mockRequest, '/api/test');

  console.log('\nColor-coded logging test complete!\n');
};
