import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { rateLimitAuth, trackSuspiciousActivity } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    // ✅ SECURITY: Rate limiting for authentication operations
    const rateLimitResult = await rateLimitAuth()(request);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(request, 'AUTH_SIGNOUT_RATE_LIMIT_EXCEEDED');
      return rateLimitResult.error;
    }

    // Clear the 2FA verification cookie
    const cookieStore = cookies();
    cookieStore.delete('2fa-verified');

    // ✅ SECURITY: Log signout operation
    console.log(`👋 [AUTH] User signed out successfully`);
    console.log(`📍 [AUTH] IP: ${request.headers.get('x-forwarded-for') || 'unknown'}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Sign-out cleanup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 