import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { UserService } from '@/services/database/user-service';
import { SubscriptionService } from '@/services/stripe/subscription-service';
import { apiLogger } from '@/lib/enhanced-logger';
import {
  AuthenticationError,
  AuthorizationError,
  RateLimitError,
  ValidationError,
  withErrorHandling,
} from '@/lib/error-handling';
import { strictCSRFValidation } from '@/lib/csrf';
import { rateLimitGeneral, trackSuspiciousActivity } from '@/lib/rate-limit';
import { User } from '@/services/types';

/**
 * Authentication context provided to route handlers
 */
interface AuthContext {
  user: User;
  userId: string;
  userEmail: string;
  isAdmin: boolean;
  timestamp: Date;
}

/**
 * Configuration options for withAuth middleware
 */
export interface AuthOptions {
  action: string;
  requireAdmin?: boolean;
  requireActiveSubscription?: boolean;
  requireCSRF?: boolean;
  requireRateLimit?: boolean;
  allowedMethods?: string[];
}

/**
 * Type for authenticated route handlers
 */
type AuthenticatedHandler = (
  req: NextRequest,
  context: AuthContext
) => Promise<NextResponse | Response | any>;

/**
 * Higher-order function that wraps API routes with authentication, CSRF, and rate limiting
 * Eliminates 300+ lines of duplicate security boilerplate
 */
