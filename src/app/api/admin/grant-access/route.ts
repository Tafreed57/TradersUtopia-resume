import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const user = await currentUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Find or create the user's profile
    let profile = await db.profile.findFirst({
      where: { userId: user.id }
    });

    if (!profile) {
      const userEmail = user.emailAddresses[0]?.emailAddress;
      if (!userEmail) {
        return NextResponse.json({ error: 'No email found' }, { status: 400 });
      }

      profile = await db.profile.create({
        data: {
          userId: user.id,
          name: `${user.firstName} ${user.lastName}`,
          email: userEmail,
          imageUrl: user.imageUrl,
          isAdmin: true, // Grant admin access immediately
        }
      });
    } else {
      // Update existing profile to grant admin access
      profile = await db.profile.update({
        where: { id: profile.id },
        data: {
          isAdmin: true,
        }
      });
    }

    console.log(`🔑 Admin access granted to user: ${profile.email}`);

    return NextResponse.json({
      success: true,
      message: 'Admin access granted successfully!',
      profile: {
        id: profile.id,
        isAdmin: profile.isAdmin,
        email: profile.email
      }
    });

  } catch (error) {
    console.error('Error granting admin access:', error);
    return NextResponse.json({ 
      error: 'Failed to grant admin access',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 