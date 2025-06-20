import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-05-28.basil',
});

export async function GET(request: NextRequest) {
  try {
    const user = await currentUser();
    
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

    // Get basic subscription info from database
    const subscriptionInfo = {
      status: profile.subscriptionStatus,
      productId: profile.stripeProductId,
      customerId: profile.stripeCustomerId,
      subscriptionStart: profile.subscriptionStart,
      subscriptionEnd: profile.subscriptionEnd,
    };

    // If user has Stripe customer ID, fetch detailed info from Stripe
    if (profile.stripeCustomerId) {
      try {
        // Get customer details
        const customer = await stripe.customers.retrieve(profile.stripeCustomerId) as any;
        
        // Get all subscriptions (not just active) to see what's available
        const subscriptions = await stripe.subscriptions.list({
          customer: profile.stripeCustomerId,
          limit: 10,
        });

        console.log(`🔍 Found ${subscriptions.data.length} total subscriptions for customer ${profile.stripeCustomerId}`);
        subscriptions.data.forEach((sub, index) => {
          console.log(`   ${index + 1}. ID: ${sub.id}, Status: ${sub.status}, Cancel at period end: ${sub.cancel_at_period_end}`);
        });

        // Get product details if we have a product ID
        let productDetails = null;
        if (profile.stripeProductId) {
          try {
            const product = await stripe.products.retrieve(profile.stripeProductId);
            productDetails = {
              id: product.id,
              name: product.name,
              description: product.description,
              images: product.images,
            };
          } catch (error) {
            console.error('Error fetching product details:', error);
          }
        }

        // Get subscription details - find the most relevant subscription
        let subscriptionDetails = null;
        if (subscriptions.data.length > 0) {
          // Prioritize active subscriptions, then cancelled ones that are still in current period
          const relevantSubscription = subscriptions.data.find(sub => 
            sub.status === 'active' || 
            (sub.status === 'canceled' && new Date(sub.current_period_end * 1000) > new Date())
          ) || subscriptions.data[0]; // fallback to first subscription if no relevant one found
          
          const subscription = relevantSubscription as any;
          console.log(`✅ Using subscription: ${subscription.id} with status: ${subscription.status}`);
          subscriptionDetails = {
            id: subscription.id,
            status: subscription.status,
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
            autoRenew: !subscription.cancel_at_period_end,
            priceId: subscription.items.data[0]?.price.id,
            amount: subscription.items.data[0]?.price.unit_amount,
            currency: subscription.items.data[0]?.price.currency,
            interval: subscription.items.data[0]?.price.recurring?.interval,
          };
        }

        const responseData = {
          success: true,
          subscription: {
            ...subscriptionInfo,
            product: productDetails,
            stripe: subscriptionDetails,
            customer: {
              id: customer.id,
              email: customer.email,
              created: new Date(customer.created * 1000),
            }
          }
        };

        console.log('📊 Full subscription response:', JSON.stringify(responseData, null, 2));

        return NextResponse.json(responseData);

      } catch (stripeError) {
        console.error('Stripe API error:', stripeError);
        // Return database info even if Stripe fails
        return NextResponse.json({
          success: true,
          subscription: subscriptionInfo,
          stripeError: 'Failed to fetch Stripe details'
        });
      }
    }

    // Return database info only
    return NextResponse.json({
      success: true,
      subscription: subscriptionInfo
    });

  } catch (error) {
    console.error('Subscription details error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch subscription details' 
    }, { status: 500 });
  }
} 