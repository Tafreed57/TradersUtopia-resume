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
// DEBUG MODE FEATURES:
// When debug flags are active, logs include detailed information:
// - Full request details (headers, params, body)
// - Stack traces for debugging
// - Complete object serialization
// - Performance context
//
// SMART LOGGING LEVELS:
// Database operations use appropriate log levels:
// - 200-299: INFO (success)
// - 401/403: WARN (access control - expected behavior)
// - 404: WARN (not found - client issue)
// - 400-499: WARN (client errors)
// - 500+: ERROR (server errors - actual problems)
// - Operation name context: access_denied, unauthorized → WARN
//
// ENABLE DEBUG MODE:
// - pnpm dev --debug (recommended - handles both Next.js and Trigger.dev)
// - DEBUG=* (universal debug)
// - DEBUG=next* (Next.js specific)
// - NODE_ENV=development (development mode)
// - ENABLE_DETAILED_LOGS=true (custom flag)
// - --debug CLI flag
//
// Usage: Colors automatically disabled in CI/CD or when NO_COLOR=true

import { logger } from '@/lib/logger';

// Color helper for timestamps and debug details
const colors = {
  reset: '\x1b[0m',
  gray: '\x1b[90m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
} as const;

const colorize = (text: string, color: keyof typeof colors): string => {
  if (process.env.NO_COLOR === 'true') return text;
  return `${colors[color]}${text}${colors.reset}`;
};

// Debug mode detection - checks various Next.js and Node.js debug flags
const isDebugMode = (): boolean => {
  // If ENABLE_DETAILED_LOGS is explicitly set to 'false', respect that
  if (process.env.ENABLE_DETAILED_LOGS === 'false') {
    return false;
  }

  return !!(
    (
      process.env.DEBUG || // Generic debug flag
      process.env.DEBUG?.includes('next') || // Next.js specific debug
      process.env.DEBUG?.includes('*') || // Universal debug
      process.env.NEXT_DEBUG === 'true' || // Next.js debug flag
      process.argv.includes('--debug') || // CLI debug flag
      process.env.ENABLE_DETAILED_LOGS === 'true' || // Custom detailed logging flag
      process.env.npm_config_debug === 'true' || // npm --debug flag
      process.env.npm_lifecycle_event?.includes('debug')
    ) // npm script debug variants
    // Note: Removed NODE_ENV === 'development' to allow explicit control
  );
};

// Helper to get debug mode info for logging
const getDebugModeInfo = (): string => {
  if (!isDebugMode()) return '';

  const debugSources = [];
  if (process.env.DEBUG) debugSources.push(`DEBUG=${process.env.DEBUG}`);
  if (process.env.ENABLE_DETAILED_LOGS === 'true')
    debugSources.push('ENABLE_DETAILED_LOGS=true');
  if (process.env.NODE_ENV === 'development')
    debugSources.push('NODE_ENV=development');
  if (process.argv.includes('--debug')) debugSources.push('--debug flag');

  return debugSources.length > 0
    ? colorize(`\n  Debug Mode: ${debugSources.join(', ')}`, 'dim')
    : '';
};

// Helper to get colored timestamp
const getTimestamp = () => {
  const timestamp = new Date().toISOString();
  return colorize(`[${timestamp}]`, 'gray');
};

// Helper to safely serialize objects for logging
const safeStringify = (obj: any, maxDepth = 3): string => {
  if (!isDebugMode()) return '[object]'; // Minimal in non-debug mode

  try {
    const seen = new WeakSet();
    return JSON.stringify(
      obj,
      (key, value) => {
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) return '[Circular]';
          seen.add(value);
        }
        return value;
      },
      2
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return `[Serialization Error: ${errorMessage}]`;
  }
};

// Helper to extract request details for debug mode
const getRequestDetails = (request: Request): string => {
  if (!isDebugMode()) return '';

  try {
    const url = new URL(request.url);
    const details = {
      method: request.method,
      pathname: url.pathname,
      searchParams: Object.fromEntries(url.searchParams),
      headers: Object.fromEntries(request.headers.entries()),
      userAgent: request.headers.get('user-agent'),
      origin: request.headers.get('origin'),
      referer: request.headers.get('referer'),
    };

    return colorize(`\n  Debug Details: ${safeStringify(details)}`, 'dim');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return colorize(`\n  Debug Error: ${errorMessage}`, 'dim');
  }
};

