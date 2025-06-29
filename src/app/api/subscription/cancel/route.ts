import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import Stripe from "stripe";
import { createNotification } from "@/lib/notifications";
import {
  rateLimitSubscription,
  trackSuspiciousActivity,
} from "@/lib/rate-limit";
import {
  validateInput,
  subscriptionCancelSchema,
  secureTextInput,
} from "@/lib/validation";
import { strictCSRFValidation } from "@/lib/csrf";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-05-28.basil",
});

export async function POST(request: NextRequest) {
  try {
    // ✅ SECURITY: CSRF protection for subscription operations
    const csrfValid = await strictCSRFValidation(request);
    if (!csrfValid) {
      trackSuspiciousActivity(request, "SUBSCRIPTION_CSRF_VALIDATION_FAILED");
      return NextResponse.json(
        {
          error: "CSRF validation failed",
          message: "Invalid security token. Please refresh and try again.",
        },
        { status: 403 },
      );
    }
    // ✅ SECURITY: Rate limiting for subscription operations
    const rateLimitResult = await rateLimitSubscription()(request);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(request, "CANCEL_RATE_LIMIT_EXCEEDED");
      return rateLimitResult.error;
    }

    // ✅ SECURITY: Authentication check
    const user = await currentUser();
    if (!user) {
      trackSuspiciousActivity(request, "UNAUTHENTICATED_CANCEL_ACCESS");
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // ✅ SECURITY: Input validation
    const validationResult = await validateInput(subscriptionCancelSchema)(
      request,
    );
    if (!validationResult.success) {
      trackSuspiciousActivity(request, "INVALID_CANCEL_INPUT");
      return validationResult.error;
    }

    const { password, confirmCancel, reason } = validationResult.data;

    // ✅ SECURITY: Sanitize optional reason input
    let sanitizedReason = null;
    if (reason) {
      const reasonCheck = secureTextInput(reason);
      if (reasonCheck.threats.length) {
        console.warn(
          `🚨 [SECURITY] Suspicious cancellation reason: ${reasonCheck.threats.join(", ")}`,
        );
        trackSuspiciousActivity(
          request,
          `CANCEL_REASON_THREATS_${reasonCheck.threats.join("_")}`,
        );
        return NextResponse.json(
          {
            error: "Invalid cancellation reason",
            message: "The reason contains invalid content",
          },
          { status: 400 },
        );
      }
      sanitizedReason = reasonCheck.clean;
    }

    // Find the user's profile
    const profile = await db.profile.findFirst({
      where: { userId: user.id },
    });

    if (!profile) {
      trackSuspiciousActivity(request, "CANCEL_PROFILE_NOT_FOUND");
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    if (!profile.stripeCustomerId) {
      return NextResponse.json(
        { error: "No Stripe customer found" },
        { status: 400 },
      );
    }

    // ✅ SECURITY: Enhanced Stripe API interaction with error handling
    let subscriptions;
    try {
      // Get active subscriptions
      subscriptions = await stripe.subscriptions.list({
        customer: profile.stripeCustomerId,
        status: "active",
        limit: 1,
      });
    } catch (stripeError) {
      console.error("❌ [CANCEL] Stripe API error:", stripeError);
      trackSuspiciousActivity(request, "STRIPE_API_ERROR");
      return NextResponse.json(
        {
          error: "Failed to access subscription data",
          message: "Service temporarily unavailable",
        },
        { status: 503 },
      );
    }

    if (subscriptions.data.length === 0) {
      return NextResponse.json(
        { error: "No active subscription found" },
        { status: 400 },
      );
    }

    const subscription = subscriptions.data[0];

    // ✅ SECURITY: Enhanced Stripe operation with error handling
    let updatedSubscription;
    try {
      // Set subscription to cancel at period end (not immediately)
      updatedSubscription = await stripe.subscriptions.update(subscription.id, {
        cancel_at_period_end: true,
      });
    } catch (stripeError) {
      console.error("❌ [CANCEL] Stripe update error:", stripeError);
      trackSuspiciousActivity(request, "STRIPE_CANCEL_ERROR");
      return NextResponse.json(
        {
          error: "Failed to cancel subscription",
          message: "Could not process cancellation request",
        },
        { status: 500 },
      );
    }

    // ✅ SECURITY: Log successful cancellation with details
    console.log(
      `🔄 [CANCEL] Auto-renewal disabled for subscription: ${subscription.id}`,
    );

    // ✅ SECURITY: Safe access to current_period_end with proper validation
    // Try subscription level first, then fall back to subscription item level (like in sync route)
    let periodEndTimestamp =
      (updatedSubscription as any).current_period_end ||
      (subscription as any).current_period_end;

    // If not found at subscription level, check subscription items (same pattern as sync route)
    if (!periodEndTimestamp && subscription.items?.data?.[0]) {
      periodEndTimestamp = subscription.items.data[0].current_period_end;
      console.log(
        `📋 [CANCEL] Using period end from subscription item: ${periodEndTimestamp}`,
      );
    }

    // Validate timestamp before creating date
    if (!periodEndTimestamp || typeof periodEndTimestamp !== "number") {
      console.error(
        "❌ [CANCEL] Invalid period end timestamp:",
        periodEndTimestamp,
      );
      return NextResponse.json(
        {
          error: "Invalid subscription period data",
          message: "Unable to determine subscription end date",
        },
        { status: 400 },
      );
    }

    const periodEndDate = new Date(periodEndTimestamp * 1000);

    // Validate the resulting date
    if (isNaN(periodEndDate.getTime())) {
      console.error(
        "❌ [CANCEL] Invalid period end date created from timestamp:",
        periodEndTimestamp,
      );
      return NextResponse.json(
        {
          error: "Invalid subscription period data",
          message: "Unable to calculate subscription end date",
        },
        { status: 400 },
      );
    }

    console.log(
      `📅 [CANCEL] Subscription will end at: ${periodEndDate.toISOString()}`,
    );
    console.log(
      `📝 [CANCEL] Reason: ${sanitizedReason || "No reason provided"}`,
    );
    console.log(`👤 [CANCEL] User: ${profile.email} (${user.id})`);
    console.log(
      `📍 [CANCEL] IP: ${request.headers.get("x-forwarded-for") || "unknown"}`,
    );

    // Create notification
    await createNotification({
      userId: user.id,
      type: "PAYMENT",
      title: "Auto-Renewal Disabled",
      message: `Auto-renewal has been disabled. Your subscription will remain active until ${periodEndDate.toLocaleDateString()}. You can re-enable auto-renewal anytime before then.`,
    });

    return NextResponse.json({
      success: true,
      message: "Auto-renewal disabled successfully",
      subscription: {
        id: updatedSubscription.id,
        status: updatedSubscription.status,
        cancelAtPeriodEnd: updatedSubscription.cancel_at_period_end,
        currentPeriodEnd: periodEndDate,
        willCancelAt: periodEndDate,
      },
    });
  } catch (error) {
    console.error("❌ [CANCEL] Cancel subscription error:", error);
    trackSuspiciousActivity(request, "CANCEL_OPERATION_ERROR");

    // ✅ SECURITY: Don't expose detailed error information
    return NextResponse.json(
      {
        error: "Failed to cancel subscription",
        message: "An internal error occurred. Please try again later.",
      },
      { status: 500 },
    );
  }
}
