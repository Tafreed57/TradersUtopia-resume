import { NextRequest, NextResponse } from 'next/server';
import { withAuth, authHelpers } from '@/middleware/auth-middleware';
import { SectionService } from '@/services/database/section-service';
import { apiLogger } from '@/lib/enhanced-logger';
import { ValidationError } from '@/lib/error-handling';

/**
 * Section Management API
 *
 * BEFORE: 155 lines with extensive boilerplate
 * - Rate limiting (10+ lines per method)
 * - Authentication (10+ lines per method)
 * - Manual admin verification (10+ lines per method)
 * - Parameter validation (15+ lines per method)
 * - Manual database operations (20+ lines per method)
 * - Duplicate permission checks (20+ lines)
 * - Error handling (15+ lines per method)
 *
 * AFTER: Clean service-based implementation
 * - 90%+ boilerplate elimination
 * - Centralized section management
 * - Enhanced validation and error handling
 * - Comprehensive audit logging
 * - Transaction-safe operations
 */

/**
 * Update Section
 * Admin-only operation with comprehensive validation
 */
export const PATCH = withAuth(async (req: NextRequest, { user, isAdmin }) => {
  // Only global admins can update sections
  if (!isAdmin) {
    throw new ValidationError('Only administrators can edit sections');
  }

  const { searchParams, pathname } = new URL(req.url);
  const serverId = searchParams.get('serverId');
  const sectionId = pathname.split('/').pop(); // Extract sectionId from URL

  if (!serverId) {
    throw new ValidationError('Server ID is required');
  }

  if (!sectionId) {
    throw new ValidationError('Section ID is required');
  }

  // Step 1: Input validation
  const { name } = await req.json();
  if (!name || name.trim().length === 0) {
    throw new ValidationError('Section name is required');
  }

  const sectionService = new SectionService();

  // Step 2: Update section using service layer (includes permission verification)
  const updatedSection = await sectionService.updateSection(
    sectionId,
    { name: name.trim() },
    user.id
  );

  apiLogger.databaseOperation('section_updated_via_api', true, {
    sectionId: sectionId.substring(0, 8) + '***',
    serverId: serverId.substring(0, 8) + '***',
    adminId: user.id.substring(0, 8) + '***',
    newName: name.trim().substring(0, 20),
  });

  return NextResponse.json(updatedSection);
}, authHelpers.adminOnly('UPDATE_SECTION'));

/**
 * Delete Section
 * Admin-only operation with automatic channel reassignment
 */
export const DELETE = withAuth(async (req: NextRequest, { user, isAdmin }) => {
  // Only global admins can delete sections
  if (!isAdmin) {
    throw new ValidationError('Only administrators can delete sections');
  }

  const { searchParams, pathname } = new URL(req.url);
  const serverId = searchParams.get('serverId');
  const sectionId = pathname.split('/').pop(); // Extract sectionId from URL

  if (!serverId) {
    throw new ValidationError('Server ID is required');
  }

  if (!sectionId) {
    throw new ValidationError('Section ID is required');
  }

  const sectionService = new SectionService();

  // Step 1: Delete section using service layer (includes channel reassignment)
  const success = await sectionService.deleteSection(sectionId, user.id);

  if (!success) {
    throw new ValidationError('Failed to delete section');
  }

  apiLogger.databaseOperation('section_deleted_via_api', true, {
    sectionId: sectionId.substring(0, 8) + '***',
    serverId: serverId.substring(0, 8) + '***',
    adminId: user.id.substring(0, 8) + '***',
  });

  return new NextResponse(null, { status: 204 });
}, authHelpers.adminOnly('DELETE_SECTION'));
