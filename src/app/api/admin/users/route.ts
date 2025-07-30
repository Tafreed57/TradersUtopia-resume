import { NextRequest, NextResponse } from 'next/server';
import { withAuth, authHelpers } from '@/middleware/auth-middleware';
import { UserService } from '@/services/database/user-service';
import { apiLogger } from '@/lib/enhanced-logger';

export const dynamic = 'force-dynamic';

/**
 * Admin Users List API
 */
export const GET = withAuth(async (req: NextRequest, { user, isAdmin }) => {
  const userService = new UserService();

  // Parse pagination parameters
  const searchParams = new URL(req.url).searchParams;
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get('limit') || '50'))
  );
  const offset = (page - 1) * limit;

  // Fetch users with subscription data using proper relationships
  const { users, total: totalCount } = await userService.listUsers({
    offset,
    limit,
    includeSubscription: true,
  });

  apiLogger.databaseOperation('admin_users_list_fetched', true, {
    requestedBy: user.id.substring(0, 8) + '***',
    userCount: users.length,
    totalCount,
    page,
    limit,
  });

  // Format user data for admin panel
  const formattedUsers = users.map((userWithSub: any) => {
    const subscription = userWithSub.subscription;

    return {
      id: userWithSub.id,
      name: userWithSub.name,
      email: userWithSub.email,
      imageUrl: userWithSub.imageUrl,
      isAdmin: userWithSub.isAdmin,
      createdAt: userWithSub.createdAt,
      updatedAt: userWithSub.updatedAt,

      // Subscription information from proper relationship
      subscription: subscription
        ? {
            id: subscription.id,
            stripeSubscriptionId: subscription.stripeSubscriptionId,
            stripeCustomerId: subscription.stripeCustomerId,
            status: subscription.status,
            currentPeriodEnd: subscription.currentPeriodEnd,
            createdAt: subscription.createdAt,
            updatedAt: subscription.updatedAt,
          }
        : null,

      // Simple subscription status for quick reference
      subscriptionStatus: subscription?.status || 'FREE',
      hasActiveSubscription:
        subscription?.status === 'ACTIVE' ||
        subscription?.status === 'TRIALING',
    };
  });

  const activeSubscriptions = formattedUsers.filter(
    u => u.hasActiveSubscription
  ).length;

  apiLogger.databaseOperation('admin_users_formatted', true, {
    requestedBy: user.id.substring(0, 8) + '***',
    totalUsers: formattedUsers.length,
    activeSubscriptions,
  });

  return NextResponse.json({
    success: true,
    users: formattedUsers,
    pagination: {
      page,
      limit,
      total: totalCount,
      hasMore: offset + limit < totalCount,
    },
    summary: {
      totalUsers: totalCount,
      activeSubscriptions,
      freeUsers: totalCount - activeSubscriptions,
    },
  });
}, authHelpers.adminOnly('ADMIN_USERS_LIST'));