// Helper to get stack trace in debug mode
const getStackTrace = (): string => {
  if (!isDebugMode()) return '';

  try {
    const stack = new Error().stack;
    const relevantStack = stack
      ?.split('\n')
      .slice(3, 6) // Skip first 3 lines, take next 3
      .map(line => line.trim())
      .join('\n    ');

    return colorize(`\n  Stack: \n    ${relevantStack}`, 'dim');
  } catch (error) {
    return '';
  }
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
    const debugInfo = isDebugMode()
      ? `${getRequestDetails(request)}${getStackTrace()}${
          details
            ? colorize(`\n  Additional: ${safeStringify(details)}`, 'dim')
            : ''
        }`
      : '';
    logger.security(`${getTimestamp()} ${message}${debugInfo}`);
  },

  webhookEvent: (service: string, eventType: string, details?: any) => {
    const message = formatEventMessage('Webhook', `${service}`, eventType);
    const debugInfo =
      isDebugMode() && details
        ? colorize(
            `\n  Payload: ${safeStringify(details)}${getStackTrace()}`,
            'dim'
          )
        : '';
    logger.webhook(`${getTimestamp()} ${message}${debugInfo}`);
  },

  databaseOperation: (
    operation: string,
    success: boolean,
    details?: any,
    responseCode?: number
  ) => {
    // Determine status and log level based on response code and success
    let status: string;
    let logLevel: 'info' | 'warn' | 'error';

    if (success) {
      status = responseCode ? responseCode.toString() : 'SUCCESS';
      logLevel = 'info';
    } else {
      // Handle different types of "failures" more appropriately
      if (responseCode) {
        status = responseCode.toString();
        if (responseCode === 401 || responseCode === 403) {
          logLevel = 'warn'; // Access control - expected behavior
          status = responseCode === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN';
        } else if (responseCode === 404) {
          logLevel = 'warn'; // Not found - client issue
          status = 'NOT_FOUND';
        } else if (responseCode >= 400 && responseCode < 500) {
          logLevel = 'warn'; // Client errors
          status = 'CLIENT_ERROR';
        } else if (responseCode >= 500) {
          logLevel = 'error'; // Server errors - actual problems
          status = 'SERVER_ERROR';
        } else {
          logLevel = 'warn';
        }
      } else {
        // No response code provided, check operation name for context
        if (
          operation.includes('access_denied') ||
          operation.includes('unauthorized') ||
          operation.includes('forbidden')
        ) {
          status = 'ACCESS_DENIED';
          logLevel = 'warn';
        } else if (
          operation.includes('not_found') ||
          operation.includes('missing')
        ) {
          status = 'NOT_FOUND';
          logLevel = 'warn';
        } else {
          status = 'FAILED';
          logLevel = 'error';
        }
      }
    }

    const message = formatEventMessage('Database', operation, status);
    const debugInfo = isDebugMode()
      ? `${
          details
            ? colorize(`\n  Query Details: ${safeStringify(details)}`, 'dim')
            : ''
        }${getStackTrace()}`
      : '';
    logger[logLevel](`${getTimestamp()} ${message}${debugInfo}`);
  },

  authEvent: (event: string, userEmail?: string, details?: any) => {
    const message = formatEventMessage(
      'Authentication',
      event,
      userEmail ? `User: ${userEmail}` : undefined
    );
    const debugInfo =
      isDebugMode() && details
        ? colorize(
            `\n  Auth Details: ${safeStringify(details)}${getStackTrace()}`,
            'dim'
          )
        : '';
    logger.info(`${getTimestamp()} ${message}${debugInfo}`);
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
    const debugInfo =
      isDebugMode() && details
        ? colorize(
            `\n  Action Details: ${safeStringify(details)}${getStackTrace()}`,
            'dim'
          )
        : '';
    logger.info(`${getTimestamp()} ${message}${debugInfo}`);
  },

  subscriptionEvent: (event: string, details?: any) => {
    const message = formatEventMessage('Subscription', event);
    const debugInfo =
      isDebugMode() && details
        ? colorize(
            `\n  Subscription Details: ${safeStringify(
              details
            )}${getStackTrace()}`,
            'dim'
          )
        : '';
    logger.info(`${getTimestamp()} ${message}${debugInfo}`);
  },

  notificationEvent: (event: string, details?: any) => {
    const message = formatEventMessage('Notification', event);
    const debugInfo =
      isDebugMode() && details
        ? colorize(
            `\n  Notification Details: ${safeStringify(
              details
            )}${getStackTrace()}`,
            'dim'
          )
        : '';
    logger.info(`${getTimestamp()} ${message}${debugInfo}`);
  },

  csrfViolation: (request: Request, reason: string, details?: any) => {
    const url = new URL(request.url);
    const message = formatEventMessage(
      'CSRF Violation',
      reason,
      `${request.method} ${url.pathname}`
    );
    const debugInfo = isDebugMode()
      ? `${getRequestDetails(request)}${getStackTrace()}${
          details
            ? colorize(`\n  CSRF Details: ${safeStringify(details)}`, 'dim')
            : ''
        }`
      : '';
    logger.security(`${getTimestamp()} ${message}${debugInfo}`);
  },

  rateLimitViolation: (request: Request, endpoint: string, details?: any) => {
    const url = new URL(request.url);
    const message = formatEventMessage(
      'Rate Limit Exceeded',
      endpoint,
      `${request.method} ${url.pathname}`
    );
    const debugInfo = isDebugMode()
      ? `${getRequestDetails(request)}${getStackTrace()}${
          details
            ? colorize(
                `\n  Rate Limit Details: ${safeStringify(details)}`,
                'dim'
              )
            : ''
        }`
      : '';
    logger.security(`${getTimestamp()} ${message}${debugInfo}`);
  },
};

