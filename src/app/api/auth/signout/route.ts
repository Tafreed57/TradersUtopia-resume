import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { rateLimitAuth, trackSuspiciousActivity } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    // ✅ SECURITY: Rate limiting for authentication operations
    const rateLimitResult = await rateLimitAuth()(request);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(request, "AUTH_SIGNOUT_RATE_LIMIT_EXCEEDED");
      return rateLimitResult.error;
    }

    // ✅ SECURITY: Force clear the 2FA verification cookie with explicit settings
    const cookieStore = cookies();

    // Delete the cookie with all possible paths and settings
    cookieStore.delete("2fa-verified");

    // Set an expired cookie to force deletion across all browsers
    cookieStore.set("2fa-verified", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 0, // Expire immediately
      expires: new Date(0), // Set expiry to past date
      path: "/",
    });

    // ✅ SECURITY: Log signout operation
    console.log(`👋 [AUTH] User signed out successfully`);
    console.log(`🔒 [AUTH] 2FA verification cookie cleared`);
    console.log(
      `📍 [AUTH] IP: ${request.headers.get("x-forwarded-for") || "unknown"}`,
    );

    return NextResponse.json({
      success: true,
      message: "2FA session cleared",
    });
  } catch (error) {
    console.error("Sign-out cleanup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
