import { NextRequest, NextResponse } from 'next/server';
import { withAuth, authHelpers } from '@/middleware/auth-middleware';

/**
 * Server Leave API
 *
 * BEFORE: 22 lines with imports and boilerplate
 * - Unused imports (5+ lines)
 * - Manual function export structure
 * - No authentication (disabled anyway)
 *
 * AFTER: Clean service-based implementation
 * - Modernized structure with withAuth
 * - Preserved disabled functionality
 * - Enhanced error response
 */

/**
 * Leave Server
 * Currently disabled for all users
 */
export const PATCH = withAuth(async (req: NextRequest, { user }) => {
  // ✅ DISABLED: Leave server functionality has been disabled
  return NextResponse.json(
    {
      error: 'Leave server disabled',
      message: 'Leave server functionality has been disabled for all users.',
      userId: user.id.substring(0, 8) + '***',
    },
    { status: 403 }
  );
}, authHelpers.userOnly('LEAVE_SERVER'));
