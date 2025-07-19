import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db } from '../../lib/db';

export const completedCheckout = async (event: any) => {
  const session = event.data.object as Stripe.Checkout.Session;

  let email: string | null = null;
  let customerName: string | null = null;
  let customerId: string | null = null;

  // ✅ OPTIMIZED: Use session data directly instead of API calls
  if (session.customer) {
    customerId = session.customer as string;
  }

  // ✅ OPTIMIZED: Always use customer_details from session (no API call needed)
  if (session.customer_details?.email) {
    email = session.customer_details.email;
    customerName = session.customer_details.name;
    console.log(
      `📧 [WEBHOOK-OPTIMIZED] Using customer details from session: ${email}`
    );
  }

  if (!email) {
    console.error('No email found in session customer_details');
    return NextResponse.json({ error: 'No email found' }, { status: 400 });
  }

  // ✅ OPTIMIZED: Extract product ID from session metadata or mode instead of API calls
  let stripeProductId = null;

  // Try to get product ID from session metadata first (fastest)
  if (session.metadata?.productId) {
    stripeProductId = session.metadata.productId;
    console.log(
      `📦 [WEBHOOK-OPTIMIZED] Product ID from metadata: ${stripeProductId}`
    );
  }
  // If not in metadata, we can still function without it (will be set by subscription webhook)
  else {
    console.log(
      `⚠️ [WEBHOOK-OPTIMIZED] No product ID in metadata, will be set by subscription webhook`
    );
  }

  try {
    // Find ALL profiles with this email (to handle duplicates)
    const allProfiles = await db.profile.findMany({
      where: { email: email },
      orderBy: { createdAt: 'desc' }, // Most recent first
    });

    if (allProfiles.length === 0) {
      console.log(
        `No profiles found for email: ${email}, creating new profile...`
      );

      // Create a new profile for this user
      const profile = await db.profile.create({
        data: {
          userId: `stripe_${customerId || session.id}`, // Use session.id if no customer ID
          name: customerName || 'Unknown User',
          email: email,
          imageUrl: '',
          subscriptionStatus: 'ACTIVE',
          subscriptionStart: new Date(),
          subscriptionEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
          stripeCustomerId: customerId,
          stripeSessionId: session.id,
          stripeProductId: stripeProductId,
        },
      });

      console.log(
        `✅ [WEBHOOK-OPTIMIZED] Created new profile for user: ${email} with product: ${stripeProductId || 'TBD'}`
      );
    } else {
      console.log(
        `✅ Found ${allProfiles.length} profile(s) for email: ${email}`
      );

      // Log all profiles found
      allProfiles.forEach((profile, index) => {
        console.log(
          `   Profile ${index + 1}: ${profile.id} (${profile.userId}) - Status: ${profile.subscriptionStatus}`
        );
      });

      // 🚨 SECURITY FIX: Only update the profile associated with the specific Stripe customer
      // Previously this granted access to ALL accounts with the same email (major security flaw)

      let targetProfile = null;

      // If we have a customer ID, find the profile with that customer ID
      if (customerId) {
        targetProfile = allProfiles.find(
          p => p.stripeCustomerId === customerId
        );
      }

      // If no specific profile found, use the most recent one (but only update that one)
      if (!targetProfile) {
        targetProfile = allProfiles[0]; // Most recent due to orderBy
        console.log(
          `⚠️ [SECURITY] No profile found with customer ID ${customerId}, updating most recent profile only`
        );
      }

      const subscriptionStart = new Date();
      const subscriptionEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

      console.log(
        `🔒 [SECURITY] Updating ONLY the target profile: ${targetProfile.id} (${targetProfile.userId})`
      );

      // ⚡ WEBHOOK-OPTIMIZED: Skip subscription data lookup for checkout
      // The actual subscription data will be set by subsequent subscription webhook events
      console.log(
        `⚡ [WEBHOOK-OPTIMIZED] Skipping subscription API lookup - data will be set by subscription webhook`
      );

      // Update profile with subscription data
      const updated = await db.profile.update({
        where: { id: targetProfile.id },
        data: {
          subscriptionStatus: 'ACTIVE',
          subscriptionStart: subscriptionStart,
          subscriptionEnd: subscriptionEnd,
          stripeCustomerId: customerId,
          stripeSessionId: session.id,
          stripeProductId: stripeProductId,
          updatedAt: new Date(),
        },
      });

      console.log(
        `✅ [WEBHOOK-OPTIMIZED] Updated single profile: ${updated.id} (${updated.userId}) with product: ${stripeProductId || 'TBD'}`
      );
      console.log(
        `📅 Subscription valid until: ${subscriptionEnd.toISOString()}`
      );
      console.log(
        `🔒 [SECURITY] Access granted to specific account only, not all accounts with same email`
      );
      console.log(
        `⚡ [PERFORMANCE] Optimized webhook processing - Zero Stripe API calls for checkout`
      );
    }
  } catch (error) {
    console.error('Error updating profile:', error);
    return NextResponse.json(
      { error: 'Database update failed' },
      { status: 500 }
    );
  }

  return NextResponse.json({ message: 'Checkout completed' });
};
