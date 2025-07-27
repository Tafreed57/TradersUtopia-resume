import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/middleware/auth-middleware';
import { apiLogger } from '@/lib/enhanced-logger';
import { UserService } from '@/services/database/user-service';

// Validation schema for access control operations
const accessControlSchema = z.object({
  action: z.enum(['grant', 'revoke'], {
    required_error: 'Action is required',
    invalid_type_error: 'Action must be either "grant" or "revoke"',
  }),
  targetUserId: z.string().optional(),
  reason: z.string().max(500, 'Reason too long').optional(),
});

export const dynamic = 'force-dynamic';

/**
 * Unified Admin Access Control Endpoint
 * Consolidates grant-access and revoke-access functionality
 *
 * @route POST /api/admin/access-control
 * @description Manages admin privilege granting and revoking with comprehensive audit logging
 * @security Requires admin authentication, CSRF protection, rate limiting
 */
export const POST = withAuth(
  async (req: NextRequest, { user, isAdmin }) => {
    try {
      // Only global admins can modify admin access
      if (!isAdmin) {
        apiLogger.securityViolation('unauthorized_admin_access_attempt', req, {
          userId: user.id.substring(0, 8) + '***',
          action: 'access_control',
          timestamp: new Date().toISOString(),
        });
        return NextResponse.json(
          { error: 'Admin access required' },
          { status: 403 }
        );
      }

      // Step 1: Input validation
      const body = await req.json();
      const validationResult = accessControlSchema.safeParse(body);
      if (!validationResult.success) {
        return NextResponse.json(
          {
            error: 'Invalid access control data',
            details: validationResult.error.issues
              .map(i => i.message)
              .join(', '),
          },
          { status: 400 }
        );
      }

      const { action, targetUserId, reason } = validationResult.data;
      const userService = new UserService();

      // Step 2: Handle different access control actions
      if (action === 'grant') {
        // Grant admin access (requires target user ID)
        if (!targetUserId) {
          return NextResponse.json(
            { error: 'Target user ID is required for granting admin access' },
            { status: 400 }
          );
        }

        // Prevent self-modification
        if (targetUserId === user.id) {
          return NextResponse.json(
            { error: 'Cannot modify your own admin status' },
            { status: 400 }
          );
        }

        // Find target user
        const targetProfile =
          await userService.findByUserIdOrEmail(targetUserId);
        if (!targetProfile) {
          return NextResponse.json(
            { error: 'Target user not found' },
            { status: 404 }
          );
        }

        if (targetProfile.isAdmin) {
          return NextResponse.json(
            { error: 'User is already an admin' },
            { status: 400 }
          );
        }

        // Grant admin access
        await userService.updateUser(targetProfile.id, {
          isAdmin: true,
        });

        apiLogger.databaseOperation('admin_privileges_granted', true, {
          adminId: user.id.substring(0, 8) + '***',
          targetUserId: targetUserId.substring(0, 8) + '***',
          targetEmail: (targetProfile.email || '').substring(0, 3) + '***',
          reason: reason || 'No reason provided',
        });

        return NextResponse.json({
          success: true,
          action: 'granted',
          message: `Admin access granted to user successfully`,
          profile: {
            id: targetProfile.id,
            email: targetProfile.email,
            isAdmin: true,
          },
        });
      } else if (action === 'revoke') {
        // Revoke admin access (can be self or target user)
        const revokeUserId = targetUserId || user.id;

        // Find user to revoke access from
        const revokeProfile =
          await userService.findByUserIdOrEmail(revokeUserId);
        if (!revokeProfile) {
          return NextResponse.json(
            { error: 'User not found' },
            { status: 404 }
          );
        }

        if (!revokeProfile.isAdmin) {
          return NextResponse.json(
            { error: 'User is not an admin' },
            { status: 400 }
          );
        }

        // Revoke admin access
        await userService.updateUser(revokeProfile.id, {
          isAdmin: false,
        });

        apiLogger.databaseOperation('admin_privileges_revoked', true, {
          adminId: user.id.substring(0, 8) + '***',
          targetUserId: revokeUserId.substring(0, 8) + '***',
          targetEmail: (revokeProfile.email || '').substring(0, 3) + '***',
          reason: reason || 'No reason provided',
          selfRevocation: revokeUserId === user.id,
        });

        return NextResponse.json({
          success: true,
          action: 'revoked',
          message:
            revokeUserId === user.id
              ? 'Your admin access has been revoked successfully'
              : 'Admin access revoked from user successfully',
          profile: {
            id: revokeProfile.id,
            email: revokeProfile.email,
            isAdmin: false,
          },
        });
      }

      return NextResponse.json(
        { error: 'Invalid action specified' },
        { status: 400 }
      );
    } catch (error) {
      console.error(
        '❌ [ADMIN-ACCESS] Error in access control endpoint:',
        error
      );

      apiLogger.databaseOperation('admin_access_control_error', false, {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: user.id.substring(0, 8) + '***',
      });

      return NextResponse.json(
        {
          error: 'Admin access control failed',
          message: 'An internal error occurred. Please try again later.',
        },
        { status: 500 }
      );
    }
  },
  {
    action: 'admin_access_control',
    requireAdmin: true,
    requireCSRF: true,
    requireRateLimit: true,
    allowedMethods: ['POST'],
  }
);
