import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { rateLimitServer, trackSuspiciousActivity } from "@/lib/rate-limit";
import { strictCSRFValidation } from "@/lib/csrf";

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // CSRF protection for admin operations
    const csrfValid = await strictCSRFValidation(request);
    if (!csrfValid) {
      trackSuspiciousActivity(request, "ADMIN_TOGGLE_CSRF_VALIDATION_FAILED");
      return NextResponse.json(
        {
          error: "CSRF validation failed",
          message: "Invalid security token. Please refresh and try again.",
        },
        { status: 403 },
      );
    }

    // Rate limiting for admin operations
    const rateLimitResult = await rateLimitServer()(request);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(request, "ADMIN_TOGGLE_RATE_LIMIT_EXCEEDED");
      return rateLimitResult.error;
    }

    const user = await currentUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Find the admin's profile and check admin status
    const adminProfile = await db.profile.findFirst({
      where: { userId: user.id },
    });

    if (!adminProfile || !adminProfile.isAdmin) {
      trackSuspiciousActivity(request, "NON_ADMIN_TOGGLE_ATTEMPT");
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 },
      );
    }

    const { userId, grantAdmin } = await request.json();

    if (!userId || typeof grantAdmin !== "boolean") {
      return NextResponse.json(
        { error: "User ID and grantAdmin boolean are required" },
        { status: 400 },
      );
    }

    // Prevent self-modification (admins can't revoke their own admin status)
    if (userId === user.id) {
      return NextResponse.json(
        { error: "Cannot modify your own admin status" },
        { status: 400 },
      );
    }

    // Find the target user
    const targetProfile = await db.profile.findFirst({
      where: { userId },
    });

    if (!targetProfile) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const action = grantAdmin ? "granting" : "revoking";
    const actionPast = grantAdmin ? "granted" : "revoked";

    console.log(
      `👑 [ADMIN] Admin ${adminProfile.email} is ${action} admin privileges ${grantAdmin ? "to" : "from"} ${targetProfile.email} (${userId})`,
    );

    // Update admin status in database
    await db.profile.update({
      where: { userId },
      data: {
        isAdmin: grantAdmin,
        updatedAt: new Date(),
      },
    });

    console.log(
      `🗄️ [ADMIN] Updated admin status for user ${userId} to ${grantAdmin}`,
    );

    // Log this significant action
    console.log(
      `✅ [ADMIN] Successfully ${actionPast} admin privileges ${grantAdmin ? "to" : "from"} ${targetProfile.email} by admin ${adminProfile.email}`,
    );

    return NextResponse.json({
      success: true,
      message: `Admin privileges ${actionPast} successfully`,
      updatedUser: {
        userId: targetProfile.userId,
        email: targetProfile.email,
        name: targetProfile.name,
        isAdmin: grantAdmin,
        action: actionPast,
      },
    });
  } catch (error) {
    console.error("Error toggling admin status:", error);
    trackSuspiciousActivity(request, "ADMIN_TOGGLE_ERROR");

    return NextResponse.json(
      {
        error: "Failed to update admin status",
        message: "Unable to modify admin privileges. Please try again later.",
      },
      { status: 500 },
    );
  }
}
