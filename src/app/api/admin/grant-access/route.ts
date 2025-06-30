import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { rateLimitAdmin, trackSuspiciousActivity } from "@/lib/rate-limit";
import { secureTextInput } from "@/lib/validation";
import { z } from "zod";

// Specific validation for grant access endpoint
const grantAccessSchema = z.object({
  reason: z.string().max(500, "Reason too long").optional(),
});


// Mark this route as dynamic to prevent static generation
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  try {
    // ✅ SECURITY: Rate limiting for admin operations
    const rateLimitResult = await rateLimitAdmin()(request);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(request, "ADMIN_RATE_LIMIT_EXCEEDED");
      return rateLimitResult.error;
    }

    // ✅ SECURITY: Authentication check
    const user = await currentUser();
    if (!user) {
      trackSuspiciousActivity(request, "UNAUTHENTICATED_ADMIN_ACCESS");
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // ✅ SECURITY: Input validation
    let reason = "";
    try {
      const body = await request.json();
      const validated = grantAccessSchema.parse(body);
      reason = validated.reason || "";
    } catch (error) {
      // If no JSON body or invalid, continue with empty reason
      reason = "";
    }

    // ✅ SECURITY: Sanitize text inputs
    const sanitizedReason = reason ? secureTextInput(reason) : null;
    if (sanitizedReason?.threats.length) {
      console.warn(
        `🚨 [SECURITY] Admin operation blocked - threats detected: ${sanitizedReason.threats.join(", ")}`,
      );
      trackSuspiciousActivity(
        request,
        `ADMIN_INPUT_THREATS_${sanitizedReason.threats.join("_")}`,
      );
      return NextResponse.json(
        {
          error: "Invalid input detected",
          message: "Potentially malicious content in request data",
        },
        { status: 400 },
      );
    }

    // Find or create the user's profile
    let profile = await db.profile.findFirst({
      where: { userId: user.id },
    });

    if (!profile) {
      const userEmail = user.emailAddresses[0]?.emailAddress;
      if (!userEmail) {
        return NextResponse.json({ error: "No email found" }, { status: 400 });
      }

      profile = await db.profile.create({
        data: {
          userId: user.id,
          name: `${user.firstName} ${user.lastName}`,
          email: userEmail,
          imageUrl: user.imageUrl,
          isAdmin: true, // Grant admin access immediately
        },
      });
    } else {
      // Update existing profile to grant admin access
      profile = await db.profile.update({
        where: { id: profile.id },
        data: {
          isAdmin: true,
        },
      });
    }

    // ✅ SECURITY: Log admin access grant with details
    console.log(
      `🔑 [ADMIN] Access granted to user: ${profile.email} (${user.id})`,
    );
    console.log(
      `📝 [ADMIN] Reason: ${sanitizedReason?.clean || "No reason provided"}`,
    );
    console.log(
      `📍 [ADMIN] IP: ${request.headers.get("x-forwarded-for") || "unknown"}`,
    );
    console.log(
      `🖥️ [ADMIN] User Agent: ${request.headers.get("user-agent")?.slice(0, 100) || "unknown"}`,
    );

    return NextResponse.json({
      success: true,
      message: "Admin access granted successfully!",
      profile: {
        id: profile.id,
        isAdmin: profile.isAdmin,
        email: profile.email,
      },
    });
  } catch (error) {
    console.error("❌ [ADMIN] Error granting admin access:", error);
    trackSuspiciousActivity(request, "ADMIN_GRANT_ERROR");

    // ✅ SECURITY: Don't expose detailed error information
    return NextResponse.json(
      {
        error: "Failed to grant admin access",
        message: "An internal error occurred. Please try again later.",
      },
      { status: 500 },
    );
  }
}
