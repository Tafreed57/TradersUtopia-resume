import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { activateSubscription } from "@/lib/subscription";
import {
  rateLimitSubscription,
  trackSuspiciousActivity,
} from "@/lib/rate-limit";
import {
  validateInput,
  subscriptionActivationSchema,
  secureTextInput,
} from "@/lib/validation";

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // ✅ SECURITY: Rate limiting for subscription activation
    const rateLimitResult = await rateLimitSubscription()(request);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(request, "ACTIVATION_RATE_LIMIT_EXCEEDED");
      return rateLimitResult.error;
    }

    // ✅ SECURITY: Authentication check
    const user = await currentUser();
    if (!user) {
      trackSuspiciousActivity(request, "UNAUTHENTICATED_ACTIVATION_ACCESS");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ✅ SECURITY: Input validation
    const validationResult = await validateInput(subscriptionActivationSchema)(
      request,
    );
    if (!validationResult.success) {
      trackSuspiciousActivity(request, "INVALID_ACTIVATION_INPUT");
      return validationResult.error;
    }

    const { paymentId, paymentData } = validationResult.data;

    // ✅ SECURITY: Sanitize payment ID
    const paymentIdCheck = secureTextInput(paymentId);
    if (paymentIdCheck.threats.length) {
      console.warn(
        `🚨 [SECURITY] Suspicious payment ID: ${paymentIdCheck.threats.join(", ")}`,
      );
      trackSuspiciousActivity(request, "SUSPICIOUS_PAYMENT_ID");
      return NextResponse.json(
        {
          error: "Invalid payment ID format",
          message: "The payment ID contains invalid characters",
        },
        { status: 400 },
      );
    }

    // ✅ SECURITY: Enhanced logging for payment processing
    console.log(
      `💳 [ACTIVATION] Processing payment activation for user: ${user.id}`,
    );
    console.log(`🔢 [ACTIVATION] Payment ID: ${paymentId.substring(0, 10)}...`); // Only log first 10 chars
    console.log(
      `📍 [ACTIVATION] IP: ${request.headers.get("x-forwarded-for") || "unknown"}`,
    );

    if (paymentData) {
      console.log(
        `💰 [ACTIVATION] Amount: ${paymentData.amount} ${paymentData.currency}`,
      );
      console.log(
        `🏪 [ACTIVATION] Payment method: ${paymentData.paymentMethod}`,
      );
    }

    // In a real app, you would:
    // 1. Verify the payment with your payment processor (Stripe, PayPal, etc.)
    // 2. Validate the payment amount and status
    // 3. Handle any payment processor webhooks for security

    // ✅ SECURITY: Enhanced subscription activation with error handling
    let subscriptionEnd;
    try {
      subscriptionEnd = await activateSubscription(user.id, paymentId);
    } catch (activationError) {
      console.error(
        "❌ [ACTIVATION] Subscription activation error:",
        activationError,
      );
      trackSuspiciousActivity(request, "ACTIVATION_PROCESSING_ERROR");

      return NextResponse.json(
        {
          error: "Failed to activate subscription",
          message: "Payment could not be processed at this time",
        },
        { status: 500 },
      );
    }

    // ✅ SECURITY: Log successful activation
    console.log(
      `✅ [ACTIVATION] Subscription activated successfully for user: ${user.id}`,
    );
    console.log(`📅 [ACTIVATION] Subscription valid until: ${subscriptionEnd}`);

    return NextResponse.json({
      success: true,
      subscriptionEnd,
      message: "Payment successful! Your subscription is now active.",
      paymentId: paymentId.substring(0, 10) + "...", // Only return partial payment ID
    });
  } catch (error) {
    console.error("❌ [ACTIVATION] Error activating subscription:", error);
    trackSuspiciousActivity(request, "ACTIVATION_ENDPOINT_ERROR");

    return NextResponse.json(
      {
        error: "Failed to activate subscription",
        message: "An internal error occurred while processing your payment",
      },
      { status: 500 },
    );
  }
}
