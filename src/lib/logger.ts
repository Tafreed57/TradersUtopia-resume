// ============================================
// 🔧 CONDITIONAL LOGGING UTILITY
// ============================================

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogConfig {
  enableDebug: boolean;
  enableInfo: boolean;
  enableVerbose: boolean;
  environment: string;
}

// ✅ CONFIGURATION: Adjust logging based on environment
const config: LogConfig = {
  enableDebug: process.env.NODE_ENV === 'development',
  enableInfo: true, // Always log important info
  enableVerbose: process.env.ENABLE_VERBOSE_LOGS === 'true',
  environment: process.env.NODE_ENV || 'development',
};

class Logger {
  // ✅ DEBUG: Only in development (frequent, low-priority logs)
  debug(message: string, data?: any) {
    if (config.enableDebug) {
      console.log(message, data || '');
    }
  }

  // ✅ VERBOSE: Only when explicitly enabled (detailed operational logs)
  verbose(message: string, data?: any) {
    if (config.enableVerbose || config.enableDebug) {
      console.log(message, data || '');
    }
  }

  // ✅ INFO: Important operational information (always logged)
  info(message: string, data?: any) {
    if (config.enableInfo) {
      console.log(message, data || '');
    }
  }

  // ✅ WARN: Warnings (always logged)
  warn(message: string, data?: any) {
    console.warn(message, data || '');
  }

  // ✅ ERROR: Errors (always logged)
  error(message: string, data?: any) {
    console.error(message, data || '');
  }

  // ✅ WEBHOOK: Special category for webhook events (less verbose)
  webhook(message: string, data?: any) {
    if (config.enableVerbose) {
      console.log(message, data || '');
    }
  }

  // ✅ SECURITY: Security-related logs (always logged)
  security(message: string, data?: any) {
    console.log(message, data || '');
  }
}

// ✅ EXPORT: Single logger instance
export const logger = new Logger();

// ✅ LEGACY SUPPORT: Replace common logging patterns
export const conditionalLog = {
  productCheck: (message: string, data?: any) => logger.debug(message, data),
  subscriptionDetails: (message: string, data?: any) =>
    logger.verbose(message, data),
  webhook: (message: string, data?: any) => logger.webhook(message, data),
  admin: (message: string, data?: any) => logger.info(message, data),
  security: (message: string, data?: any) => logger.security(message, data),
  error: (message: string, data?: any) => logger.error(message, data),
};
