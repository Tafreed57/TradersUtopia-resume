import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { rateLimitAdmin, trackSuspiciousActivity } from "@/lib/rate-limit";
import {
  validateInput,
  revokeAccessSchema,
  secureTextInput,
} from "@/lib/validation";


// Mark this route as dynamic to prevent static generation
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  try {
    // ✅ SECURITY: Rate limiting for admin operations
    const rateLimitResult = await rateLimitAdmin()(request);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(request, "REVOKE_RATE_LIMIT_EXCEEDED");
      return rateLimitResult.error;
    }

    // ✅ SECURITY: Authentication check
    const user = await currentUser();
    if (!user) {
      trackSuspiciousActivity(request, "UNAUTHENTICATED_REVOKE_ACCESS");
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // ✅ SECURITY: Input validation
    const validationResult = await validateInput(revokeAccessSchema)(request);
    if (!validationResult.success) {
      trackSuspiciousActivity(request, "INVALID_REVOKE_INPUT");
      return validationResult.error;
    }

    const { reason } = validationResult.data;

    // ✅ SECURITY: Sanitize reason input
    const reasonCheck = secureTextInput(reason);
    if (reasonCheck.threats.length) {
      console.warn(
        `🚨 [SECURITY] Suspicious revoke reason: ${reasonCheck.threats.join(", ")}`,
      );
      trackSuspiciousActivity(
        request,
        `REVOKE_REASON_THREATS_${reasonCheck.threats.join("_")}`,
      );
      return NextResponse.json(
        {
          error: "Invalid reason format",
          message: "The reason contains invalid content",
        },
        { status: 400 },
      );
    }

    // ✅ SECURITY: Enhanced logging for access revocation
    console.log(
      `🚫 [REVOKE] Revoking access for user: ${user.emailAddresses[0]?.emailAddress || user.id}`,
    );
    console.log(`📝 [REVOKE] Reason: ${reasonCheck.clean}`);
    console.log(
      `📍 [REVOKE] IP: ${request.headers.get("x-forwarded-for") || "unknown"}`,
    );
    console.log(
      `🖥️ [REVOKE] User Agent: ${request.headers.get("user-agent")?.slice(0, 100) || "unknown"}`,
    );

    // Find the user's profile
    const profile = await db.profile.findFirst({
      where: { userId: user.id },
    });

    if (!profile) {
      console.log("❌ [REVOKE] No profile found for user");
      trackSuspiciousActivity(request, "REVOKE_PROFILE_NOT_FOUND");
      return NextResponse.json(
        {
          success: false,
          message: "User profile not found",
          error: "Profile does not exist",
        },
        { status: 404 },
      );
    }

    // ✅ SECURITY: Enhanced database operation with error handling
    let updatedProfile;
    try {
      // Update subscription status to revoked/expired
      updatedProfile = await db.profile.update({
        where: { id: profile.id },
        data: {
          subscriptionStatus: "EXPIRED",
          subscriptionEnd: new Date(), // Set to now (expired)
          // Keep Stripe data for reference but mark as expired
        },
      });
    } catch (dbError) {
      console.error("❌ [REVOKE] Database update error:", dbError);
      trackSuspiciousActivity(request, "REVOKE_DB_ERROR");

      return NextResponse.json(
        {
          success: false,
          message: "Failed to revoke access",
          error: "Database operation failed",
        },
        { status: 500 },
      );
    }

    // ✅ SECURITY: Log successful revocation
    console.log(`✅ [REVOKE] Access revoked for user: ${updatedProfile.email}`);
    console.log(
      `📅 [REVOKE] Subscription marked as expired at: ${updatedProfile.subscriptionEnd}`,
    );
    console.log(
      `🔒 [REVOKE] Previous status: ${profile.subscriptionStatus} → New status: ${updatedProfile.subscriptionStatus}`,
    );

    return NextResponse.json({
      success: true,
      message: "Access successfully revoked",
      profile: {
        id: updatedProfile.id,
        subscriptionStatus: updatedProfile.subscriptionStatus,
        subscriptionEnd: updatedProfile.subscriptionEnd,
        email: updatedProfile.email,
      },
      operation: {
        performedBy: user.id,
        reason: reasonCheck.clean,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("❌ [REVOKE] Error revoking access:", error);
    trackSuspiciousActivity(request, "REVOKE_OPERATION_ERROR");

    return NextResponse.json(
      {
        success: false,
        message: "Failed to revoke access",
        error: "An internal error occurred while processing the request",
      },
      { status: 500 },
    );
  }
}
