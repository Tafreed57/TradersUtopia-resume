import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { strictCSRFValidation } from "@/lib/csrf";
import { trackSuspiciousActivity } from "@/lib/rate-limit";

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // ✅ SECURITY: CSRF protection for admin operations
  const csrfValid = await strictCSRFValidation(request);
  if (!csrfValid) {
    trackSuspiciousActivity(request, "ADMIN_CSRF_VALIDATION_FAILED");
    return NextResponse.json(
      {
        error: "CSRF validation failed",
        message: "Invalid security token. Please refresh and try again.",
      },
      { status: 403 },
    );
  }
  try {
    const user = await currentUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Find the user's profile
    const profile = await db.profile.findFirst({
      where: { userId: user.id },
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    if (!profile.isAdmin) {
      return NextResponse.json(
        { error: "User is not an admin" },
        { status: 400 },
      );
    }

    // Update profile to revoke admin access
    const updatedProfile = await db.profile.update({
      where: { id: profile.id },
      data: {
        isAdmin: false,
      },
    });

    console.log(`🔒 Admin access revoked for user: ${profile.email}`);

    return NextResponse.json({
      success: true,
      message: "Admin access revoked successfully!",
      profile: {
        id: updatedProfile.id,
        isAdmin: updatedProfile.isAdmin,
        email: updatedProfile.email,
      },
    });
  } catch (error) {
    console.error("Error revoking admin access:", error);

    // ✅ SECURITY: Generic error response - no internal details exposed
    return NextResponse.json(
      {
        error: "Failed to revoke admin access",
        message: "An internal error occurred. Please try again later.",
      },
      { status: 500 },
    );
  }
}
