import { NextRequest, NextResponse } from 'next/server';
import { withOptionalAuth } from '@/middleware/auth-middleware';
import { UserService } from '@/services/database/user-service';
import { UserWithSubscription } from '@/services/types';
import { apiLogger } from '@/lib/enhanced-logger';

export const dynamic = 'force-dynamic';

/**
 * Simplified Session Check
 *
 * Returns only essential authentication data:
 * - Is user admin?
 * - Does user have active subscription?
 * - Basic profile info
 *
 * Uses database subscription data only - no Stripe API calls
 */
export const POST = withOptionalAuth(
  async (req: NextRequest, authContext) => {
    // Not authenticated - return early
    if (!authContext) {
      return NextResponse.json(
        {
          isAuthenticated: false,
          hasAccess: false,
          isAdmin: false,
          profile: null,
        },
        { status: 401 }
      );
    }

    const { user, userEmail } = authContext;

    try {
      // Get user with subscription data from database
      const userService = new UserService();
      const userWithSubscription =
        await userService.findUserWithSubscriptionData(user.id);

      if (!userWithSubscription) {
        apiLogger.databaseOperation('session_check_user_not_found', false, {
          userId: user.id.substring(0, 8) + '***',
        });

        return NextResponse.json({
          isAuthenticated: true,
          hasAccess: false,
          isAdmin: false,
          profile: null,
        });
      }

      // Admin users get access automatically
      if (userWithSubscription.isAdmin === true) {
        apiLogger.databaseOperation('session_check_admin_access', true, {
          userId: user.id.substring(0, 8) + '***',
        });

        return NextResponse.json({
          isAuthenticated: true,
          hasAccess: true,
          isAdmin: true,
          profile: {
            id: userWithSubscription.id,
            email: userWithSubscription.email,
            name: userWithSubscription.name,
            isAdmin: userWithSubscription.isAdmin || false,
            createdAt: userWithSubscription.createdAt,
          },
        });
      }

      // Check subscription status from database
      // console.log(
      //   '🚀 [SESSION-CHECK] userWithSubscription:',
      //   userWithSubscription
      // );
      let hasActiveSubscription = false;
      if (userWithSubscription.subscription) {
        const subscription = userWithSubscription.subscription;
        hasActiveSubscription = Boolean(
          subscription.status === 'ACTIVE' &&
            subscription.currentPeriodEnd &&
            new Date() < subscription.currentPeriodEnd
        );
      }

      apiLogger.databaseOperation('session_check_completed', true, {
        userId: user.id.substring(0, 8) + '***',
        hasAccess: hasActiveSubscription,
        isAdmin: false,
      });

      return NextResponse.json({
        isAuthenticated: true,
        hasAccess: hasActiveSubscription,
        isAdmin: false,
        profile: {
          id: userWithSubscription.id,
          email: userWithSubscription.email,
          name: userWithSubscription.name,
          isAdmin: false,
          createdAt: userWithSubscription.createdAt,
        },
      });
    } catch (error) {
      apiLogger.databaseOperation('session_check_error', false, {
        userId: user.id.substring(0, 8) + '***',
        error: error instanceof Error ? error.message : String(error),
      });

      return NextResponse.json({
        isAuthenticated: true,
        hasAccess: false,
        isAdmin: false,
        profile: null,
      });
    }
  },
  {
    action: 'SESSION_CHECK',
    requireRateLimit: true,
    requireCSRF: true,
  }
);
