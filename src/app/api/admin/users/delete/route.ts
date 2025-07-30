import { NextRequest, NextResponse } from 'next/server';
import { withAuth, authHelpers } from '@/middleware/auth-middleware';
import { UserService } from '@/services/database/user-service';
import { CustomerService } from '@/services/stripe/customer-service';
import { apiLogger } from '@/lib/enhanced-logger';
import { ValidationError, NotFoundError } from '@/lib/error-handling';
import { clerkClient } from '@clerk/nextjs/server';

/**
 * Delete User Account (Admin Only)
 * Performs complete cleanup: Database, Clerk, and Stripe
 */
export const POST = withAuth(async (req: NextRequest, { user, isAdmin }) => {
  // Only global admins can delete users
  if (!isAdmin) {
    throw new ValidationError('Admin access required for user deletion');
  }

  const body = await req.json();
  const { targetUserId } = body;

  if (!targetUserId) {
    throw new ValidationError('Target user ID is required');
  }

  // Prevent admin from deleting themselves
  if (targetUserId === user.id) {
    throw new ValidationError('Cannot delete your own account');
  }

  const userService = new UserService();
  const customerService = new CustomerService();

  // Step 1: Find target user
  const targetUser = await userService.findByUserIdOrEmail(targetUserId);
  if (!targetUser) {
    throw new NotFoundError('Target user not found');
  }

  // Prevent deleting other admins
  if (targetUser.isAdmin) {
    throw new ValidationError('Cannot delete other admin accounts');
  }

  // Step 2: Cleanup Stripe customer if exists
  let stripeCleanupResult = null;
  if (targetUser.email) {
    try {
      const stripeCustomer = await customerService.findCustomerByEmail(
        targetUser.email
      );
      if (stripeCustomer) {
        stripeCleanupResult = await customerService.deleteCustomer(
          stripeCustomer.id
        );
        apiLogger.databaseOperation('stripe_customer_deleted', true, {
          customerId: stripeCustomer.id.substring(0, 8) + '***',
          email: targetUser.email.substring(0, 3) + '***',
        });
      }
    } catch (error) {
      apiLogger.databaseOperation('stripe_customer_deletion_failed', false, {
        email: targetUser.email.substring(0, 3) + '***',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Continue with deletion even if Stripe cleanup fails
    }
  }

  // Step 3: Delete from Clerk
  let clerkCleanupResult = null;
  try {
    const clerk = await clerkClient();
    clerkCleanupResult = await clerk.users.deleteUser(targetUserId);
    apiLogger.databaseOperation('clerk_user_deleted', true, {
      userId: targetUserId.substring(0, 8) + '***',
    });
  } catch (error) {
    apiLogger.databaseOperation('clerk_user_deletion_failed', false, {
      userId: targetUserId.substring(0, 8) + '***',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    // Continue with database deletion even if Clerk cleanup fails
  }

  // Step 4: Delete from database using UserService
  let databaseCleanupResult = false;
  try {
    databaseCleanupResult = await userService.deleteUser(targetUserId);
  } catch (error) {
    apiLogger.databaseOperation('database_user_deletion_failed', false, {
      userId: targetUserId.substring(0, 8) + '***',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    // Continue with response even if database cleanup fails
  }

  apiLogger.databaseOperation('admin_user_deleted', true, {
    adminId: user.id.substring(0, 8) + '***',
    targetUserId: targetUserId.substring(0, 8) + '***',
    targetEmail: targetUser.email?.substring(0, 3) + '***',
    stripeCleanup: !!stripeCleanupResult,
    clerkCleanup: !!clerkCleanupResult,
    databaseCleanup: databaseCleanupResult,
  });

  return NextResponse.json({
    success: true,
    message: 'User deleted successfully',
    cleanup: {
      database: databaseCleanupResult,
      clerk: !!clerkCleanupResult,
      stripe: !!stripeCleanupResult,
    },
    deletedUser: {
      id: targetUser.id,
      email: targetUser.email,
      name: targetUser.name,
    },
  });
}, authHelpers.adminOnly('DELETE_USER'));
