import { NextRequest, NextResponse } from 'next/server';
import { withAuth, authHelpers } from '@/middleware/auth-middleware';
import { UserService } from '@/services/database/user-service';
import { apiLogger } from '@/lib/enhanced-logger';
import { ValidationError, NotFoundError } from '@/lib/error-handling';
import { z } from 'zod';

const toggleAdminSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  grantAdmin: z.boolean(),
});

/**
 * Toggle Admin Status
 * Admin-only operation with user profile updates
 */
export const POST = withAuth(async (req: NextRequest, { user }) => {
  // Step 1: Input validation
  const body = await req.json();
  const validationResult = toggleAdminSchema.safeParse(body);
  if (!validationResult.success) {
    throw new ValidationError(
      'Invalid admin toggle data: ' +
        validationResult.error.issues.map(i => i.message).join(', ')
    );
  }

  const { userId: targetUserId, grantAdmin } = validationResult.data;

  // Prevent self-modification
  if (targetUserId === user.id) {
    throw new ValidationError('Cannot modify your own admin status');
  }

  const userService = new UserService();

  // Step 2: Find target user using service layer
  const targetProfile = await userService.findByUserIdOrEmail(targetUserId);
  if (!targetProfile) {
    throw new NotFoundError('User not found');
  }

  const actionPast = grantAdmin ? 'granted' : 'revoked';

  // Step 3: Handle admin granting/revoking
  if (grantAdmin) {
    // Use safe admin granting function from UserService
    const success = await userService.grantAdminStatus(targetUserId);
    if (!success) {
      throw new ValidationError('Failed to grant admin access');
    }

    apiLogger.databaseOperation('admin_privileges_granted', true, {
      adminId: user.id.substring(0, 8) + '***',
      targetUserId: targetUserId.substring(0, 8) + '***',
      targetEmail: (targetProfile.email || '').substring(0, 3) + '***',
    });
  } else {
    // Revoke admin status - update user profile using service layer
    await userService.updateUser(targetProfile.id, {
      isAdmin: false,
    });

    apiLogger.databaseOperation('admin_privileges_revoked', true, {
      adminId: user.id.substring(0, 8) + '***',
      targetUserId: targetUserId.substring(0, 8) + '***',
      targetEmail: (targetProfile.email || '').substring(0, 3) + '***',
    });
  }

  // TODO: Restore complex server membership updates once schema is confirmed
  console.log(
    `✅ [ADMIN] Admin privileges ${actionPast} for user: ${targetProfile.email}`
  );

  return NextResponse.json({
    success: true,
    message: `Admin privileges ${actionPast} successfully`,
    updatedUser: {
      userId: targetProfile.id,
      email: targetProfile.email,
      name: targetProfile.name,
      isAdmin: grantAdmin,
      action: actionPast,
    },
  });
}, authHelpers.adminOnly('TOGGLE_ADMIN_STATUS'));
