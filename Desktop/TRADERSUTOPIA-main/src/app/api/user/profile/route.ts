import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { rateLimitGeneral, trackSuspiciousActivity } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  try {
    // ✅ SECURITY: Rate limiting for profile access
    const rateLimitResult = await rateLimitGeneral()(request);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(request, 'USER_PROFILE_RATE_LIMIT_EXCEEDED');
      return rateLimitResult.error;
    }

    const user = await currentUser();

    if (!user) {
      trackSuspiciousActivity(request, 'UNAUTHENTICATED_PROFILE_ACCESS');
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find the user's profile in our database
    let profile = await db.profile.findUnique({
      where: {
        userId: user.id,
      },
      select: {
        id: true,
        name: true,
        email: true,
        imageUrl: true,
        twoFactorEnabled: true,
        isAdmin: true,
        subscriptionStatus: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // If profile doesn't exist, create one for the new user
    if (!profile) {
      try {
        const userEmail = user.emailAddresses[0]?.emailAddress;
        
        if (!userEmail) {
          console.error('❌ [PROFILE] No email found for user:', user.id);
          return NextResponse.json({ error: "User email not found" }, { status: 400 });
        }

        console.log(`➕ [PROFILE] Creating new profile for user: ${userEmail} (${user.id})`);
        
        profile = await db.profile.create({
          data: {
            userId: user.id,
            name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User',
            email: userEmail,
            imageUrl: user.imageUrl || '',
            subscriptionStatus: 'FREE',
            twoFactorEnabled: false,
            isAdmin: false,
          },
          select: {
            id: true,
            name: true,
            email: true,
            imageUrl: true,
            twoFactorEnabled: true,
            isAdmin: true,
            subscriptionStatus: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        console.log(`✅ [PROFILE] Created profile for user: ${userEmail}`);
      } catch (createError) {
        console.error('❌ [PROFILE] Error creating profile:', createError);
        return NextResponse.json({ error: "Failed to create user profile" }, { status: 500 });
      }
    }

    return NextResponse.json(profile);
  } catch (error) {
    console.error("Error fetching profile:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 