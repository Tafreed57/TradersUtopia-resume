import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { TOTP } from "otpauth";
import { createNotification } from "@/lib/notifications";
import { rateLimit2FA, trackSuspiciousActivity } from "@/lib/rate-limit";
import {
  validateInput,
  twoFactorCodeSchema,
  secureTextInput,
} from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    // ✅ SECURITY: Rate limiting for 2FA operations
    const rateLimitResult = await rateLimit2FA()(request);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(request, "2FA_DISABLE_RATE_LIMIT_EXCEEDED");
      return rateLimitResult.error;
    }

    // ✅ SECURITY: Authentication check
    const user = await currentUser();
    if (!user) {
      trackSuspiciousActivity(request, "UNAUTHENTICATED_2FA_DISABLE");
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // ✅ SECURITY: Input validation
    const validationResult = await validateInput(twoFactorCodeSchema)(request);
    if (!validationResult.success) {
      trackSuspiciousActivity(request, "INVALID_2FA_DISABLE_INPUT");
      return validationResult.error;
    }

    const { code } = validationResult.data;

    // ✅ SECURITY: Sanitize code input
    const codeCheck = secureTextInput(code);
    if (codeCheck.threats.length) {
      console.warn(
        `🚨 [SECURITY] Suspicious 2FA disable code: ${codeCheck.threats.join(", ")}`,
      );
      trackSuspiciousActivity(request, "SUSPICIOUS_2FA_DISABLE_INPUT");
      return NextResponse.json(
        {
          error: "Invalid code format",
          message: "The code contains invalid characters",
        },
        { status: 400 },
      );
    }

    // Find the user's profile
    const profile = await db.profile.findFirst({
      where: { userId: user.id },
    });

    if (!profile) {
      trackSuspiciousActivity(request, "2FA_DISABLE_PROFILE_NOT_FOUND");
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    if (!profile.twoFactorEnabled || !profile.twoFactorSecret) {
      trackSuspiciousActivity(request, "2FA_DISABLE_NOT_ENABLED");
      return NextResponse.json(
        {
          error: "2FA is not enabled",
          message:
            "Two-factor authentication is not currently enabled for this account",
        },
        { status: 400 },
      );
    }

    // ✅ SECURITY: Enhanced TOTP verification with logging
    const totp = new TOTP({
      issuer: "TradersUtopia",
      label: `${profile.name} (${profile.email})`,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: profile.twoFactorSecret,
    });

    const isValid = totp.validate({ token: code, window: 1 });

    if (!isValid) {
      trackSuspiciousActivity(request, "INVALID_2FA_DISABLE_CODE");
      console.warn(
        `🚨 [2FA-DISABLE] Invalid code attempt for user: ${profile.email}`,
      );
      return NextResponse.json(
        {
          error: "Invalid code",
          message: "The verification code is incorrect or has expired",
        },
        { status: 400 },
      );
    }

    // ✅ SECURITY: Enhanced database operation with error handling
    try {
      // Disable 2FA
      await db.profile.update({
        where: { id: profile.id },
        data: {
          twoFactorEnabled: false,
          twoFactorSecret: null,
          backupCodes: [],
        },
      });
    } catch (dbError) {
      console.error("❌ [2FA-DISABLE] Database update error:", dbError);
      trackSuspiciousActivity(request, "2FA_DISABLE_DB_ERROR");

      return NextResponse.json(
        {
          error: "Failed to disable 2FA",
          message: "Database operation failed",
        },
        { status: 500 },
      );
    }

    // Create security notification
    try {
      await createNotification({
        userId: user.id,
        type: "SECURITY",
        title: "2FA Disabled",
        message: "Two-factor authentication has been disabled on your account.",
      });
    } catch (notificationError) {
      // Don't fail the operation if notification fails, just log it
      console.warn(
        "⚠️ [2FA-DISABLE] Failed to create notification:",
        notificationError,
      );
    }

    // ✅ SECURITY: Log successful 2FA disabling
    console.log(
      `🔒 [2FA-DISABLE] Two-factor authentication disabled for user: ${profile.email}`,
    );
    console.log(
      `📍 [2FA-DISABLE] IP: ${request.headers.get("x-forwarded-for") || "unknown"}`,
    );
    console.log(
      `🖥️ [2FA-DISABLE] User Agent: ${request.headers.get("user-agent")?.slice(0, 100) || "unknown"}`,
    );
    console.log(
      `⚠️ [2FA-DISABLE] Security Warning: Account now less secure without 2FA`,
    );

    return NextResponse.json({
      success: true,
      message: "2FA has been successfully disabled.",
      warning:
        "Your account is now less secure without two-factor authentication. Consider re-enabling it soon.",
    });
  } catch (error) {
    console.error("❌ [2FA-DISABLE] 2FA disable error:", error);
    trackSuspiciousActivity(request, "2FA_DISABLE_ERROR");

    return NextResponse.json(
      {
        error: "Failed to disable 2FA",
        message: "An internal error occurred. Please try again later.",
      },
      { status: 500 },
    );
  }
}
