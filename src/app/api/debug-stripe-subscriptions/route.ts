import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { currentUser } from '@clerk/nextjs/server';

export async function GET(request: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  try {
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Check if we're in test or live mode
    const isTestMode = process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_');
    console.log(`🎯 [DEBUG] Stripe Mode: ${isTestMode ? 'TEST' : 'LIVE'}`);
    console.log(
      `🔑 [DEBUG] Using key: ${process.env.STRIPE_SECRET_KEY?.substring(0, 12)}...`
    );

    const allUserEmails = user.emailAddresses.map(e => e.emailAddress);
    const allSubscriptions = [];

    console.log('🔍 [DEBUG] Searching Stripe for all subscriptions...');
    console.log('📧 [DEBUG] User emails:', allUserEmails);

    for (const email of allUserEmails) {
      try {
        // Find customers with this email
        const customers = await stripe.customers.list({
          email: email,
          limit: 10,
        });

        console.log(
          `📊 [DEBUG] Found ${customers.data.length} customers for ${email}`
        );

        for (const customer of customers.data) {
          // Get ALL subscriptions (active, canceled, etc.)
          const subscriptions = await stripe.subscriptions.list({
            customer: customer.id,
            limit: 20,
          });

          console.log(
            `📊 [DEBUG] Found ${subscriptions.data.length} subscriptions for customer ${customer.id}`
          );

          for (const subscription of subscriptions.data) {
            const productIds = subscription.items.data.map(
              item => item.price.product as string
            );

            allSubscriptions.push({
              id: subscription.id,
              customer: customer.id,
              customerEmail: customer.email,
              status: subscription.status,
              products: productIds,
              created: new Date(subscription.created * 1000),
              currentPeriodStart: (subscription as any).current_period_start
                ? new Date((subscription as any).current_period_start * 1000)
                : null,
              currentPeriodEnd: (subscription as any).current_period_end
                ? new Date((subscription as any).current_period_end * 1000)
                : null,
            });
          }
        }
      } catch (error) {
        console.error(`❌ [DEBUG] Error searching email ${email}:`, error);
      }
    }

    // Sort by creation date (newest first)
    allSubscriptions.sort((a, b) => b.created.getTime() - a.created.getTime());

    return NextResponse.json({
      userEmails: allUserEmails,
      totalSubscriptions: allSubscriptions.length,
      subscriptions: allSubscriptions,
      stripeMode: isTestMode ? 'TEST' : 'LIVE',
      keyPrefix: process.env.STRIPE_SECRET_KEY?.substring(0, 12),
    });
  } catch (error) {
    console.error('❌ [DEBUG] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscriptions' },
      { status: 500 }
    );
  }
}
