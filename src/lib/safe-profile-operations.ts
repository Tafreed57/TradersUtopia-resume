import { UserService } from '@/services/database/user-service';
import { apiLogger, logger } from '@/lib/enhanced-logger';
import { maskId } from '@/lib/error-handling';

/**
 * Safely grant admin access using the centralized UserService
 */
export async function safeGrantAdmin(targetUserId: string): Promise<boolean> {
  try {
    const userService = new UserService();

    // Find the user first
    const user = await userService.findByUserIdOrEmail(targetUserId);

    if (!user) {
      apiLogger.databaseOperation('safe_grant_admin_failed', false, {
        userId: maskId(targetUserId),
        reason: 'User not found',
      });
      return false;
    }

    // If already admin, return true
    if (user.isAdmin) {
      apiLogger.adminAction('grant_admin_already_admin', 'system', user.email, {
        userId: maskId(targetUserId),
      });
      return true;
    }

    // Grant admin status
    await userService.updateUser(user.id, { isAdmin: true });

    apiLogger.adminAction('grant_admin_success', 'system', user.email, {
      userId: maskId(targetUserId),
    });

    return true;
  } catch (error) {
    logger.error('Safe grant admin error', {
      userId: maskId(targetUserId),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}
