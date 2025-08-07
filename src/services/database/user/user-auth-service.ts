import { BaseDatabaseService } from '../base-service';
import { User } from '../../types';
import { maskEmail, maskId } from '@/lib/error-handling';

/**
 * UserAuthService - Handles user authentication and permission verification
 *
 * Consolidates authentication logic with comprehensive audit logging for security compliance.
 * Contains only methods that are actively used in the codebase.
 */
export class UserAuthService extends BaseDatabaseService {
  /**
   * Find user by userId or email - Most critical method (used 35+ times)
   * Replaces scattered profile lookup implementations across the codebase
   */
  async findByUserIdOrEmail(userIdOrEmail: string): Promise<User | null> {
    this.validateRequired(userIdOrEmail, 'userIdOrEmail');

    try {
      const user = await this.prisma.user.findFirst({
        where: {
          OR: [{ id: userIdOrEmail }, { email: userIdOrEmail }],
        },
      });

      // Log with security context
      this.logSuccess('user_lookup', {
        found: !!user,
        isAdmin: user?.isAdmin || false,
        identifier: userIdOrEmail.includes('@')
          ? maskEmail(userIdOrEmail)
          : maskId(userIdOrEmail),
      });

      // Convert null to undefined for TypeScript compatibility
      return user
        ? ({
            ...user,
            imageUrl: user.imageUrl ?? undefined,
          } as User)
        : null;
    } catch (error) {
      return this.handleError(error, 'find_user_by_id_or_email', {
        identifier: userIdOrEmail.includes('@')
          ? maskEmail(userIdOrEmail)
          : maskId(userIdOrEmail),
      });
    }
  }

  /**
   * Admin checks - used 15+ times with security logging
   * Returns user only if they are admin, null otherwise
   */
  async findAdminById(userId: string): Promise<User | null> {
    const user = await this.findByUserIdOrEmail(userId);

    if (!user) {
      return null;
    }

    // Only return user if they are admin
    if (!user.isAdmin) {
      // Log security event for failed admin check
      this.logSuccess('admin_check', {
        userId: maskId(userId),
        isAdmin: false,
        accessDenied: true,
      });
      return null;
    }

    // Log successful admin verification
    this.logSuccess('admin_check', {
      userId: maskId(userId),
      isAdmin: true,
      accessGranted: true,
    });

    return user;
  }

  /**
   * Check if user is admin (boolean result)
   * Used for quick permission checks
   */
  async isUserAdmin(userId: string): Promise<boolean> {
    const user = await this.findByUserIdOrEmail(userId);
    const isAdmin = user?.isAdmin || false;

    this.logSuccess('admin_check', {
      userId: maskId(userId),
      isAdmin,
      userFound: !!user,
    });

    return isAdmin;
  }

  /**
   * Find user by Clerk user ID
   * Most common lookup pattern - delegates to findByUserIdOrEmail
   */
  async findByClerkId(clerkUserId: string): Promise<User | null> {
    return await this.findByUserIdOrEmail(clerkUserId);
  }

  /**
   * Grant admin status to user (admin-only operation)
   * Used in admin management operations
   */
  async grantAdminStatus(targetUserId: string): Promise<boolean> {
    this.validateRequired(targetUserId, 'targetUserId');

    try {
      const user = await this.findByUserIdOrEmail(targetUserId);
      if (!user) {
        this.logSuccess('grant_admin_failed', {
          targetUserId: maskId(targetUserId),
          reason: 'User not found',
        });
        return false;
      }

      if (user.isAdmin) {
        this.logSuccess('grant_admin_redundant', {
          targetUserId: maskId(targetUserId),
          reason: 'User already admin',
        });
        return true; // Already admin, consider successful
      }

      await this.prisma.user.update({
        where: { id: user.id },
        data: { isAdmin: true },
      });

      this.logSuccess('admin_status_granted', {
        targetUserId: maskId(targetUserId),
        email: maskEmail(user.email),
      });

      return true;
    } catch (error) {
      return this.handleError(error, 'grant_admin_status', {
        targetUserId: maskId(targetUserId),
      });
    }
  }
}
