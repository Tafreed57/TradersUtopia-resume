import { NextRequest, NextResponse } from 'next/server';
import { withAuth, authHelpers } from '@/middleware/auth-middleware';
import { SectionService } from '@/services/database/section-service';
import { apiLogger } from '@/lib/enhanced-logger';
import { ValidationError } from '@/lib/error-handling';
import { z } from 'zod';

const sectionCreationSchema = z.object({
  name: z.string().min(1, 'Section name is required').max(100),
});

/**
 * Create Section in Server
 * Admin-only operation with automatic positioning
 */
export const POST = withAuth(async (req: NextRequest, { user, isAdmin }) => {
  // Only global admins can create sections
  if (!isAdmin) {
    throw new ValidationError('Only administrators can create sections');
  }

  const serverId = req.nextUrl.searchParams.get('serverId');
  if (!serverId) {
    throw new ValidationError('Server ID is required');
  }

  // Step 1: Input validation
  const body = await req.json();
  const validationResult = sectionCreationSchema.safeParse(body);
  if (!validationResult.success) {
    throw new ValidationError('Invalid section data');
  }

  const { name } = validationResult.data;
  const sectionService = new SectionService();

  // Step 2: Create section using service layer (includes permission verification)
  const section = await sectionService.createSection(
    {
      name,
      serverId,
    },
    user.id
  );

  apiLogger.databaseOperation('section_created_via_api', true, {
    sectionId: section.id.substring(0, 8) + '***',
    serverId: serverId.substring(0, 8) + '***',
    adminId: user.id.substring(0, 8) + '***',
    name: name.substring(0, 20),
    position: section.position,
  });

  return NextResponse.json(section);
}, authHelpers.adminOnly('CREATE_SECTION'));
