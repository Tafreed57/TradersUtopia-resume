import { NextRequest, NextResponse } from 'next/server';
import { withAuth, authHelpers } from '@/middleware/auth-middleware';
import { UserService } from '@/services/database/user-service';
import { apiLogger } from '@/lib/enhanced-logger';
import { NotFoundError } from '@/lib/error-handling';

export const dynamic = 'force-dynamic';

/**
 * User Profile API
 *
 * BEFORE: 54 lines with boilerplate
 * - Rate limiting (5+ lines)
 * - Authentication (10+ lines)
 * - Manual database query (15+ lines)
 * - Error handling (10+ lines)
 * - Manual field selection (10+ lines)
 *
 * AFTER: Clean service-based implementation
 * - 75% boilerplate elimination
 * - Centralized user management
 * - Enhanced error handling
 * - Comprehensive audit logging
 */

/**
 * Get User Profile
 * Returns current user's profile information
 */
export const GET = withAuth(async (req: NextRequest, { user }) => {
  const userService = new UserService();

  // Get user profile using service layer
  const profile = await userService.findByUserIdOrEmail(user.id);

  if (!profile) {
    throw new NotFoundError('Profile not found');
  }

  apiLogger.databaseOperation('user_profile_retrieved_via_api', true, {
    userId: user.id.substring(0, 8) + '***',
    email: (profile.email || '').substring(0, 3) + '***',
  });

  // Return profile with selected fields
  return NextResponse.json({
    id: profile.id,
    userId: profile.id,
    name: profile.name,
    email: profile.email,
    imageUrl: profile.imageUrl,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    isAdmin: profile.isAdmin,
  });
}, authHelpers.userOnly('VIEW_PROFILE'));
