import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db } from '@/lib/db';
import { rateLimitWebhook, trackSuspiciousActivity } from '@/lib/rate-limit';

// Force dynamic rendering due to rate limiting using request.headers
export const dynamic = 'force-dynamic';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  try {
    // ✅ SECURITY: Rate limiting for webhook operations (generous limit for external systems)
    const rateLimitResult = await rateLimitWebhook()(request);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(request, 'STRIPE_WEBHOOK_RATE_LIMIT_EXCEEDED');
      return rateLimitResult.error;
    }

    const body = await request.text();
    console.log('body', body);
    const signature = request.headers.get('stripe-signature')!;

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, endpointSecret);
    } catch (err: any) {
      console.error('⚠️  Webhook signature verification failed.', err.message);
      return NextResponse.json({ error: 'Webhook Error' }, { status: 400 });
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed':
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
          return NextResponse.json(
            { error: 'No email found' },
            { status: 400 }
          );
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
                subscriptionEnd: new Date(
                  Date.now() + 30 * 24 * 60 * 60 * 1000
                ), // 30 days from now
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
            const subscriptionEnd = new Date(
              Date.now() + 30 * 24 * 60 * 60 * 1000
            ); // 30 days from now

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

        break;

      case 'customer.subscription.created':
        // Handle new subscription creation
        const newSubscription = event.data.object as Stripe.Subscription;
        console.log(`🆕 New subscription created: ${newSubscription.id}`);

        try {
          await updateSubscriptionInDatabase(newSubscription);
          console.log(
            `⚡ [WEBHOOK-OPTIMIZED] Subscription creation processed efficiently`
          );
        } catch (error) {
          console.error('Error handling subscription creation:', error);
          return NextResponse.json(
            { error: 'Subscription creation failed' },
            { status: 500 }
          );
        }
        break;

      case 'customer.subscription.updated':
        // Handle subscription updates (auto-renewal changes, plan changes, etc.)
        const updatedSubscription = event.data.object as Stripe.Subscription;
        console.log(`🔄 Subscription updated: ${updatedSubscription.id}`);

        try {
          await updateSubscriptionInDatabase(updatedSubscription);
          console.log(
            `⚡ [WEBHOOK-OPTIMIZED] Subscription update processed efficiently`
          );
        } catch (error) {
          console.error('Error handling subscription update:', error);
          return NextResponse.json(
            { error: 'Subscription update failed' },
            { status: 500 }
          );
        }
        break;

      case 'customer.subscription.deleted':
        // Handle subscription cancellation
        const cancelledSubscription = event.data.object as Stripe.Subscription;
        const cancelledCustomerId = cancelledSubscription.customer as string;

        console.log(`❌ Subscription cancelled: ${cancelledSubscription.id}`);

        try {
          const cancelledSubscriptionWithPeriods = cancelledSubscription as any;
          await db.profile.updateMany({
            where: { stripeCustomerId: cancelledCustomerId },
            data: {
              subscriptionStatus: 'CANCELLED',
              subscriptionEnd: new Date(
                cancelledSubscriptionWithPeriods.current_period_end * 1000
              ),
            },
          });

          console.log(
            `✅ Successfully cancelled subscription for customer: ${cancelledCustomerId}`
          );
          console.log(
            `⚡ [WEBHOOK-OPTIMIZED] Cancellation processed efficiently`
          );
        } catch (error) {
          console.error('Error cancelling subscription:', error);
          return NextResponse.json(
            { error: 'Cancellation failed' },
            { status: 500 }
          );
        }
        break;

      case 'invoice.payment_succeeded':
        // ⚡ WEBHOOK-OPTIMIZED: Handle successful payment without additional API calls
        const successfulInvoice = event.data.object as Stripe.Invoice;
        console.log(
          `💳 Payment succeeded for invoice: ${successfulInvoice.id}`
        );

        try {
          // ⚡ OPTIMIZATION: Use invoice data directly instead of API call
          if (successfulInvoice.customer) {
            console.log(
              `⚡ [WEBHOOK-OPTIMIZED] Processing payment success using invoice data only`
            );

            // Update subscription status using invoice data - no API call needed
            const updateResult = await db.profile.updateMany({
              where: {
                stripeCustomerId: successfulInvoice.customer as string,
                stripeSubscriptionId: successfulInvoice.id,
              },
              data: {
                subscriptionStatus: 'ACTIVE',
                lastWebhookUpdate: new Date(),
                updatedAt: new Date(),
              },
            });

            console.log(
              `✅ [WEBHOOK-OPTIMIZED] Updated ${updateResult.count} profile(s) after successful payment`
            );
            console.log(
              `⚡ [WEBHOOK-OPTIMIZED] Payment success processed with zero API calls`
            );
          } else {
            console.log(
              `⚠️ [WEBHOOK] Invoice missing subscription or customer data, skipping update`
            );
          }
        } catch (error) {
          console.error('Error updating subscription after payment:', error);
        }
        break;

      case 'invoice.payment_failed':
        // Handle failed payment
        const failedInvoice = event.data.object as Stripe.Invoice;
        console.log(`⚠️ Payment failed for invoice: ${failedInvoice.id}`);

        if (failedInvoice.customer) {
          try {
            await db.profile.updateMany({
              where: { stripeCustomerId: failedInvoice.customer as string },
              data: {
                subscriptionStatus: 'ACTIVE', // Keep active during retry period
                // Note: Don't immediately cancel - Stripe has retry logic
              },
            });

            console.log(
              `⚠️ Marked payment issue for customer: ${failedInvoice.customer}`
            );
            console.log(
              `⚡ [WEBHOOK-OPTIMIZED] Payment failure processed efficiently`
            );
          } catch (error) {
            console.error('Error handling payment failure:', error);
          }
        }
        break;

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (outerError) {
    console.error('❌ [WEBHOOK] Outer webhook error:', outerError);
    trackSuspiciousActivity(request, 'WEBHOOK_PROCESSING_ERROR');
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

// ✅ ENHANCED HELPER FUNCTION: Store comprehensive subscription data for webhook-only operation
async function updateSubscriptionInDatabase(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const subscriptionWithPeriods = subscription as any;

  // ✅ FIXED: Calculate subscription dates with proper fallbacks
  let subscriptionStart: Date;
  let subscriptionEnd: Date;

  // Try multiple sources for period dates
  if (
    subscriptionWithPeriods.current_period_start &&
    subscriptionWithPeriods.current_period_end
  ) {
    // Available at subscription level
    subscriptionStart = new Date(
      subscriptionWithPeriods.current_period_start * 1000
    );
    subscriptionEnd = new Date(
      subscriptionWithPeriods.current_period_end * 1000
    );
  } else if (subscription.items?.data?.[0]) {
    // Try subscription item level
    const item = subscription.items.data[0] as any;
    if (item.current_period_start && item.current_period_end) {
      subscriptionStart = new Date(item.current_period_start * 1000);
      subscriptionEnd = new Date(item.current_period_end * 1000);
    } else {
      // Fallback: Use subscription creation time + 30 days
      subscriptionStart = new Date(subscription.created * 1000);
      subscriptionEnd = new Date(
        subscription.created * 1000 + 30 * 24 * 60 * 60 * 1000
      );
      console.warn(
        `⚠️ [WEBHOOK] Using fallback dates for subscription ${subscription.id}`
      );
    }
  } else {
    // Final fallback
    subscriptionStart = new Date(subscription.created * 1000);
    subscriptionEnd = new Date(
      subscription.created * 1000 + 30 * 24 * 60 * 60 * 1000
    );
    console.warn(
      `⚠️ [WEBHOOK] Using final fallback dates for subscription ${subscription.id}`
    );
  }

  // ✅ FIXED: Validate dates before using them
  if (isNaN(subscriptionStart.getTime()) || isNaN(subscriptionEnd.getTime())) {
    console.error(
      `❌ [WEBHOOK] Invalid dates calculated for subscription ${subscription.id}`
    );
    subscriptionStart = new Date();
    subscriptionEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }

  // Determine status based on Stripe subscription status
  let dbStatus: 'ACTIVE' | 'CANCELLED' | 'EXPIRED' | 'FREE' = 'ACTIVE';
  if (subscription.status === 'canceled') {
    dbStatus = 'CANCELLED';
  } else if (
    subscription.status === 'unpaid' ||
    subscription.status === 'past_due'
  ) {
    dbStatus = 'EXPIRED';
  } else if (['active', 'trialing'].includes(subscription.status)) {
    dbStatus = 'ACTIVE';
  }

  // ✅ NEW: Extract comprehensive subscription data
  let productId = null;
  let priceId = null;
  let baseAmount = null;
  let actualAmount = null;
  let currency = null;
  let interval = null;

  if (subscription.items.data.length > 0) {
    const price = subscription.items.data[0].price;
    productId = price.product as string;
    priceId = price.id;
    baseAmount = price.unit_amount; // Original price before discount
    currency = price.currency;
    interval = price.recurring?.interval;
  }

  // ✅ NEW: Extract discount information and calculate actual amount
  let discountPercent = null;
  let discountName = null;

  // Handle both old single discount format and new discounts array format
  const activeDiscount =
    subscription.discounts && subscription.discounts.length > 0
      ? subscription.discounts[0] // New format
      : (subscription as any).discount; // Legacy format

  if (activeDiscount?.coupon) {
    discountPercent = activeDiscount.coupon.percent_off;
    discountName = activeDiscount.coupon.name;
  }

  // ✅ CRITICAL FIX: Calculate the actual amount the customer pays
  if (baseAmount) {
    if (discountPercent && discountPercent > 0) {
      // Calculate the discounted amount (what customer actually pays)
      actualAmount = Math.round(baseAmount * (1 - discountPercent / 100));
      console.log(`💰 [WEBHOOK] Discount calculation:`, {
        baseAmount: `$${(baseAmount / 100).toFixed(2)}`,
        discountPercent: `${discountPercent}%`,
        actualAmount: `$${(actualAmount / 100).toFixed(2)}`,
        savings: `$${((baseAmount - actualAmount) / 100).toFixed(2)}`,
      });
    } else {
      // No discount, actual amount = base amount
      actualAmount = baseAmount;
    }
  }

  // ✅ NEW: Calculate cancellation date
  const cancelledAt = subscription.canceled_at
    ? new Date(subscription.canceled_at * 1000)
    : null;

  // ✅ NEW: Calculate creation date
  const createdAt = subscription.created
    ? new Date(subscription.created * 1000)
    : null;

  console.log(`📊 [WEBHOOK] Storing comprehensive subscription data:`, {
    customerId,
    subscriptionId: subscription.id,
    status: dbStatus,
    start: subscriptionStart.toISOString(),
    end: subscriptionEnd.toISOString(),
    productId,
    priceId,
    baseAmount: baseAmount ? `$${(baseAmount / 100).toFixed(2)}` : null,
    actualAmount: actualAmount ? `$${(actualAmount / 100).toFixed(2)}` : null,
    currency,
    interval,
    autoRenew: !subscription.cancel_at_period_end,
    discountPercent,
    discountName,
    cancelledAt: cancelledAt?.toISOString() || null,
    createdAt: createdAt?.toISOString() || null,
  });

  // ✅ OPTIMIZED: Get customer email efficiently without unnecessary API calls
  let customerEmail = null;
  try {
    if (
      typeof subscription.customer === 'object' &&
      subscription.customer &&
      !subscription.customer.deleted &&
      'email' in subscription.customer
    ) {
      // Customer object is expanded in webhook - use it directly
      customerEmail = subscription.customer.email;
      console.log(
        `📧 [WEBHOOK-OPTIMIZED] Using expanded customer email: ${customerEmail}`
      );
    } else {
      // Customer ID only - skip email for performance (not critical for functionality)
      console.log(
        `⚡ [WEBHOOK-OPTIMIZED] Skipping customer email fetch for performance`
      );
    }
  } catch (error) {
    console.warn(
      `⚠️ [WEBHOOK] Could not get customer email for ${customerId}:`,
      error
    );
  }

  // ✅ FIXED: Removed non-existent subscription table update (subscription data is stored in profile)

  // ✅ NEW: Comprehensive database update with all Stripe data
  const updateData = {
    // Existing fields
    subscriptionStatus: dbStatus,
    subscriptionStart: subscriptionStart,
    subscriptionEnd: subscriptionEnd,
    stripeProductId: productId,
    updatedAt: new Date(),

    // ✅ NEW: Store all Stripe data for webhook-only operation
    stripeSubscriptionId: subscription.id,
    subscriptionAutoRenew: !subscription.cancel_at_period_end,
    stripePriceId: priceId,
    // ✅ CRITICAL FIX: Store the actual amount customer pays (not original price)
    subscriptionAmount: actualAmount, // What customer actually pays after discount
    originalAmount: baseAmount, // Original price before discount for reference
    subscriptionCurrency: currency,
    subscriptionInterval: interval,
    subscriptionCancelledAt: cancelledAt,
    discountPercent: discountPercent,
    discountName: discountName,
    stripeCustomerEmail: customerEmail,
    subscriptionCreated: createdAt,
    lastWebhookUpdate: new Date(),
  };

  // Update all profiles with this customer ID
  const updateResult = await db.profile.updateMany({
    where: { stripeCustomerId: customerId },
    data: updateData,
  });

  console.log(
    `✅ [WEBHOOK] Updated ${updateResult.count} profile(s) with comprehensive Stripe data for customer ${customerId}`
  );

  console.log(
    `⚡ [WEBHOOK-OPTIMIZED] Subscription update completed with zero unnecessary API calls`
  );

  return updateResult;
}
