import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const user = await currentUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { reason } = await request.json();

    console.log(`🚫 Revoking access for user: ${user.emailAddresses[0]?.emailAddress}`);
    console.log(`📝 Reason: ${reason}`);

    // Find the user's profile
    const profile = await db.profile.findFirst({
      where: { userId: user.id }
    });

    if (!profile) {
      console.log('❌ No profile found for user');
      return NextResponse.json({
        success: false,
        message: 'User profile not found'
      });
    }

    // Update subscription status to revoked/expired
    const updatedProfile = await db.profile.update({
      where: { id: profile.id },
      data: {
        subscriptionStatus: 'EXPIRED',
        subscriptionEnd: new Date(), // Set to now (expired)
        // Keep Stripe data for reference but mark as expired
      }
    });

    console.log(`✅ Access revoked for user: ${updatedProfile.email}`);
    console.log(`📅 Subscription marked as expired`);

    return NextResponse.json({
      success: true,
      message: 'Access successfully revoked',
      profile: {
        id: updatedProfile.id,
        subscriptionStatus: updatedProfile.subscriptionStatus,
        subscriptionEnd: updatedProfile.subscriptionEnd,
      }
    });

  } catch (error) {
    console.error('❌ Error revoking access:', error);
    
    return NextResponse.json({ 
      success: false,
      message: `Failed to revoke access: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 