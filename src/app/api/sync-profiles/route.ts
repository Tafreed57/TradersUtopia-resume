import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    console.log('🔗 Starting comprehensive profile sync...\n');
    
    // Find all profiles
    const allProfiles = await db.profile.findMany({
      orderBy: { email: 'asc' }
    });
    
    console.log(`📊 Found ${allProfiles.length} total profiles`);
    
    // Group profiles by email
    const profilesByEmail = allProfiles.reduce((acc, profile) => {
      if (!acc[profile.email]) {
        acc[profile.email] = [];
      }
      acc[profile.email].push(profile);
      return acc;
    }, {} as Record<string, typeof allProfiles>);
    
    const duplicateEmails = Object.entries(profilesByEmail).filter(([email, profiles]) => profiles.length > 1);
    
    console.log(`🔍 Found ${duplicateEmails.length} emails with duplicate profiles:`);
    
    const syncResults = [];
    
    for (const [email, profiles] of duplicateEmails) {
      console.log(`\n📧 Processing email: ${email}`);
      console.log(`   Found ${profiles.length} profiles:`);
      
      profiles.forEach((profile, index) => {
        console.log(`   Profile ${index + 1}: ${profile.id} (${profile.userId}) - Status: ${profile.subscriptionStatus}`);
      });
      
      // Find ACTIVE profile
      const activeProfile = profiles.find(p => p.subscriptionStatus === 'ACTIVE');
      const freeProfiles = profiles.filter(p => p.subscriptionStatus === 'FREE' && p.id !== activeProfile?.id);
      
      if (activeProfile && freeProfiles.length > 0) {
        console.log(`   🎯 Found ACTIVE profile: ${activeProfile.id}`);
        console.log(`   🔄 Syncing ${freeProfiles.length} FREE profile(s)...`);
        
        const syncedProfiles = [];
        
        for (const freeProfile of freeProfiles) {
          const updated = await db.profile.update({
            where: { id: freeProfile.id },
            data: {
              subscriptionStatus: 'ACTIVE',
              subscriptionStart: activeProfile.subscriptionStart,
              subscriptionEnd: activeProfile.subscriptionEnd,
              stripeCustomerId: activeProfile.stripeCustomerId,
              stripeSessionId: activeProfile.stripeSessionId,
            }
          });
          
          syncedProfiles.push({
            profileId: updated.id,
            userId: updated.userId,
            syncedFrom: activeProfile.id
          });
          
          console.log(`   ✅ Synced profile ${updated.id} (${updated.userId})`);
        }
        
        syncResults.push({
          email,
          activeProfileId: activeProfile.id,
          syncedProfiles,
          subscriptionEnd: activeProfile.subscriptionEnd
        });
      } else if (!activeProfile) {
        console.log(`   ❌ No ACTIVE profile found for ${email}`);
        syncResults.push({
          email,
          error: 'No ACTIVE profile found',
          profiles: profiles.map(p => ({ id: p.id, status: p.subscriptionStatus }))
        });
      } else {
        console.log(`   ℹ️  No FREE profiles to sync for ${email}`);
      }
    }
    
    console.log('\n🎉 Profile sync completed!');
    console.log(`📈 Processed ${duplicateEmails.length} duplicate email groups`);
    console.log(`✅ Successfully synced ${syncResults.filter(r => !r.error).length} groups`);
    
    return NextResponse.json({
      success: true,
      message: 'Profile sync completed',
      stats: {
        totalProfiles: allProfiles.length,
        duplicateEmailGroups: duplicateEmails.length,
        successfulSyncs: syncResults.filter(r => !r.error).length,
        errors: syncResults.filter(r => r.error).length
      },
      results: syncResults
    });
    
  } catch (error) {
    console.error('❌ Error in profile sync:', error);
    return NextResponse.json({ 
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    // Just analyze without making changes
    const allProfiles = await db.profile.findMany({
      orderBy: { email: 'asc' }
    });
    
    const profilesByEmail = allProfiles.reduce((acc, profile) => {
      if (!acc[profile.email]) {
        acc[profile.email] = [];
      }
      acc[profile.email].push(profile);
      return acc;
    }, {} as Record<string, typeof allProfiles>);
    
    const duplicateEmails = Object.entries(profilesByEmail).filter(([email, profiles]) => profiles.length > 1);
    
    const analysis = duplicateEmails.map(([email, profiles]) => ({
      email,
      totalProfiles: profiles.length,
      activeProfiles: profiles.filter(p => p.subscriptionStatus === 'ACTIVE').length,
      freeProfiles: profiles.filter(p => p.subscriptionStatus === 'FREE').length,
      needsSync: profiles.filter(p => p.subscriptionStatus === 'ACTIVE').length > 0 && 
                 profiles.filter(p => p.subscriptionStatus === 'FREE').length > 0,
      profiles: profiles.map(p => ({
        id: p.id,
        userId: p.userId,
        status: p.subscriptionStatus,
        subscriptionEnd: p.subscriptionEnd
      }))
    }));
    
    return NextResponse.json({
      analysis: true,
      stats: {
        totalProfiles: allProfiles.length,
        uniqueEmails: Object.keys(profilesByEmail).length,
        duplicateEmailGroups: duplicateEmails.length,
        groupsNeedingSync: analysis.filter(a => a.needsSync).length
      },
      duplicateGroups: analysis
    });
    
  } catch (error) {
    console.error('❌ Error in profile analysis:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 