import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { getStripeInstance } from '@/lib/stripe';


// Mark this route as dynamic to prevent static generation
export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  try {
    const user = await currentUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const userEmail = user.emailAddresses[0]?.emailAddress;
    if (!userEmail) {
      return NextResponse.json({ error: 'No email found' }, { status: 400 });
    }

    const stripe = getStripeInstance();
    if (!stripe) {
      return NextResponse.json(
        {
          success: false,
          message: 'Payment service not configured',
          hasAccess: false,
        },
        { status: 503 }
      );
    }

    console.log(`🔍 Checking Stripe payment for user: ${userEmail}`);

    // Step 1: Search for customer in Stripe by email
    const customers = await stripe.customers.list({
      email: userEmail,
      limit: 1,
    });

    if (customers.data.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No customer found in Stripe with this email',
        hasAccess: false,
      });
    }

    const customer = customers.data[0];
    console.log(`✅ Found Stripe customer: ${customer.id}`);

    // Step 2: Check for active subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'active',
      limit: 1,
    });

    // Step 3: Check for successful payments (including $0 promo code payments)
    const paymentIntents = await stripe.paymentIntents.list({
      customer: customer.id,
      limit: 10,
    });

    const successfulPayments = paymentIntents.data.filter(
      payment => payment.status === 'succeeded'
    );

    // Step 3b: Also check for completed checkout sessions (including $0 promo payments)
    const checkoutSessions = await stripe.checkout.sessions.list({
      customer: customer.id,
      limit: 10,
    });

    const completedSessions = checkoutSessions.data.filter(
      session => session.status === 'complete'
    );

    // Determine if user has valid access
    const hasActiveSubscription = subscriptions.data.length > 0;
    const hasSuccessfulPayment = successfulPayments.length > 0;
    const hasCompletedCheckout = completedSessions.length > 0;

    if (
      !hasActiveSubscription &&
      !hasSuccessfulPayment &&
      !hasCompletedCheckout
    ) {
      return NextResponse.json({
        success: false,
        message: 'No valid payments or subscriptions found',
        hasAccess: false,
      });
    }

    // Get subscription end date for access validation
    let subscriptionEnd = null;
    let accessReason = '';

    if (hasActiveSubscription) {
      const subscription = subscriptions.data[0];
      // Use the actual subscription end date from Stripe
      const subscriptionWithPeriods = subscription as any;
      subscriptionEnd = new Date(
        subscriptionWithPeriods.current_period_end * 1000
      );
      accessReason = 'Active subscription found';
    } else if (hasCompletedCheckout) {
      // For completed checkouts, grant access for 30 days
      subscriptionEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      accessReason = 'Completed checkout session found';
    } else if (hasSuccessfulPayment) {
      // For successful payments, grant access for 30 days
      subscriptionEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      accessReason = 'Successful payment found';
    }

    // Update user profile with verified subscription data
    const profile = await db.profile.findFirst({
      where: {
        OR: [{ userId: user.id }, { email: userEmail }],
      },
    });

    let updatedProfile;
    if (profile) {
      // Update existing profile
      updatedProfile = await db.profile.update({
        where: { id: profile.id },
        data: {
          subscriptionStatus: 'ACTIVE',
          subscriptionStart: new Date(),
          subscriptionEnd: subscriptionEnd,
          stripeCustomerId: customer.id,
        },
      });
    } else {
      // Create new profile
      updatedProfile = await db.profile.create({
        data: {
          userId: user.id,
          name: user.fullName || user.firstName || 'Unknown User',
          email: userEmail,
          imageUrl: user.imageUrl || '',
          subscriptionStatus: 'ACTIVE',
          subscriptionStart: new Date(),
          subscriptionEnd: subscriptionEnd,
          stripeCustomerId: customer.id,
        },
      });
    }

    console.log(`✅ Updated subscription access for user: ${userEmail}`);

    return NextResponse.json({
      success: true,
      message: `Payment verified successfully! Access granted. ${accessReason}`,
      hasAccess: true,
      stripeData: {
        customerId: customer.id,
        hasActiveSubscription,
        hasSuccessfulPayment,
        hasCompletedCheckout,
        subscriptionEnd: subscriptionEnd,
        accessReason,
      },
      profile: {
        id: updatedProfile.id,
        name: updatedProfile.name,
        email: updatedProfile.email,
        subscriptionStatus: updatedProfile.subscriptionStatus,
        subscriptionStart: updatedProfile.subscriptionStart,
        subscriptionEnd: updatedProfile.subscriptionEnd,
      },
    });
  } catch (error) {
    console.error('❌ Error verifying Stripe payment:', error);

    // ✅ SECURITY: Detailed logging for server-side debugging (not exposed to user)
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }

    // ✅ SECURITY: Generic error response - no internal details exposed
    return NextResponse.json(
      {
        success: false,
        message:
          'Unable to verify payment at this time. Please try again later.',
        error: 'Payment verification failed',
        hasAccess: false,
      },
      { status: 500 }
    );
  }
}
