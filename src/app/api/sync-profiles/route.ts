import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentUser } from "@clerk/nextjs/server";
import { rateLimitAdmin, trackSuspiciousActivity } from "@/lib/rate-limit";


// Mark this route as dynamic to prevent static generation
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  try {
    // ✅ SECURITY: Rate limiting for profile sync operations (admin level)
    const rateLimitResult = await rateLimitAdmin()(request);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(request, "PROFILE_SYNC_RATE_LIMIT_EXCEEDED");
      return rateLimitResult.error;
    }

    console.log("🔗 Starting comprehensive profile sync...\n");

    // Find all profiles
    const allProfiles = await db.profile.findMany({
      orderBy: { email: "asc" },
    });

    console.log(`📊 Found ${allProfiles.length} total profiles`);

    // Group profiles by email
    const profilesByEmail = allProfiles.reduce(
      (acc, profile) => {
        if (!acc[profile.email]) {
          acc[profile.email] = [];
        }
        acc[profile.email].push(profile);
        return acc;
      },
      {} as Record<string, typeof allProfiles>,
    );

    const duplicateEmails = Object.entries(profilesByEmail).filter(
      ([email, profiles]) => profiles.length > 1,
    );

    console.log(
      `🔍 Found ${duplicateEmails.length} emails with duplicate profiles:`,
    );

    const syncResults = [];

    for (const [email, profiles] of duplicateEmails) {
      console.log(`\n📧 Processing email: ${email}`);
      console.log(`   Found ${profiles.length} profiles:`);

      profiles.forEach((profile, index) => {
        console.log(
          `   Profile ${index + 1}: ${profile.id} (${profile.userId}) - Status: ${profile.subscriptionStatus}`,
        );
      });

      // Find ACTIVE profile
      const activeProfile = profiles.find(
        (p) => p.subscriptionStatus === "ACTIVE",
      );
      const freeProfiles = profiles.filter(
        (p) => p.subscriptionStatus === "FREE" && p.id !== activeProfile?.id,
      );

      if (activeProfile && freeProfiles.length > 0) {
        console.log(`   🎯 Found ACTIVE profile: ${activeProfile.id}`);
        console.log(`   🔄 Syncing ${freeProfiles.length} FREE profile(s)...`);

        const syncedProfiles = [];

        for (const freeProfile of freeProfiles) {
          const updated = await db.profile.update({
            where: { id: freeProfile.id },
            data: {
              subscriptionStatus: "ACTIVE",
              subscriptionStart: activeProfile.subscriptionStart,
              subscriptionEnd: activeProfile.subscriptionEnd,
              stripeCustomerId: activeProfile.stripeCustomerId,
              stripeSessionId: activeProfile.stripeSessionId,
            },
          });

          syncedProfiles.push({
            profileId: updated.id,
            userId: updated.userId,
            syncedFrom: activeProfile.id,
          });

          console.log(`   ✅ Synced profile ${updated.id} (${updated.userId})`);
        }

        syncResults.push({
          email,
          activeProfileId: activeProfile.id,
          syncedProfiles,
          subscriptionEnd: activeProfile.subscriptionEnd,
        });
      } else if (!activeProfile) {
        console.log(`   ❌ No ACTIVE profile found for ${email}`);
        syncResults.push({
          email,
          error: "No ACTIVE profile found",
          profiles: profiles.map((p) => ({
            id: p.id,
            status: p.subscriptionStatus,
          })),
        });
      } else {
        console.log(`   ℹ️  No FREE profiles to sync for ${email}`);
      }
    }

    console.log("\n🎉 Profile sync completed!");
    console.log(
      `📈 Processed ${duplicateEmails.length} duplicate email groups`,
    );
    console.log(
      `✅ Successfully synced ${syncResults.filter((r) => !r.error).length} groups`,
    );

    return NextResponse.json({
      success: true,
      message: "Profile sync completed",
      stats: {
        totalProfiles: allProfiles.length,
        duplicateEmailGroups: duplicateEmails.length,
        successfulSyncs: syncResults.filter((r) => !r.error).length,
        errors: syncResults.filter((r) => r.error).length,
      },
      results: syncResults,
    });
  } catch (error) {
    console.error("❌ Error in profile sync:", error);

    // ✅ SECURITY: Generic error response - no internal details exposed
    return NextResponse.json(
      {
        success: false,
        message: "Profile sync operation failed. Please try again later.",
      },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // ✅ SECURITY: Rate limiting for profile analysis operations
    const rateLimitResult = await rateLimitAdmin()(request);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(request, "PROFILE_ANALYSIS_RATE_LIMIT_EXCEEDED");
      return rateLimitResult.error;
    }

    const user = await currentUser();

    if (!user) {
      trackSuspiciousActivity(request, "UNAUTHENTICATED_PROFILE_ANALYSIS");
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const userEmail = user.emailAddresses[0]?.emailAddress;
    if (!userEmail) {
      return NextResponse.json({ error: "No email found" }, { status: 400 });
    }

    // Get all profiles with "FREE" status for analysis
    const freeProfiles = await db.profile.findMany({
      where: {
        subscriptionStatus: "FREE",
      },
      select: {
        id: true,
        email: true,
        name: true,
        subscriptionStatus: true,
        stripeCustomerId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    console.log(`📊 Found ${freeProfiles.length} profiles with FREE status`);

    return NextResponse.json({
      message: "Profile analysis completed",
      totalFreeProfiles: freeProfiles.length,
      profiles: freeProfiles.slice(0, 10), // Return first 10 for review
      note: "This is a read-only analysis. Use POST to perform actual sync.",
    });
  } catch (error) {
    console.error("❌ Error in profile analysis:", error);

    // ✅ SECURITY: Generic error response - no internal details exposed
    return NextResponse.json(
      {
        error: "Profile analysis failed",
        message: "Unable to analyze profiles. Please try again later.",
      },
      { status: 500 },
    );
  }
}
