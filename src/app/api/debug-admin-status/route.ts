import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await currentUser();

    if (!user) {
      return NextResponse.json({
        authenticated: false,
        error: 'Not authenticated',
      });
    }

    // Get user info from Clerk
    const clerkInfo = {
      id: user.id,
      email: user.emailAddresses[0]?.emailAddress,
      firstName: user.firstName,
      lastName: user.lastName,
    };

    // Find the user's profile in database
    const profile = await db.profile.findFirst({
      where: { userId: user.id },
    });

    // Get all profiles to see if there are multiple entries
    const allUserProfiles = await db.profile.findMany({
      where: {
        OR: [
          { userId: user.id },
          { email: user.emailAddresses[0]?.emailAddress },
        ],
      },
    });

    return NextResponse.json({
      authenticated: true,
      clerkInfo,
      primaryProfile: profile,
      allMatchingProfiles: allUserProfiles,
      profileExists: !!profile,
      isAdmin: profile?.isAdmin || false,
      timestamp: new Date().toISOString(),
      debug: {
        profileId: profile?.id,
        profileCreatedAt: profile?.createdAt,
        profileUpdatedAt: profile?.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error in debug admin status:', error);
    return NextResponse.json(
      {
        error: 'Failed to check admin status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
