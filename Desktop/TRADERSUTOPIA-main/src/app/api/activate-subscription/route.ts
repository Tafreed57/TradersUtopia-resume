import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const user = await currentUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    console.log('Activating subscription for user:', {
      userId: user.id,
      email: user.emailAddresses[0]?.emailAddress,
      name: `${user.firstName} ${user.lastName}`,
    });

    // Find or create the user's profile
    let profile = await db.profile.findFirst({
      where: { userId: user.id }
    });

    if (!profile) {
      // Create profile if it doesn't exist
      profile = await db.profile.create({
        data: {
          userId: user.id,
          name: `${user.firstName} ${user.lastName}`,
          email: user.emailAddresses[0]?.emailAddress || '',
          imageUrl: user.imageUrl,
          subscriptionStatus: 'FREE',
        }
      });
      console.log('Created new profile:', profile.id);
    }

    // Activate the subscription
    const updatedProfile = await db.profile.update({
      where: { id: profile.id },
      data: {
        subscriptionStatus: 'ACTIVE',
        subscriptionStart: new Date(),
        subscriptionEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      }
    });

    console.log('✅ Successfully activated subscription for user:', updatedProfile.email);

    return NextResponse.json({
      success: true,
      message: 'Subscription activated successfully!',
      profile: {
        id: updatedProfile.id,
        name: updatedProfile.name,
        email: updatedProfile.email,
        subscriptionStatus: updatedProfile.subscriptionStatus,
        subscriptionStart: updatedProfile.subscriptionStart,
        subscriptionEnd: updatedProfile.subscriptionEnd,
      }
    });

  } catch (error) {
    console.error('Error activating subscription:', error);
    
    // ✅ SECURITY: Generic error response - no internal details exposed
    return NextResponse.json({ 
      error: 'Failed to activate subscription',
      message: 'Unable to process subscription activation. Please try again later.'
    }, { status: 500 });
  }
} 