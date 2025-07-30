// ============================================
// 🔧 CONDITIONAL LOGGING UTILITY
// ============================================

interface LogConfig {
  enableDebug: boolean;
  enableInfo: boolean;
  enableVerbose: boolean;
  environment: string;
  enableColors: boolean;
}

// ✅ COLOR CODES: ANSI escape sequences for colored output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
} as const;

// ✅ CONFIGURATION: Adjust logging based on environment
const config: LogConfig = {
  enableDebug: process.env.NODE_ENV === 'development',
  enableInfo: true, // Always log important info
  enableVerbose: process.env.ENABLE_VERBOSE_LOGS === 'true',
  environment: process.env.NODE_ENV || 'development',
  enableColors: process.env.NO_COLOR !== 'true', // Respect NO_COLOR env var
};

// ✅ COLOR HELPER: Apply colors if enabled
const colorize = (text: string, color: keyof typeof colors): string => {
  if (!config.enableColors) return text;
  return `${colors[color]}${text}${colors.reset}`;
};

class Logger {
  // ✅ DEBUG: Only in development (frequent, low-priority logs)
  debug(message: string, data?: any) {
    if (config.enableDebug) {
      console.log(
        colorize('DEBUG:', 'gray') + ' ' + colorize(message, 'dim'),
        data || ''
      );
    }
  }

  // ✅ VERBOSE: Only when explicitly enabled (detailed operational logs)
  verbose(message: string, data?: any) {
    if (config.enableVerbose || config.enableDebug) {
      console.log(
        colorize('VERBOSE:', 'cyan') + ' ' + colorize(message, 'cyan'),
        data || ''
      );
    }
  }

  // ✅ INFO: Important operational information (always logged)
  info(message: string, data?: any) {
    if (config.enableInfo) {
      console.log(
        colorize('INFO:', 'blue') + ' ' + colorize(message, 'white'),
        data || ''
      );
    }
  }

  // ✅ WARN: Warnings (always logged)
  warn(message: string, data?: any) {
    console.warn(
      colorize('WARN:', 'yellow') + ' ' + colorize(message, 'yellow'),
      data || ''
    );
  }

  // ✅ ERROR: Errors (always logged)
  error(message: string, data?: any) {
    console.error(
      colorize('ERROR:', 'red') + ' ' + colorize(message, 'red'),
      data || ''
    );
  }

  // ✅ WEBHOOK: Special category for webhook events (less verbose)
  webhook(message: string, data?: any) {
    if (config.enableVerbose) {
      console.log(
        colorize('WEBHOOK:', 'magenta') + ' ' + colorize(message, 'magenta'),
        data || ''
      );
    }
  }

  // ✅ SECURITY: Security-related logs (always logged)
  security(message: string, data?: any) {
    console.log(
      colorize('SECURITY:', 'bgRed') + ' ' + colorize(message, 'red'),
      data || ''
    );
  }
}

// ✅ EXPORT: Single logger instance
const logger = new Logger();

// ✅ EXPORT THE LOGGER INSTANCE
export { logger };

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
