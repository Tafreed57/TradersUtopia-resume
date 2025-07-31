import { NextRequest, NextResponse } from 'next/server';
import { withAuth, authHelpers } from '@/middleware/auth-middleware';
import { SectionService } from '@/services/database/section-service';
import { apiLogger } from '@/lib/enhanced-logger';
import { ValidationError } from '@/lib/error-handling';
import { z } from 'zod';

// Support both individual section reordering and bulk reordering
const reorderSectionSchema = z.union([
  // Individual section reorder (from drag-drop)
  z.object({
    sectionId: z.string().cuid(),
    newPosition: z.number().min(0),
    newParentId: z.string().cuid().nullable().optional(),
  }),
  // Bulk section reorder (existing API)
  z.object({
    sectionOrder: z.array(z.string().cuid()).min(1),
  }),
]);

/**
 * Reorder Sections
 * Admin-only operation with transaction safety
 */
export const PATCH = withAuth(async (req: NextRequest, { user, isAdmin }) => {
  console.log('[API] Section reorder - Auth check:', {
    userId: user.id?.substring(0, 8) + '***',
    isAdmin,
  });

  // Only global admins can reorder sections
  if (!isAdmin) {
    console.log('[API] Section reorder - Access denied: not admin');
    throw new ValidationError('Only administrators can reorder sections');
  }

  // Extract serverId from URL path
  const url = new URL(req.url);
  const pathSegments = url.pathname.split('/');
  const serverId = pathSegments[pathSegments.indexOf('servers') + 1];

  if (!serverId) {
    throw new ValidationError('Server ID is required');
  }

  // Step 1: Input validation
  const body = await req.json();
  console.log('[API] Section reorder - Raw body:', body);

  const validationResult = reorderSectionSchema.safeParse(body);
  if (!validationResult.success) {
    console.error(
      '[API] Section reorder - Validation error:',
      validationResult.error
    );
    throw new ValidationError(
      'Invalid reorder data: ' +
        validationResult.error.issues.map(i => i.message).join(', ')
    );
  }

  const data = validationResult.data;
  console.log('[API] Section reorder - Validated data:', data);

  const sectionService = new SectionService();
  let result;

  if ('sectionOrder' in data) {
    // Bulk reordering (existing functionality)
    console.log('[API] Section reorder - Bulk reordering mode');
    const { sectionOrder } = data;

    result = await sectionService.reorderSections(
      serverId,
      sectionOrder,
      user.id
    );
    console.log('[API] Section reorder - Bulk result:', result);

    apiLogger.databaseOperation('sections_reordered_via_api', true, {
      serverId: serverId.substring(0, 8) + '***',
      adminId: user.id.substring(0, 8) + '***',
      sectionCount: sectionOrder.length,
      newOrder: sectionOrder.map(id => id.substring(0, 8) + '***'),
      reorderType: 'bulk',
    });
  } else {
    // Individual section reordering (from drag-drop)
    console.log('[API] Section reorder - Individual reordering mode');
    const { sectionId, newPosition, newParentId } = data;

    console.log('[API] Section reorder - Processing reorder request:', {
      serverId: serverId.substring(0, 8) + '***',
      sectionId: sectionId.substring(0, 8) + '***',
      newPosition,
      newParentId: newParentId ? newParentId.substring(0, 8) + '***' : null,
    });

    result = await sectionService.reorderSection(
      sectionId,
      serverId,
      newPosition,
      newParentId || null,
      user.id!
    );

    console.log('[API] Section reorder - Operation completed:', {
      success: result,
    });

    apiLogger.databaseOperation('section_reordered_via_api', result, {
      serverId: serverId.substring(0, 8) + '***',
      adminId: user.id!.substring(0, 8) + '***',
      sectionId: sectionId.substring(0, 8) + '***',
      newPosition,
      newParentId: newParentId ? newParentId.substring(0, 8) + '***' : null,
      reorderType: 'individual',
    });
  }

  console.log('[API] Section reorder - Success, returning result');
  return NextResponse.json({
    success: 'sectionOrder' in data ? true : result,
    message:
      'sectionOrder' in data
        ? 'Sections reordered successfully'
        : result
        ? 'Section reordered successfully'
        : 'Section reorder failed',
    result,
  });
}, authHelpers.adminOnly('REORDER_SECTIONS'));
