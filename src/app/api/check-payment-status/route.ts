import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Starting payment status check...');
    
    // Step 1: Test Clerk authentication
    console.log('📝 Step 1: Getting current user from Clerk...');
    const user = await currentUser();
    
    if (!user) {
      console.log('❌ No user found from Clerk');
      return NextResponse.json({ hasAccess: false, reason: 'Not authenticated' }, { status: 401 });
    }
    
    console.log('✅ User found:', user.id);

    // Step 2: Test database connection
    console.log('📝 Step 2: Connecting to database...');
    console.log('Database URL exists:', !!process.env.DATABASE_URL);
    
    // Step 3: Search for profile
    console.log('📝 Step 3: Searching for profile with userId:', user.id);
    const profile = await db.profile.findFirst({
      where: { userId: user.id }
    });

    if (!profile) {
      console.log('❌ No profile found for userId:', user.id);
      console.log('💡 This means the user exists in Clerk but not in the database');
      return NextResponse.json({ 
        hasAccess: false, 
        reason: 'Profile not found in database',
        userId: user.id,
        suggestion: 'User needs to be created in database'
      }, { status: 404 });
    }

    console.log('✅ Profile found:', profile.id, 'with status:', profile.subscriptionStatus);

    // Step 4: Check subscription status
    console.log('📝 Step 4: Checking subscription...');
    const hasActiveSubscription = profile.subscriptionStatus === 'ACTIVE' && 
                                 profile.subscriptionEnd && 
                                 new Date() < profile.subscriptionEnd;

    console.log('Subscription details:', {
      status: profile.subscriptionStatus,
      end: profile.subscriptionEnd,
      isActive: hasActiveSubscription
    });

    return NextResponse.json({
      hasAccess: hasActiveSubscription,
      subscriptionStatus: profile.subscriptionStatus,
      subscriptionEnd: profile.subscriptionEnd,
      reason: hasActiveSubscription ? 'Active subscription' : 'No active subscription',
      debug: {
        userId: user.id,
        profileId: profile.id,
        profileEmail: profile.email
      }
    });

  } catch (error) {
    console.error('❌ ERROR in payment status check:');
    console.error('Error type:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    return NextResponse.json({ 
      hasAccess: false, 
      reason: 'Internal server error',
      error: error instanceof Error ? error.message : String(error),
      errorType: error instanceof Error ? error.constructor.name : typeof error
    }, { status: 500 });
  }
}