// Re-export the base logger for direct access when needed
export { logger };

// Export debug mode check for external use
export { isDebugMode };

// TEST FUNCTION: Demonstrate all color-coded log levels
// Usage: Call this in development to see the color coding in action
export const testColorCodedLogs = () => {
  if (process.env.NODE_ENV !== 'development') {
    console.log('Color log test only available in development mode');
    return;
  }

  console.log('\n=== COLOR-CODED LOGGING TEST ===\n');
  console.log(`Debug Mode: ${isDebugMode() ? 'ENABLED' : 'DISABLED'}`);
  console.log(`Environment Variables:`);
  console.log(`   • NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(
    `   • ENABLE_DETAILED_LOGS: ${
      process.env.ENABLE_DETAILED_LOGS || 'undefined'
    }`
  );
  console.log(
    `   • ENABLE_VERBOSE_LOGS: ${
      process.env.ENABLE_VERBOSE_LOGS || 'undefined'
    }`
  );
  console.log(`   • FORCE_COLOR: ${process.env.FORCE_COLOR || 'undefined'}`);

  if (isDebugMode()) {
    console.log(getDebugModeInfo());
  } else {
    console.log('\n🐛 Enable debug mode with:');
    console.log('   • pnpm dev --debug (recommended)');
    console.log('   • DEBUG=* pnpm dev');
    console.log('   • ENABLE_DETAILED_LOGS=true pnpm dev');
  }
  console.log('');

  logger.debug('This is a debug message (gray, dev only)');
  logger.verbose('This is a verbose message (cyan)');
  logger.info('This is an info message (blue)');
  logger.warn('This is a warning message (yellow)');
  logger.error('This is an error message (red)');
  logger.webhook('This is a webhook message (magenta)');
  logger.security('This is a security message (red background)');

  console.log('\n=== ENHANCED API LOGGER EXAMPLES ===\n');

  // Mock request for testing with debug details
  const mockRequest = new Request('https://example.com/api/test?param=value', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Test-Client/1.0',
      'X-Custom-Header': 'test-value',
    },
  });

  const mockDetails = {
    userId: '12345',
    action: 'test_action',
    timestamp: Date.now(),
    metadata: { test: true },
  };

  apiLogger.authEvent('User login', 'test@example.com', mockDetails);
  apiLogger.databaseOperation('user_create', true, mockDetails, 201);
  apiLogger.databaseOperation('user_update', false, mockDetails, 404); // NOT_FOUND (warn)
  apiLogger.databaseOperation('channel_access_denied', false, mockDetails, 403); // FORBIDDEN (warn)
  apiLogger.databaseOperation('unauthorized_access', false, mockDetails, 401); // UNAUTHORIZED (warn)
  apiLogger.databaseOperation('server_error', false, mockDetails, 500); // SERVER_ERROR (error)
  apiLogger.databaseOperation('user_delete', true); // No response code
  apiLogger.subscriptionEvent('subscription_created', mockDetails);
  apiLogger.webhookEvent(
    'stripe',
    'customer.subscription.created',
    mockDetails
  );
  apiLogger.securityViolation('Invalid token', mockRequest, mockDetails);
  apiLogger.rateLimitViolation(mockRequest, '/api/test', mockDetails);

  console.log('\nColor-coded logging test complete!\n');
  if (!isDebugMode()) {
    console.log(
      '💡 Tip: Run with `pnpm dev --debug` to see detailed information\n'
    );
  }
};
