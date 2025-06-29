import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { subscribeToPushNotifications } from "@/lib/push-notifications";
import { rateLimitGeneral, trackSuspiciousActivity } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimitGeneral()(request);
    if (!rateLimitResult.success) {
      return rateLimitResult.error;
    }

    // Authentication check
    const user = await currentUser();
    if (!user) {
      trackSuspiciousActivity(request, "UNAUTHENTICATED_PUSH_SUBSCRIPTION");
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { subscription } = body;

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return NextResponse.json(
        {
          error: "Invalid subscription format",
          message: "Valid push subscription required",
        },
        { status: 400 },
      );
    }

    // Validate subscription structure
    if (!subscription.keys.p256dh || !subscription.keys.auth) {
      return NextResponse.json(
        {
          error: "Invalid subscription keys",
          message: "Push subscription keys are incomplete",
        },
        { status: 400 },
      );
    }

    // Save subscription
    const success = await subscribeToPushNotifications(user.id, subscription);

    if (success) {
      console.log(`✅ [PUSH-SUB] Push subscription saved for user: ${user.id}`);
      console.log(
        `📍 [PUSH-SUB] IP: ${request.headers.get("x-forwarded-for") || "unknown"}`,
      );

      return NextResponse.json({
        success: true,
        message: "Push notifications enabled successfully",
      });
    } else {
      trackSuspiciousActivity(request, "PUSH_SUBSCRIPTION_SAVE_FAILED");
      return NextResponse.json(
        {
          error: "Failed to save subscription",
          message: "Could not enable push notifications",
        },
        { status: 500 },
      );
    }
  } catch (error) {
    console.error("❌ [PUSH-SUB] Push subscription error:", error);
    trackSuspiciousActivity(request, "PUSH_SUBSCRIPTION_ERROR");

    return NextResponse.json(
      {
        error: "Failed to enable push notifications",
        message:
          "An internal error occurred while setting up push notifications",
      },
      { status: 500 },
    );
  }
}
