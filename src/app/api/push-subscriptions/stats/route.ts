import { NextRequest, NextResponse } from 'next/server';
import { withAuth, authHelpers } from '@/middleware/auth-middleware';
import { apiLogger } from '@/lib/enhanced-logger';
import { ValidationError } from '@/lib/error-handling';
import { getPushSubscriptionStats } from '@/lib/push-notifications';
import { UserService } from '@/services/database/user-service';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * Get Push Subscription Statistics
 * Returns detailed stats about a user's push subscriptions
 */
export const GET = withAuth(async (req: NextRequest, { user, isAdmin }) => {
  const url = new URL(req.url);
  const targetUserId = url.searchParams.get('userId');

  // Regular users can only see their own stats, admins can see any user's stats
  const userIdToCheck = targetUserId && isAdmin ? targetUserId : user.id;

  try {
    const stats = await getPushSubscriptionStats(userIdToCheck);

    if (!stats) {
      apiLogger.databaseOperation('push_stats_no_subscriptions', true, {
        userId: userIdToCheck.substring(0, 8) + '***',
        requestedBy: user.id.substring(0, 8) + '***',
      });

      return NextResponse.json({
        userId: userIdToCheck,
        stats: {
          total: 0,
          active: 0,
          inactive: 0,
          highFailureCount: 0,
          recentlyActive: 0,
        },
        message: 'No push subscriptions found for this user',
      });
    }

    apiLogger.databaseOperation('push_stats_retrieved', true, {
      userId: userIdToCheck.substring(0, 8) + '***',
      requestedBy: user.id.substring(0, 8) + '***',
      isAdmin,
      totalSubscriptions: stats.total,
      activeSubscriptions: stats.active,
    });

    return NextResponse.json({
      userId: userIdToCheck,
      stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    apiLogger.databaseOperation('push_stats_error', false, {
      userId: userIdToCheck.substring(0, 8) + '***',
      requestedBy: user.id.substring(0, 8) + '***',
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        error: 'Failed to retrieve push subscription statistics',
        message: 'An error occurred while fetching subscription stats',
      },
      { status: 500 }
    );
  }
}, authHelpers.userOnly('VIEW_PUSH_STATS'));

/**
 * Clean Up Push Subscriptions (Admin Only)
 * Deactivates subscriptions with high failure counts
 */
export const POST = withAuth(async (req: NextRequest, { user, isAdmin }) => {
  // Only admins can perform cleanup operations
  if (!isAdmin) {
    throw new ValidationError(
      'Only administrators can perform push subscription cleanup'
    );
  }

  const body = await req.json();
  const { targetUserId, maxFailureCount = 5, inactiveDays = 30 } = body;

  try {
    const userService = new UserService();

    let cleanupResults;
    if (targetUserId) {
      // Clean up specific user
      cleanupResults = await cleanupUserPushSubscriptions(
        targetUserId,
        maxFailureCount,
        inactiveDays
      );
    } else {
      // Clean up all users (system-wide cleanup)
      cleanupResults = await performSystemWideCleanup(
        maxFailureCount,
        inactiveDays
      );
    }

    apiLogger.databaseOperation('push_cleanup_completed', true, {
      adminId: user.id.substring(0, 8) + '***',
      targetUserId: targetUserId?.substring(0, 8) + '***' || 'system-wide',
      maxFailureCount,
      inactiveDays,
      deactivatedCount: cleanupResults.deactivated,
      processedUsers: cleanupResults.processedUsers,
    });

    return NextResponse.json({
      success: true,
      message: 'Push subscription cleanup completed',
      results: cleanupResults,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    apiLogger.databaseOperation('push_cleanup_error', false, {
      adminId: user.id.substring(0, 8) + '***',
      targetUserId: targetUserId?.substring(0, 8) + '***' || 'system-wide',
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        error: 'Failed to perform push subscription cleanup',
        message: 'An error occurred during the cleanup operation',
      },
      { status: 500 }
    );
  }
}, authHelpers.adminOnly('MANAGE_PUSH_SUBSCRIPTIONS'));

/**
 * Helper function to clean up push subscriptions for a specific user
 */
async function cleanupUserPushSubscriptions(
  userId: string,
  maxFailureCount: number,
  inactiveDays: number
): Promise<{ deactivated: number; processedUsers: number }> {
  const userService = new UserService();
  const cutoffDate = new Date(Date.now() - inactiveDays * 24 * 60 * 60 * 1000);

  // Get user's subscriptions
  const user = await userService.getUserWithPushSubscriptions(userId);
  if (!user || !user.pushSubscriptions) {
    return { deactivated: 0, processedUsers: 0 };
  }

  let deactivatedCount = 0;

  // Deactivate subscriptions that meet cleanup criteria
  for (const subscription of user.pushSubscriptions) {
    if (
      subscription.isActive &&
      (subscription.failureCount >= maxFailureCount ||
        subscription.lastActive < cutoffDate)
    ) {
      await userService.deactivatePushSubscription(subscription.id);
      deactivatedCount++;
    }
  }

  return { deactivated: deactivatedCount, processedUsers: 1 };
}

/**
 * Helper function to perform system-wide push subscription cleanup
 */
async function performSystemWideCleanup(
  maxFailureCount: number,
  inactiveDays: number
): Promise<{ deactivated: number; processedUsers: number }> {
  const userService = new UserService();
  const cutoffDate = new Date(Date.now() - inactiveDays * 24 * 60 * 60 * 1000);

  // Get all users with push subscriptions
  const usersWithSubscriptions = await userService.prisma.user.findMany({
    where: {
      pushSubscriptions: {
        some: {
          isActive: true,
        },
      },
    },
    select: {
      id: true,
      pushSubscriptions: {
        where: {
          isActive: true,
        },
        select: {
          id: true,
          failureCount: true,
          lastActive: true,
        },
      },
    },
  });

  let totalDeactivated = 0;
  let processedUsers = 0;

  // Process each user
  for (const user of usersWithSubscriptions) {
    let userDeactivated = 0;

    for (const subscription of user.pushSubscriptions) {
      if (
        subscription.failureCount >= maxFailureCount ||
        subscription.lastActive < cutoffDate
      ) {
        await userService.deactivatePushSubscription(subscription.id);
        userDeactivated++;
      }
    }

    if (userDeactivated > 0) {
      totalDeactivated += userDeactivated;
      processedUsers++;
    }
  }

  return { deactivated: totalDeactivated, processedUsers };
}
