import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import Stripe from 'stripe';
import { createNotification } from '@/lib/notifications';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-05-28.basil',
});

export async function POST(request: NextRequest) {
  try {
    const user = await currentUser();
    const { password, confirmCancel } = await request.json();
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (!confirmCancel) {
      return NextResponse.json({ error: 'Cancellation not confirmed' }, { status: 400 });
    }

    if (!password) {
      return NextResponse.json({ error: 'Password is required to cancel subscription' }, { status: 400 });
    }

    // Find the user's profile
    const profile = await db.profile.findFirst({
      where: { userId: user.id }
    });

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    if (!profile.stripeCustomerId) {
      return NextResponse.json({ error: 'No Stripe customer found' }, { status: 400 });
    }

    // Get active subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: profile.stripeCustomerId,
      status: 'active',
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 400 });
    }

    const subscription = subscriptions.data[0];

    // Set subscription to cancel at period end (not immediately)
    const updatedSubscription = await stripe.subscriptions.update(subscription.id, {
      cancel_at_period_end: true,
    });

    console.log(`🔄 Auto-renewal disabled for subscription: ${subscription.id}`);
    console.log(`📅 Subscription will end at: ${new Date(updatedSubscription.current_period_end * 1000)}`);

    // Keep subscription status as ACTIVE until period end
    // Only update if the subscription will actually end soon
    const periodEndDate = new Date(updatedSubscription.current_period_end * 1000);
    
    // Create notification
    await createNotification({
      userId: user.id,
      type: 'PAYMENT',
      title: 'Auto-Renewal Disabled',
      message: `Auto-renewal has been disabled. Your subscription will remain active until ${periodEndDate.toLocaleDateString()}. You can re-enable auto-renewal anytime before then.`,
    });

    return NextResponse.json({
      success: true,
      message: 'Auto-renewal disabled successfully',
      subscription: {
        id: updatedSubscription.id,
        status: updatedSubscription.status,
        cancelAtPeriodEnd: updatedSubscription.cancel_at_period_end,
        currentPeriodEnd: new Date(updatedSubscription.current_period_end * 1000),
        willCancelAt: new Date(updatedSubscription.current_period_end * 1000),
      }
    });

  } catch (error) {
    console.error('Cancel subscription error:', error);
    return NextResponse.json({ 
      error: 'Failed to cancel subscription' 
    }, { status: 500 });
  }
} 