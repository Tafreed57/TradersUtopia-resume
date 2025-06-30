import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prismadb";

// Login-triggered auto sync function (same as in query.ts)
async function performLoginSync(userEmail: string) {
  try {
    console.log(`🔄 [Login Sync] Checking sync for email: ${userEmail}`);

    // Find all profiles with this email
    const allProfiles = await prisma.profile.findMany({
      where: { email: userEmail },
      orderBy: { createdAt: "desc" },
    });

    if (allProfiles.length <= 1) {
      console.log(
        `ℹ️ [Login Sync] Only ${allProfiles.length} profile(s) found for ${userEmail}, no sync needed`,
      );
      return {
        synced: false,
        reason: "Only one or no profiles found",
        profileCount: allProfiles.length,
      };
    }

    console.log(
      `🔍 [Login Sync] Found ${allProfiles.length} profiles for ${userEmail}`,
    );

    // Check if there's an ACTIVE profile to sync from
    const activeProfile = allProfiles.find(
      (p) => p.subscriptionStatus === "ACTIVE",
    );
    const freeProfiles = allProfiles.filter(
      (p) => p.subscriptionStatus === "FREE" && p.id !== activeProfile?.id,
    );

    if (activeProfile && freeProfiles.length > 0) {
      console.log(
        `✨ [Login Sync] Syncing ${freeProfiles.length} FREE profile(s) from ACTIVE profile ${activeProfile.id}`,
      );

      // Update all FREE profiles to match the ACTIVE one
      const updatePromises = freeProfiles.map(async (freeProfile) => {
        try {
          const updated = await prisma.profile.update({
            where: { id: freeProfile.id },
            data: {
              subscriptionStatus: "ACTIVE",
              subscriptionStart: activeProfile.subscriptionStart,
              subscriptionEnd: activeProfile.subscriptionEnd,
              stripeCustomerId: activeProfile.stripeCustomerId,
              stripeSessionId: activeProfile.stripeSessionId,
            },
          });
          console.log(
            `   ✅ [Login Sync] Synced profile ${updated.id} (${updated.userId})`,
          );
          return updated;
        } catch (error) {
          console.error(
            `   ❌ [Login Sync] Failed to sync profile ${freeProfile.id}:`,
            error,
          );
          return null;
        }
      });

      const results = await Promise.all(updatePromises);
      const successfulSyncs = results.filter((r) => r !== null).length;

      console.log(
        `🎉 [Login Sync] Successfully synced ${successfulSyncs} profiles for ${userEmail}`,
      );

      return {
        synced: true,
        syncedCount: successfulSyncs,
        totalProfiles: allProfiles.length,
        activeProfile: activeProfile.id,
        reason: `Synced ${successfulSyncs} FREE profile(s) to ACTIVE status`,
      };
    } else {
      const reason = activeProfile
        ? "no FREE profiles to sync"
        : "no ACTIVE profile found";
      console.log(
        `ℹ️ [Login Sync] No sync needed for ${userEmail} - ${reason}`,
      );

      return {
        synced: false,
        reason: reason,
        totalProfiles: allProfiles.length,
        activeProfiles: allProfiles.filter(
          (p) => p.subscriptionStatus === "ACTIVE",
        ).length,
        freeProfiles: allProfiles.filter((p) => p.subscriptionStatus === "FREE")
          .length,
      };
    }
  } catch (error) {
    console.error(`❌ [Login Sync] Error during sync for ${userEmail}:`, error);
    throw error;
  }
}


// Mark this route as dynamic to prevent static generation
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  try {
    const user = await currentUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const userEmail = user.primaryEmailAddress?.emailAddress;

    if (!userEmail) {
      return NextResponse.json({ error: "No email found" }, { status: 400 });
    }

    console.log(
      `🧪 [Test Login Sync] Testing login sync for user: ${userEmail}`,
    );

    const result = await performLoginSync(userEmail);

    return NextResponse.json({
      success: true,
      message: "Login sync test completed",
      email: userEmail,
      result: result,
    });
  } catch (error) {
    console.error("❌ Error in test login sync:", error);

    // ✅ SECURITY: Generic error response - no internal details exposed
    return NextResponse.json(
      {
        success: false,
        message: "Login sync test failed. Please try again later.",
      },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: "Login Sync Test Endpoint",
    usage: "POST to this endpoint while logged in to test login-triggered sync",
    description:
      "This simulates what happens when a user logs in and the system checks for profile sync",
  });
}
