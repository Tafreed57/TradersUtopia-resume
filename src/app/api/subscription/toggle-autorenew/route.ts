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
    const { autoRenew } = await request.json();
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
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

    // Update the subscription in Stripe
    const updatedSubscription = await stripe.subscriptions.update(subscription.id, {
      cancel_at_period_end: !autoRenew, // If autoRenew is true, don't cancel at period end
    });

    // Create notification
    const periodEndDate = new Date(updatedSubscription.current_period_end * 1000);
    await createNotification({
      userId: user.id,
      type: 'PAYMENT',
      title: `Auto-renewal ${autoRenew ? 'Re-enabled' : 'Disabled'}`,
      message: autoRenew 
        ? `🎉 Great! Your subscription will now automatically renew on ${periodEndDate.toLocaleDateString()}. You're all set!`
        : `Auto-renewal disabled. Your subscription remains active until ${periodEndDate.toLocaleDateString()}. You can re-enable anytime before then.`,
    });

    return NextResponse.json({
      success: true,
      autoRenew: !(updatedSubscription as any).cancel_at_period_end,
      message: `Auto-renewal ${autoRenew ? 'enabled' : 'disabled'} successfully`,
      subscription: {
        id: updatedSubscription.id,
        cancelAtPeriodEnd: (updatedSubscription as any).cancel_at_period_end,
        currentPeriodEnd: new Date((updatedSubscription as any).current_period_end * 1000),
      }
    });

  } catch (error) {
    console.error('Toggle auto-renewal error:', error);
    return NextResponse.json({ 
      error: 'Failed to toggle auto-renewal' 
    }, { status: 500 });
  }
} 