import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prismadb';
import { rateLimitGeneral } from '@/lib/rate-limit';
import { z } from 'zod';

const MESSAGES_BATCH = 10;

// Schema for creating track record messages
const createMessageSchema = z.object({
  content: z.string().min(1).max(4000),
  fileUrl: z.string().optional(),
});

// GET - Fetch track record messages (public access)
export async function GET(req: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimitGeneral()(req);
    if (!rateLimitResult.success) {
      return new NextResponse('Rate limit exceeded', { status: 429 });
    }

    const { searchParams } = new URL(req.url);
    const cursor = searchParams.get('cursor');

    let messages = await prisma.trackRecordMessage.findMany({
      take: MESSAGES_BATCH,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        admin: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
          },
        },
      },
      where: {
        deleted: false,
      },
    });

    let nextCursor = null;

    if (messages.length === MESSAGES_BATCH) {
      nextCursor = messages[MESSAGES_BATCH - 1].id;
    }

    return NextResponse.json({
      items: messages,
      nextCursor,
    });
  } catch (error) {
    console.error('TRACK_RECORD_MESSAGES_GET', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

// POST - Create track record message (admin only)
export async function POST(req: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimitGeneral()(req);
    if (!rateLimitResult.success) {
      return new NextResponse('Rate limit exceeded', { status: 429 });
    }

    // Authentication required for posting
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Check if user is admin
    const profile = await prisma.profile.findUnique({
      where: { userId },
      select: { id: true, isAdmin: true },
    });

    if (!profile || !profile.isAdmin) {
      return new NextResponse('Forbidden - Admin access required', {
        status: 403,
      });
    }

    // Validate input
    const body = await req.json();
    const validatedData = createMessageSchema.parse(body);

    // Create track record message
    const message = await prisma.trackRecordMessage.create({
      data: {
        content: validatedData.content,
        fileUrl: validatedData.fileUrl,
        adminId: profile.id,
      },
      include: {
        admin: {
          select: {
            id: true,
            name: true,
            imageUrl: true,
          },
        },
      },
    });

    return NextResponse.json(message);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new NextResponse('Invalid input', { status: 400 });
    }

    console.error('TRACK_RECORD_MESSAGES_POST', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
