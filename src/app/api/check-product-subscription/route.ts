import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-05-28.basil',
});

export async function POST(request: NextRequest) {
  try {
    const user = await currentUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { allowedProductIds } = await request.json();
    
    if (!allowedProductIds || !Array.isArray(allowedProductIds)) {
      return NextResponse.json({ 
        error: 'allowedProductIds array is required' 
      }, { status: 400 });
    }

    const userEmail = user.emailAddresses[0]?.emailAddress;
    if (!userEmail) {
      return NextResponse.json({ error: 'No email found' }, { status: 400 });
    }

    console.log(`🔍 Checking product-specific subscription for user: ${userEmail}`);
    console.log(`🎯 Allowed product IDs: ${allowedProductIds.join(', ')}`);

    // Check if user already has valid access to any of the allowed products
    const existingProfile = await db.profile.findFirst({
      where: { 
        userId: user.id,
        subscriptionStatus: 'ACTIVE',
        subscriptionEnd: {
          gt: new Date()
        },
        stripeProductId: {
          in: allowedProductIds
        }
      }
    });

    if (existingProfile) {
      console.log(`✅ User already has valid access with product: ${existingProfile.stripeProductId}`);
      return NextResponse.json({
        hasAccess: true,
        productId: existingProfile.stripeProductId,
        reason: 'Valid subscription found in database',
        subscriptionEnd: existingProfile.subscriptionEnd
      });
    }

    // Step 1: Search for customer in Stripe by email
    const customers = await stripe.customers.list({
      email: userEmail,
      limit: 1,
    });

    if (customers.data.length === 0) {
      return NextResponse.json({
        hasAccess: false,
        reason: 'No customer found in Stripe with this email'
      });
    }

    const customer = customers.data[0];
    console.log(`✅ Found Stripe customer: ${customer.id}`);

    // Step 2: Check for active subscriptions with allowed products
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'active',
      limit: 10,
    });

    let validSubscription = null;
    let subscribedProductId = null;

    for (const subscription of subscriptions.data) {
      for (const item of subscription.items.data) {
        // Get the price details to find the product ID
        const price = await stripe.prices.retrieve(item.price.id);
        
        if (allowedProductIds.includes(price.product as string)) {
          validSubscription = subscription;
          subscribedProductId = price.product as string;
          console.log(`✅ Found valid subscription for product: ${subscribedProductId}`);
          break;
        }
      }
      if (validSubscription) break;
    }

    if (!validSubscription && subscriptions.data.length > 0) {
      // Log what products they DO have for debugging
      const userProducts = [];
      for (const subscription of subscriptions.data) {
        for (const item of subscription.items.data) {
          const price = await stripe.prices.retrieve(item.price.id);
          userProducts.push(price.product);
        }
      }
      console.log(`❌ User has subscriptions but not for allowed products. User products: ${userProducts.join(', ')}`);
    }

    // Step 3: Check completed checkout sessions for allowed products
    if (!validSubscription) {
      const checkoutSessions = await stripe.checkout.sessions.list({
        customer: customer.id,
        limit: 10,
      });

      const completedSessions = checkoutSessions.data.filter(
        session => session.status === 'complete'
      );

      for (const session of completedSessions) {
        if (session.line_items) {
          const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
          
          for (const item of lineItems.data) {
            if (item.price) {
              const price = await stripe.prices.retrieve(item.price.id);
              
              if (allowedProductIds.includes(price.product as string)) {
                subscribedProductId = price.product as string;
                console.log(`✅ Found valid checkout session for product: ${subscribedProductId}`);
                break;
              }
            }
          }
        }
        if (subscribedProductId) break;
      }
    }

    if (!subscribedProductId) {
      return NextResponse.json({
        hasAccess: false,
        reason: `No subscription found for allowed products: ${allowedProductIds.join(', ')}`
      });
    }

    // Step 4: Update or create profile with product-specific data
    let profile = await db.profile.findFirst({
      where: { userId: user.id }
    });

    // Calculate subscription end date with proper error handling
    let subscriptionEnd: Date;
    
    if (validSubscription && validSubscription.current_period_end) {
      // Convert Stripe timestamp to Date
      subscriptionEnd = new Date(validSubscription.current_period_end * 1000);
      console.log(`📅 Subscription end from Stripe: ${subscriptionEnd.toISOString()}`);
    } else {
      // Fallback: 30 days from now for one-time payments or invalid subscription data
      subscriptionEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      console.log(`📅 Using fallback subscription end: ${subscriptionEnd.toISOString()}`);
    }
    
    // Validate the date is not invalid
    if (isNaN(subscriptionEnd.getTime())) {
      console.log('⚠️ Invalid subscription end date, using 30-day fallback');
      subscriptionEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }

    if (!profile) {
      profile = await db.profile.create({
        data: {
          userId: user.id,
          name: `${user.firstName} ${user.lastName}`,
          email: userEmail,
          imageUrl: user.imageUrl,
          subscriptionStatus: 'ACTIVE',
          subscriptionStart: new Date(),
          subscriptionEnd: subscriptionEnd,
          stripeCustomerId: customer.id,
          stripeProductId: subscribedProductId,
        }
      });
      console.log(`➕ Created new profile with product: ${subscribedProductId}`);
    } else {
      profile = await db.profile.update({
        where: { id: profile.id },
        data: {
          subscriptionStatus: 'ACTIVE',
          subscriptionStart: new Date(),
          subscriptionEnd: subscriptionEnd,
          stripeCustomerId: customer.id,
          stripeProductId: subscribedProductId,
        }
      });
      console.log(`🔄 Updated profile with product: ${subscribedProductId}`);
    }

    return NextResponse.json({
      hasAccess: true,
      productId: subscribedProductId,
      reason: `Valid subscription found for product: ${subscribedProductId}`,
      subscriptionEnd: subscriptionEnd,
      profile: {
        id: profile.id,
        subscriptionStatus: profile.subscriptionStatus,
        stripeProductId: profile.stripeProductId
      }
    });

  } catch (error) {
    console.error('❌ Error checking product subscription:', error);
    
    return NextResponse.json({ 
      hasAccess: false,
      reason: `Failed to verify product subscription: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 