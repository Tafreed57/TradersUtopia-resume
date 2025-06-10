import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
});

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

    console.log(`💳 Found ${successfulPayments.length} successful payment intents`);
    console.log(`🎟️ Found ${completedSessions.length} completed checkout sessions (including promo codes)`);
    console.log(`📋 Found ${subscriptions.data.length} active subscriptions`);

    // Log details about payments and sessions
    if (completedSessions.length > 0) {
      completedSessions.forEach((session, index) => {
        console.log(`Session ${index + 1}: Amount: $${(session.amount_total || 0) / 100}, Status: ${session.status}`);
      });
    }

    // Step 4: Determine if user should have access (including $0 promo payments)
    const hasActiveSubscription = subscriptions.data.length > 0;
    const hasSuccessfulPayment = successfulPayments.length > 0;
    const hasCompletedCheckout = completedSessions.length > 0;
    const shouldHaveAccess = hasActiveSubscription || hasSuccessfulPayment || hasCompletedCheckout;

    if (!shouldHaveAccess) {
      return NextResponse.json({
        success: false,
        message: 'No active subscription, successful payment, or completed checkout session found in Stripe',
        hasAccess: false,
        stripeData: {
          customerId: customer.id,
          subscriptions: subscriptions.data.length,
          payments: successfulPayments.length,
          checkoutSessions: completedSessions.length,
        }
      });
    }

    // Step 5: Find or create profile in database
    let profile = await db.profile.findFirst({
      where: { userId: user.id }
    });

    if (!profile) {
      // Create profile if it doesn't exist
      profile = await db.profile.create({
        data: {
          userId: user.id,
          name: `${user.firstName} ${user.lastName}`,
          email: userEmail,
          imageUrl: user.imageUrl,
          subscriptionStatus: 'FREE',
        }
      });
      console.log(`➕ Created new profile: ${profile.id}`);
    }

    // Step 6: Update subscription status based on Stripe data
    const subscriptionEnd = hasActiveSubscription 
      ? new Date(subscriptions.data[0].current_period_end * 1000)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now for one-time payments

    const updatedProfile = await db.profile.update({
      where: { id: profile.id },
      data: {
        subscriptionStatus: 'ACTIVE',
        subscriptionStart: new Date(),
        subscriptionEnd: subscriptionEnd,
        stripeCustomerId: customer.id,
      }
    });

    console.log(`✅ Successfully verified and activated subscription for: ${userEmail}`);

    // Determine the access reason for better messaging
    let accessReason = '';
    if (hasActiveSubscription) {
      accessReason = 'Active subscription found';
    } else if (hasSuccessfulPayment) {
      accessReason = 'Successful payment found';
    } else if (hasCompletedCheckout) {
      accessReason = 'Completed checkout session found (including promo code payments)';
    }

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
      }
    });

  } catch (error) {
    console.error('❌ Error verifying Stripe payment:', error);
    
    // Log more detailed error information
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    
    return NextResponse.json({ 
      success: false,
      message: `Failed to verify payment: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error: 'Failed to verify payment',
      details: error instanceof Error ? error.message : 'Unknown error',
      errorType: error instanceof Error ? error.name : 'Unknown'
    }, { status: 500 });
  }
} 