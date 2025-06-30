import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";


// Mark this route as dynamic to prevent static generation
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  try {
    const user = await currentUser();
    console.log(
      "🔍 [2FA-STATUS] Checking 2FA status for user:",
      user?.id || "none",
    );

    if (!user) {
      console.log("❌ [2FA-STATUS] No authenticated user");
      return NextResponse.json({
        authenticated: false,
        requires2FA: false,
        verified: false,
      });
    }

    // Check if user has 2FA enabled by directly querying the database
    const profile = await db.profile.findUnique({
      where: {
        userId: user.id,
      },
      select: {
        twoFactorEnabled: true,
        email: true,
      },
    });

    if (!profile) {
      console.log("❌ [2FA-STATUS] Profile not found for user:", user.id);
      return NextResponse.json({
        authenticated: true,
        requires2FA: false,
        verified: true,
        error: "Profile not found",
      });
    }

    console.log(
      "👤 [2FA-STATUS] Profile found - 2FA enabled:",
      profile.twoFactorEnabled,
      "for user:",
      profile.email,
    );

    if (!profile.twoFactorEnabled) {
      console.log("ℹ️ [2FA-STATUS] 2FA not enabled, allowing access");
      return NextResponse.json({
        authenticated: true,
        requires2FA: false,
        verified: true,
      });
    }

    // Check if 2FA verification cookie exists (server-side only)
    const cookieStore = cookies();
    const verificationCookie = cookieStore.get("2fa-verified");
    const isVerified = verificationCookie?.value === "true";

    console.log(
      "🍪 [2FA-STATUS] Cookie check - exists:",
      !!verificationCookie,
      "value:",
      verificationCookie?.value,
      "verified:",
      isVerified,
    );
    console.log(
      "📍 [2FA-STATUS] IP:",
      request.headers.get("x-forwarded-for") || "unknown",
    );

    const result = {
      authenticated: true,
      requires2FA: true,
      verified: isVerified,
    };

    console.log("📊 [2FA-STATUS] Final result:", result);

    return NextResponse.json(result);
  } catch (error) {
    console.error("❌ [2FA-STATUS] 2FA status check error:", error);
    return NextResponse.json(
      {
        authenticated: false,
        requires2FA: false,
        verified: false,
        error: "Internal server error",
      },
      { status: 500 },
    );
  }
}
