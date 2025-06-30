import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    console.log("🔍 Starting payment status check...");

    // Step 1: Test Clerk authentication
    console.log("📝 Step 1: Getting current user from Clerk...");
    const user = await currentUser();

    if (!user) {
      console.log("❌ No user found from Clerk");
      return NextResponse.json(
        { hasAccess: false, reason: "Not authenticated" },
        { status: 401 },
      );
    }

    console.log("✅ User found:", user.id);

    // Step 2: Test database connection
    console.log("📝 Step 2: Connecting to database...");
    // ✅ SECURITY: Don't log environment variable information
    console.log("📊 Database connection: Attempting to connect...");

    // Step 3: Search for profile
    console.log("📝 Step 3: Searching for profile with userId:", user.id);
    const profile = await db.profile.findFirst({
      where: { userId: user.id },
    });

    if (!profile) {
      console.log("❌ No profile found for userId:", user.id);
      console.log(
        "💡 This means the user exists in Clerk but not in the database",
      );
      return NextResponse.json(
        {
          hasAccess: false,
          reason: "Profile not found in database",
          userId: user.id,
          suggestion: "User needs to be created in database",
        },
        { status: 404 },
      );
    }

    console.log(
      "✅ Profile found:",
      profile.id,
      "with status:",
      profile.subscriptionStatus,
    );

    // Step 4: Auto-sync check for duplicate profiles
    console.log("📝 Step 4: Checking for profile sync issues...");
    let currentProfile = profile;
    let autoSyncPerformed = false;

    // 🚨 SECURITY FIX: REMOVED auto-sync between accounts with same email
    // This was a major security vulnerability that allowed unauthorized access
    // Each account must have its own valid Stripe subscription
    console.log(
      "🔒 [SECURITY] Checking only the current user's specific subscription status",
    );
    console.log(
      "🔒 [SECURITY] No longer auto-syncing between accounts with same email for security",
    );

    // Step 5: Final subscription status check
    console.log("📝 Step 5: Final subscription status check...");
    const hasActiveSubscription =
      currentProfile.subscriptionStatus === "ACTIVE" &&
      currentProfile.subscriptionEnd &&
      new Date() < currentProfile.subscriptionEnd;

    console.log("Final subscription details:", {
      status: currentProfile.subscriptionStatus,
      end: currentProfile.subscriptionEnd,
      isActive: hasActiveSubscription,
      autoSyncPerformed: autoSyncPerformed,
    });

    return NextResponse.json({
      hasAccess: hasActiveSubscription,
      subscriptionStatus: currentProfile.subscriptionStatus,
      subscriptionEnd: currentProfile.subscriptionEnd,
      reason: hasActiveSubscription
        ? "Active subscription"
        : "No active subscription",
      autoSyncPerformed: autoSyncPerformed,
      debug: {
        userId: user.id,
        profileId: currentProfile.id,
        profileEmail: currentProfile.email,
      },
    });
  } catch (error) {
    console.error("❌ ERROR in payment status check:");
    console.error(
      "Error type:",
      error instanceof Error ? error.constructor.name : typeof error,
    );
    console.error(
      "Error message:",
      error instanceof Error ? error.message : String(error),
    );
    console.error(
      "Error stack:",
      error instanceof Error ? error.stack : "No stack trace",
    );

    // ✅ SECURITY: Generic error response - no internal details exposed
    return NextResponse.json(
      {
        hasAccess: false,
        reason: "Unable to check payment status at this time",
        message: "Service temporarily unavailable. Please try again later.",
      },
      { status: 500 },
    );
  }
}
