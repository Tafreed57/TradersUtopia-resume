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

    // Step 4: Auto-sync check for duplicate profiles
    console.log('📝 Step 4: Checking for profile sync issues...');
    let currentProfile = profile;
    let autoSyncPerformed = false;

    // If current user has FREE status, check for ACTIVE profiles with same email
    if (currentProfile.subscriptionStatus === 'FREE') {
      console.log('🔍 User has FREE status, checking for ACTIVE profiles with same email...');
      
      const userEmail = user.emailAddresses[0]?.emailAddress;
      if (userEmail) {
        console.log('📧 Checking email:', userEmail);
        
        // Find all profiles with this email
        const allProfiles = await db.profile.findMany({
          where: { email: userEmail }
        });
        
        console.log(`📊 Found ${allProfiles.length} profile(s) with email ${userEmail}`);
        
        // Look for an ACTIVE profile
        const activeProfile = allProfiles.find(p => 
          p.subscriptionStatus === 'ACTIVE' && 
          p.id !== currentProfile.id
        );
        
        if (activeProfile) {
          console.log('🎯 Found ACTIVE profile to sync from:', activeProfile.id);
          console.log('🔗 Auto-syncing subscription data...');
          
          // Auto-sync the subscription data
          currentProfile = await db.profile.update({
            where: { id: currentProfile.id },
            data: {
              subscriptionStatus: 'ACTIVE',
              subscriptionStart: activeProfile.subscriptionStart,
              subscriptionEnd: activeProfile.subscriptionEnd,
              stripeCustomerId: activeProfile.stripeCustomerId,
              stripeSessionId: activeProfile.stripeSessionId,
            }
          });
          
          autoSyncPerformed = true;
          console.log('✅ Auto-sync completed! Current profile now has ACTIVE status');
          console.log('📅 Subscription valid until:', currentProfile.subscriptionEnd);
        } else {
          console.log('❌ No ACTIVE profile found for auto-sync');
        }
      }
    }

    // Step 5: Final subscription status check
    console.log('📝 Step 5: Final subscription status check...');
    const hasActiveSubscription = currentProfile.subscriptionStatus === 'ACTIVE' && 
                                 currentProfile.subscriptionEnd && 
                                 new Date() < currentProfile.subscriptionEnd;

    console.log('Final subscription details:', {
      status: currentProfile.subscriptionStatus,
      end: currentProfile.subscriptionEnd,
      isActive: hasActiveSubscription,
      autoSyncPerformed: autoSyncPerformed
    });

    return NextResponse.json({
      hasAccess: hasActiveSubscription,
      subscriptionStatus: currentProfile.subscriptionStatus,
      subscriptionEnd: currentProfile.subscriptionEnd,
      reason: hasActiveSubscription ? 'Active subscription' : 'No active subscription',
      autoSyncPerformed: autoSyncPerformed,
      debug: {
        userId: user.id,
        profileId: currentProfile.id,
        profileEmail: currentProfile.email
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