export function withAuth(handler: AuthenticatedHandler, options: AuthOptions) {
  return withErrorHandling(async (req: NextRequest) => {
    const startTime = Date.now();

    // Method validation
    if (
      options.allowedMethods &&
      !options.allowedMethods.includes(req.method)
    ) {
      throw new ValidationError(`Method ${req.method} not allowed`);
    }

    // 1. CSRF Protection (default: enabled for state-changing operations)
    if (
      options.requireCSRF !== false &&
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)
    ) {
      const csrfValid = await strictCSRFValidation(req);
      if (!csrfValid) {
        trackSuspiciousActivity(req, `${options.action}_CSRF_FAILED`);
        throw new ValidationError('CSRF validation failed');
      }
    }

    // 2. Rate Limiting (default: enabled)
    if (options.requireRateLimit !== false) {
      const rateLimitResult = await rateLimitGeneral()(req);
      if (!rateLimitResult.success) {
        trackSuspiciousActivity(req, `${options.action}_RATE_LIMITED`);
        throw new RateLimitError('Rate limit exceeded');
      }
    }

    // 3. User Authentication
    const clerkUser = await currentUser();
    if (!clerkUser) {
      apiLogger.databaseOperation(`${options.action}_auth_failed`, false, {
        reason: 'No Clerk user found',
        timestamp: new Date().toISOString(),
      });
      throw new AuthenticationError('Authentication required');
    }

    // 4. Profile/User Lookup with Service Layer
    const userService = new UserService();
    const user = await userService.findByClerkId(clerkUser.id);

    if (!user) {
      apiLogger.databaseOperation(
        `${options.action}_profile_not_found`,
        false,
        {
          clerkUserId: clerkUser.id.substring(0, 8) + '***',
          email:
            clerkUser.emailAddresses[0]?.emailAddress?.substring(0, 3) + '***',
        }
      );
      throw new AuthenticationError('User profile not found');
    }

    // 5. Admin Authorization Check
    if (options.requireAdmin && !user.isAdmin) {
      apiLogger.databaseOperation(`${options.action}_admin_required`, false, {
        userId: user.id.substring(0, 8) + '***',
        action: options.action,
        isAdmin: user.isAdmin,
      });
      throw new AuthorizationError('Admin privileges required');
    }

    // 6. Active Subscription Check (with admin bypass)
    if (options.requireActiveSubscription && !user.isAdmin) {
      try {
        const subscriptionService = new SubscriptionService();
        const hasActiveSubscription =
          await subscriptionService.hasActiveSubscription(user.id);

        if (!hasActiveSubscription) {
          apiLogger.databaseOperation(
            `${options.action}_subscription_required`,
            false,
            {
              userId: user.id.substring(0, 8) + '***',
              action: options.action,
              hasActiveSubscription: false,
              isAdmin: user.isAdmin,
            }
          );
          throw new AuthorizationError('Active subscription required');
        }

        apiLogger.databaseOperation(
          `${options.action}_subscription_verified`,
          true,
          {
            userId: user.id.substring(0, 8) + '***',
            action: options.action,
            isAdmin: user.isAdmin,
          }
        );
      } catch (error) {
        if (error instanceof AuthorizationError) {
          throw error; // Re-throw authorization errors
        }

        // Log subscription service errors but treat as authorization failure for security
        apiLogger.databaseOperation(
          `${options.action}_subscription_check_failed`,
          false,
          {
            userId: user.id.substring(0, 8) + '***',
            action: options.action,
            error: error instanceof Error ? error.message : String(error),
          }
        );
        throw new AuthorizationError('Unable to verify subscription status');
      }
    } else if (options.requireActiveSubscription && user.isAdmin) {
      // Admin bypass - log for audit purposes
      apiLogger.databaseOperation(
        `${options.action}_admin_subscription_bypass`,
        true,
        {
          userId: user.id.substring(0, 8) + '***',
          action: options.action,
          isAdmin: user.isAdmin,
        }
      );
    }

    // 7. Build Authentication Context
    const authContext: AuthContext = {
      user,
      userId: user.id, // Clerk user ID
      userEmail: user.email,
      isAdmin: user.isAdmin,
      timestamp: new Date(),
    };

    // 8. Log Successful Authentication
    const duration = Date.now() - startTime;
    apiLogger.databaseOperation(`${options.action}_auth_success`, true, {
      userId: user.id.substring(0, 8) + '***',
      isAdmin: user.isAdmin,
      duration,
      action: options.action,
    });

    // 9. Execute the actual route handler
    try {
      const result = await handler(req, authContext);

      // Log successful operation
      apiLogger.databaseOperation(options.action, true, {
        userId: user.id.substring(0, 8) + '***',
        totalDuration: Date.now() - startTime,
      });

      return result instanceof NextResponse
        ? result
        : NextResponse.json(result);
    } catch (error) {
      // Log handler errors
      apiLogger.databaseOperation(`${options.action}_handler_error`, false, {
        userId: user.id.substring(0, 8) + '***',
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }, options.action);
}

/**
 * Lightweight version for public endpoints that only need rate limiting
 */
export function withPublicAuth(
  handler: (req: NextRequest) => Promise<NextResponse | Response | any>,
  options: { action: string; requireRateLimit?: boolean }
) {
  return withErrorHandling(async (req: NextRequest) => {
    // Rate limiting only
    if (options.requireRateLimit !== false) {
      const rateLimitResult = await rateLimitGeneral()(req);
      if (!rateLimitResult.success) {
        trackSuspiciousActivity(req, `${options.action}_RATE_LIMITED`);
        throw new RateLimitError('Rate limit exceeded');
      }
    }

    const result = await handler(req);
    return result instanceof NextResponse ? result : NextResponse.json(result);
  }, options.action);
}

/**
 * Optional user authentication - provides user context if available, but doesn't require it
 */
export function withOptionalAuth(
  handler: (
    req: NextRequest,
    context?: AuthContext
  ) => Promise<NextResponse | Response | any>,
  options: AuthOptions
) {
  return withErrorHandling(async (req: NextRequest) => {
    // Rate limiting
    if (options.requireRateLimit !== false) {
      const rateLimitResult = await rateLimitGeneral()(req);
      if (!rateLimitResult.success) {
        throw new RateLimitError('Rate limit exceeded');
      }
    }

    // Try to get user context, but don't fail if not available
    let authContext: AuthContext | undefined;

    try {
      const clerkUser = await currentUser();
      if (clerkUser) {
        const userService = new UserService();
        const user = await userService.findByClerkId(clerkUser.id);

        if (user) {
          authContext = {
            user,
            userId: user.id,
            userEmail: user.email,
            isAdmin: user.isAdmin,
            timestamp: new Date(),
          };
        }
      }
    } catch (error) {
      // Log but don't fail - this is optional auth
      apiLogger.databaseOperation(
        `${options.action}_optional_auth_failed`,
        false,
        {
          error: error instanceof Error ? error.message : String(error),
        }
      );
    }

    const result = await handler(req, authContext);
    return result instanceof NextResponse ? result : NextResponse.json(result);
  }, options.action);
}

/**
 * Route-specific authentication helpers
 */
export const authHelpers = {
  /**
   * For admin-only routes
   */
  adminOnly: (action: string) => ({
    action,
    requireAdmin: true,
    requireCSRF: true,
    requireRateLimit: true,
  }),

  /**
   * For user-authenticated routes
   */
  userOnly: (action: string) => ({
    action,
    requireAdmin: false,
    requireCSRF: true,
    requireRateLimit: true,
  }),

  /**
   * For read-only operations
   */
  readOnly: (action: string) => ({
    action,
    requireAdmin: false,
    requireCSRF: false,
    requireRateLimit: true,
    allowedMethods: ['GET'],
  }),

  /**
   * For subscription-related operations
   */
  subscription: (action: string) => ({
    action,
    requireAdmin: false,
    requireCSRF: true,
    requireRateLimit: true,
    allowedMethods: ['GET', 'POST', 'PATCH'],
  }),

  /**
   * For routes requiring active subscription
   */
  subscriberOnly: (action: string) => ({
    action,
    requireAdmin: false,
    requireActiveSubscription: true,
    requireCSRF: true,
    requireRateLimit: true,
  }),
};
