import { NextRequest, NextResponse } from 'next/server';
import { withAuth, authHelpers } from '@/middleware/auth-middleware';
import { UserService } from '@/services/database/user-service';
import { apiLogger } from '@/lib/enhanced-logger';

export const dynamic = 'force-dynamic';

/**
 * Check User Payment/Subscription Status
 * Returns comprehensive subscription and access information using the latest subscription model
 */
export const GET = withAuth(async (req: NextRequest, { user }) => {
  const userService = new UserService();

  try {
    // Step 1: Get user's subscription status using the service layer
    const subscriptionStatus = await userService.getUserSubscriptionStatus(
      user.id
    );

    // Step 2: Get additional subscription details if needed
    const subscriptionExpiry = await userService.getSubscriptionExpiryInfo(
      user.id
    );

    apiLogger.databaseOperation('payment_status_checked', true, {
      userId: user.id.substring(0, 8) + '***',
      hasAccess: subscriptionStatus.hasActiveSubscription,
      subscriptionStatus: subscriptionStatus.status,
      currentPeriodEnd: subscriptionStatus.currentPeriodEnd,
      isExpired: subscriptionExpiry.isExpired,
      isInGracePeriod: subscriptionExpiry.isInGracePeriod,
    });

    return NextResponse.json({
      hasAccess: subscriptionStatus.hasActiveSubscription,
      subscriptionStatus: subscriptionStatus.status,
      subscriptionEnd: subscriptionStatus.currentPeriodEnd,
      reason: subscriptionStatus.hasActiveSubscription
        ? 'Active subscription'
        : `No active subscription (${subscriptionStatus.status})`,
      stripeSubscriptionId: subscriptionStatus.stripeSubscriptionId,
    });
  } catch (error) {
    apiLogger.databaseOperation('payment_status_check_error', false, {
      userId: user.id.substring(0, 8) + '***',
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      {
        hasAccess: false,
        reason: 'Error checking subscription status',
        subscriptionStatus: 'ERROR',
        debug: {
          userId: user.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      { status: 500 }
    );
  }
}, authHelpers.userOnly('CHECK_PAYMENT_STATUS'));
