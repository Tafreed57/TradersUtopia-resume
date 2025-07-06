import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prismadb';
import { z } from 'zod';
import { rateLimitDragDrop, trackSuspiciousActivity } from '@/lib/rate-limit';
import { MemberRole } from '@prisma/client';
import { strictCSRFValidation } from '@/lib/csrf';

const reorderSectionSchema = z.object({
  serverId: z.string(),
  sectionId: z.string(),
  newPosition: z.number().min(0),
  newParentId: z.string().nullable().optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    // ✅ SECURITY FIX: Add CSRF protection
    const csrfValid = await strictCSRFValidation(req);
    if (!csrfValid) {
      trackSuspiciousActivity(req, 'SECTION_REORDER_CSRF_FAILED');
      return NextResponse.json(
        {
          error: 'CSRF validation failed',
          message: 'Invalid security token. Please refresh and try again.',
        },
        { status: 403 }
      );
    }

    // Rate limiting
    const rateLimitResult = await rateLimitDragDrop()(req);
    if (!rateLimitResult.success) {
      return rateLimitResult.error;
    }

    // Authentication
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Input validation
    const body = await req.json();
    const { serverId, sectionId, newPosition, newParentId } =
      reorderSectionSchema.parse(body);

    // Get current profile
    const profile = await prisma.profile.findUnique({
      where: { userId },
    });

    if (!profile) {
      return new NextResponse('Profile not found', { status: 404 });
    }

    // Check if user is member of the server with appropriate permissions
    const member = await prisma.member.findFirst({
      where: {
        profileId: profile.id,
        serverId: serverId,
      },
    });

    if (!member || member.role === MemberRole.GUEST) {
      return new NextResponse('Insufficient permissions', { status: 403 });
    }

    // Get the section being moved
    const section = await prisma.section.findUnique({
      where: {
        id: sectionId,
        serverId: serverId,
      },
    });

    if (!section) {
      return new NextResponse('Section not found', { status: 404 });
    }

    // Prevent circular references - a section cannot be its own parent or child
    if (newParentId) {
      if (newParentId === sectionId) {
        return new NextResponse('A section cannot be its own parent', {
          status: 400,
        });
      }

      // Check if the new parent exists and is in the same server
      const parentSection = await prisma.section.findUnique({
        where: {
          id: newParentId,
          serverId: serverId,
        },
      });

      if (!parentSection) {
        return new NextResponse('Parent section not found', { status: 404 });
      }

      // Check if the section being moved is an ancestor of the new parent
      // (to prevent circular references)
      const isAncestor = await checkIfAncestor(sectionId, newParentId);
      if (isAncestor) {
        return new NextResponse('Cannot create circular reference', {
          status: 400,
        });
      }
    }

    // Use transaction to ensure consistency
    const result = await prisma.$transaction(async tx => {
      // Get current sections at the target level (same parent)
      const targetSections = await tx.section.findMany({
        where: {
          serverId: serverId,
          parentId: newParentId || null,
          NOT: {
            id: sectionId,
          },
        },
        orderBy: {
          position: 'asc',
        },
      });

      // Update positions of existing sections to make room
      const updates = [];
      for (let i = 0; i < targetSections.length; i++) {
        const targetSection = targetSections[i];
        const newPos = i >= newPosition ? i + 1 : i;

        if (targetSection.position !== newPos) {
          updates.push(
            tx.section.update({
              where: { id: targetSection.id },
              data: { position: newPos },
            })
          );
        }
      }

      // Wait for all position updates
      await Promise.all(updates);

      // Update the moved section
      const updatedSection = await tx.section.update({
        where: { id: sectionId },
        data: {
          position: newPosition,
          parentId: newParentId || null,
        },
      });

      return updatedSection;
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Section reorder error:', error);

    if (error instanceof z.ZodError) {
      return new NextResponse('Invalid input', { status: 400 });
    }

    return new NextResponse('Internal server error', { status: 500 });
  }
}

// Helper function to check if a section is an ancestor of another section
async function checkIfAncestor(
  ancestorId: string,
  descendantId: string
): Promise<boolean> {
  const descendant = await prisma.section.findUnique({
    where: { id: descendantId },
    include: { parent: true },
  });

  if (!descendant || !descendant.parent) {
    return false;
  }

  if (descendant.parent.id === ancestorId) {
    return true;
  }

  // Recursively check parent chain
  return await checkIfAncestor(ancestorId, descendant.parent.id);
}
