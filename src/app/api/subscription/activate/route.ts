import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { activateSubscription } from "@/lib/subscription";

export async function POST(request: Request) {
  try {
    const { userId } = auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { paymentId, paymentData } = await request.json();
    
    if (!paymentId) {
      return NextResponse.json(
        { error: "Payment ID is required" },
        { status: 400 }
      );
    }

    // In a real app, you would:
    // 1. Verify the payment with your payment processor (Stripe, PayPal, etc.)
    // 2. Validate the payment amount and status
    // 3. Handle any payment processor webhooks for security
    
    // For now, we'll simulate successful payment processing
    console.log("Processing payment for user:", userId);
    console.log("Payment ID:", paymentId);
    console.log("Payment data:", paymentData);

    const subscriptionEnd = await activateSubscription(userId, paymentId);
    
    return NextResponse.json({
      success: true,
      subscriptionEnd,
      message: "Payment successful! Your subscription is now active."
    });
  } catch (error) {
    console.error("Error activating subscription:", error);
    return NextResponse.json(
      { error: "Failed to activate subscription" },
      { status: 500 }
    );
  }
} 