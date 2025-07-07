import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { rateLimitServer } from '@/lib/rate-limit';
import { MemberRole } from '@prisma/client';
import { z } from 'zod';

const paramsSchema = z.object({
  serverId: z.string().min(1),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { serverId: string } }
) {
  try {
    // Rate limiting - Use server operations limits for mobile data sync
    const rateLimitResult = await rateLimitServer()(req);
    if (!rateLimitResult.success) {
      return rateLimitResult.error;
    }

    // Authentication
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Validate params
    const validatedParams = paramsSchema.parse(params);
    const { serverId } = validatedParams;

    // Get user's profile first
    const profile = await db.profile.findUnique({
      where: { userId },
    });

    if (!profile) {
      return new NextResponse('Profile not found', { status: 404 });
    }

    // Check if user is a member of this server
    const member = await db.member.findFirst({
      where: {
        profileId: profile.id,
        serverId,
      },
    });

    if (!member) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    // Get If-Modified-Since header for conditional requests
    const ifModifiedSince = req.headers.get('if-modified-since');

    // Get the latest modification time for this server
    const serverModified = await db.server.findUnique({
      where: { id: serverId },
      select: {
        updatedAt: true,
      },
    });

    if (!serverModified) {
      return new NextResponse('Server not found', { status: 404 });
    }

    const lastModifiedTime = serverModified.updatedAt.toISOString();

    // Check if client has the latest version
    if (ifModifiedSince && ifModifiedSince === lastModifiedTime) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          'Last-Modified': lastModifiedTime,
        },
      });
    }

    // Fetch server data with sections and channels
    const server = await db.server.findUnique({
      where: { id: serverId },
      include: {
        sections: {
          include: {
            channels: {
              orderBy: { position: 'asc' },
            },
            children: {
              include: {
                channels: {
                  orderBy: { position: 'asc' },
                },
              },
              orderBy: { position: 'asc' },
            },
          },
          orderBy: { position: 'asc' },
        },
        channels: {
          where: { sectionId: null },
          orderBy: { position: 'asc' },
        },
        members: {
          include: {
            profile: true,
          },
          orderBy: { role: 'asc' },
        },
      },
    });

    if (!server) {
      return new NextResponse('Server not found', { status: 404 });
    }

    // Build nested section structure
    const buildSectionTree = (
      sections: any[],
      parentId: string | null = null
    ): any[] => {
      return sections
        .filter(section => section.parentId === parentId)
        .map(section => ({
          ...section,
          children: buildSectionTree(sections, section.id),
        }));
    };

    const sectionsWithChannels = buildSectionTree(server.sections);

    // Return the structured data with last modified time
    const responseData = {
      server: {
        id: server.id,
        name: server.name,
        imageUrl: server.imageUrl,
        inviteCode: server.inviteCode,
      },
      sections: sectionsWithChannels,
      channels: server.channels, // Channels not in any section
      members: server.members,
      lastModified: lastModifiedTime,
    };

    return new NextResponse(JSON.stringify(responseData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Last-Modified': lastModifiedTime,
        'Cache-Control': 'no-cache, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Mobile data API error:', error);

    if (error instanceof z.ZodError) {
      return new NextResponse('Invalid request parameters', { status: 400 });
    }

    return new NextResponse('Internal server error', { status: 500 });
  }
}
