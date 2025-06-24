import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs';
import { prismadb } from '@/lib/prismadb';
import { stripe } from '@/lib/subscription';

export async function GET(request: NextRequest) {
  try {
    const { userId } = auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const profile = await prismadb.profile.findUnique({
      where: { userId },
    });

    if (!profile?.stripeCustomerId) {
      return NextResponse.json({ error: 'No Stripe customer found' }, { status: 404 });
    }

    console.log(`🔍 [VERIFY] Fetching RAW Stripe data for customer: ${profile.stripeCustomerId}`);

    // Get subscription directly from Stripe
    const subscriptions = await stripe.subscriptions.list({
      customer: profile.stripeCustomerId,
      limit: 10,
    });

    const activeSubscription = subscriptions.data.find(sub => 
      sub.status === 'active' || 
      (sub.status === 'canceled' && sub.current_period_end && new Date(sub.current_period_end * 1000) > new Date())
    ) || subscriptions.data[0];

    if (!activeSubscription) {
      return NextResponse.json({ error: 'No subscription found' }, { status: 404 });
    }

    // Extract the key auto-renewal indicators
    const autoRenewalStatus = {
      subscriptionId: activeSubscription.id,
      status: activeSubscription.status,
      cancelAtPeriodEnd: activeSubscription.cancel_at_period_end,
      autoRenewalEnabled: !activeSubscription.cancel_at_period_end,
      currentPeriodEnd: new Date(activeSubscription.current_period_end! * 1000).toISOString(),
      canceledAt: activeSubscription.canceled_at ? new Date(activeSubscription.canceled_at * 1000).toISOString() : null,
      createdAt: new Date(activeSubscription.created * 1000).toISOString(),
    };

    console.log(`✅ [VERIFY] Auto-renewal status:`, autoRenewalStatus);

    return NextResponse.json({
      message: 'Raw Stripe subscription verification',
      verification: autoRenewalStatus,
      explanation: {
        cancelAtPeriodEnd: activeSubscription.cancel_at_period_end 
          ? "❌ AUTO-RENEWAL OFF - Subscription will end at period end"
          : "✅ AUTO-RENEWAL ON - Subscription will automatically renew",
        status: activeSubscription.status,
        nextAction: activeSubscription.cancel_at_period_end 
          ? "Subscription will expire on the end date unless re-enabled"
          : "Subscription will automatically renew unless canceled"
      },
      rawStripeData: {
        id: activeSubscription.id,
        status: activeSubscription.status,
        cancel_at_period_end: activeSubscription.cancel_at_period_end,
        current_period_start: activeSubscription.current_period_start,
        current_period_end: activeSubscription.current_period_end,
        canceled_at: activeSubscription.canceled_at,
        created: activeSubscription.created,
      }
    });

  } catch (error) {
    console.error('❌ [VERIFY] Error:', error);
    return NextResponse.json({ error: 'Failed to verify subscription status' }, { status: 500 });
  }
} 