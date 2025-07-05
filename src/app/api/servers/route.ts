import { prisma } from '@/lib/prismadb';
import { getCurrentProfile } from '@/lib/query';
import { MemberRole } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { rateLimitServer, trackSuspiciousActivity } from '@/lib/rate-limit';
import { validateInput, serverCreationSchema } from '@/lib/validation';
import { currentUser } from '@clerk/nextjs/server';

// Force dynamic rendering due to rate limiting using request.headers
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // ✅ SECURITY: Rate limiting for server operations
    const rateLimitResult = await rateLimitServer()(req);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(req, 'SERVER_CREATION_RATE_LIMIT_EXCEEDED');
      return rateLimitResult.error;
    }

    // ✅ SECURITY: Input validation for server creation
    const validationResult = await validateInput(serverCreationSchema)(req);
    if (!validationResult.success) {
      trackSuspiciousActivity(req, 'INVALID_SERVER_CREATION_INPUT');
      return validationResult.error;
    }

    const { name, imageUrl } = validationResult.data;
    const profile = await getCurrentProfile();
    if (!profile) {
      trackSuspiciousActivity(req, 'UNAUTHENTICATED_SERVER_CREATION');
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // ✅ ENHANCEMENT: Check if user is admin for auto-adding all users
    const isAdmin = profile.isAdmin;

    console.log(
      `🏰 [SERVER] Creating server "${name}" by ${isAdmin ? 'ADMIN' : 'USER'}: ${profile.email}`
    );

    const server = await prisma.server.create({
      data: {
        profileId: profile.id,
        name,
        imageUrl,
        inviteCode: uuidv4(),
        channels: {
          create: [{ name: 'general', profileId: profile.id }],
        },
        members: {
          create: [{ role: MemberRole.ADMIN, profileId: profile.id }],
        },
      },
    });

    // ✅ ENHANCEMENT: If admin creates server, auto-add all existing users
    if (isAdmin) {
      console.log(
        `👥 [SERVER] Admin created server "${name}" - auto-adding all users...`
      );

      // Get all existing profiles except the creator (already added)
      const allProfiles = await prisma.profile.findMany({
        where: {
          id: {
            not: profile.id, // Exclude creator
          },
        },
        select: {
          id: true,
          email: true,
          isAdmin: true,
        },
      });

      // Auto-add all users to the admin-created server
      if (allProfiles.length > 0) {
        const memberData = allProfiles.map(userProfile => ({
          profileId: userProfile.id,
          serverId: server.id,
          role: userProfile.isAdmin ? MemberRole.ADMIN : MemberRole.GUEST,
        }));

        await prisma.member.createMany({
          data: memberData,
          skipDuplicates: true, // Prevent duplicate memberships
        });

        console.log(
          `✅ [SERVER] Auto-added ${allProfiles.length} users to admin-created server "${name}"`
        );
        console.log(
          `📊 [SERVER] Added ${allProfiles.filter(p => p.isAdmin).length} admins and ${allProfiles.filter(p => !p.isAdmin).length} guests`
        );
      } else {
        console.log(
          `ℹ️ [SERVER] No other users found to auto-add to admin-created server "${name}"`
        );
      }
    }

    // ✅ SECURITY: Log successful server creation
    console.log(
      `🏰 [SERVER] Server created successfully: "${name}" (ID: ${server.id})`
    );
    console.log(`📝 [SERVER] Created by: ${profile.email} (${profile.id})`);
    console.log(`🔑 [SERVER] Invite code: ${server.inviteCode}`);

    return NextResponse.json(server);
  } catch (error) {
    console.error('❌ [SERVER] Server creation error:', error);
    trackSuspiciousActivity(req, 'SERVER_CREATION_DATABASE_ERROR');
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
