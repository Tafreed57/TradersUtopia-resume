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

        // Handle cases where customer might be null (when customer_creation is "if_required")
        if (session.customer) {
          // Customer object exists, get details from Stripe
          customerId = session.customer as string;
          const customer = await stripe.customers.retrieve(customerId);

          if (customer.deleted) {
            console.error('Customer was deleted');
            return NextResponse.json(
              { error: 'Customer deleted' },
              { status: 400 }
            );
          }

          email = customer.email;
          customerName = customer.name || null;
        } else if (session.customer_details?.email) {
          // Use customer details from session when no customer object exists
          email = session.customer_details.email;
          customerName = session.customer_details.name;
        }

        if (!email) {
          console.error('No email found in session or customer');
          return NextResponse.json(
            { error: 'No email found' },
            { status: 400 }
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

            // Get product ID from the checkout session
            let stripeProductId = null;
            if (session.line_items) {
              try {
                const lineItems = await stripe.checkout.sessions.listLineItems(
                  session.id
                );
                if (lineItems.data.length > 0 && lineItems.data[0].price) {
                  const price = await stripe.prices.retrieve(
                    lineItems.data[0].price.id
                  );
                  stripeProductId = price.product as string;
                  console.log(
                    `📦 Product ID from checkout: ${stripeProductId}`
                  );
                }
              } catch (error) {
                console.log(
                  'Could not retrieve product ID from line items:',
                  error
                );
              }
            }

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
              `✅ Created new profile for user: ${email} with product: ${stripeProductId}`
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

            // Get product ID from the checkout session
            let stripeProductId = null;
            if (session.line_items) {
              try {
                const lineItems = await stripe.checkout.sessions.listLineItems(
                  session.id
                );
                if (lineItems.data.length > 0 && lineItems.data[0].price) {
                  const price = await stripe.prices.retrieve(
                    lineItems.data[0].price.id
                  );
                  stripeProductId = price.product as string;
                  console.log(
                    `📦 Product ID from checkout: ${stripeProductId}`
                  );
                }
              } catch (error) {
                console.log(
                  'Could not retrieve product ID from line items:',
                  error
                );
              }
            }

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
                // ✅ FIX: Also try to get the actual subscription ID from Stripe
                ...(customerId
                  ? await getSubscriptionDataFromCheckout(
                      customerId,
                      session.id,
                      stripeProductId
                    )
                  : {}),
                updatedAt: new Date(),
              },
            });

            console.log(
              `✅ [SECURITY] Updated single profile: ${updated.id} (${updated.userId}) with product: ${stripeProductId}`
            );
            console.log(
              `📅 Subscription valid until: ${subscriptionEnd.toISOString()}`
            );
            console.log(
              `🔒 [SECURITY] Access granted to specific account only, not all accounts with same email`
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
        } catch (error) {
          console.error('Error cancelling subscription:', error);
          return NextResponse.json(
            { error: 'Cancellation failed' },
            { status: 500 }
          );
        }
        break;

      case 'invoice.payment_succeeded':
        // Handle successful payment - extend subscription
        const successfulInvoice = event.data.object as Stripe.Invoice;
        console.log(
          `💳 Payment succeeded for invoice: ${successfulInvoice.id}`
        );

        const successfulInvoiceWithSubscription = successfulInvoice as any;
        if (successfulInvoiceWithSubscription.subscription) {
          try {
            const subscription = await stripe.subscriptions.retrieve(
              successfulInvoiceWithSubscription.subscription as string
            );
            await updateSubscriptionInDatabase(subscription);
            console.log(`✅ Updated subscription after successful payment`);
          } catch (error) {
            console.error('Error updating subscription after payment:', error);
          }
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

  // ✅ NEW: Get customer email (try to avoid extra API call if possible)
  let customerEmail = null;
  try {
    if (
      typeof subscription.customer === 'object' &&
      subscription.customer &&
      !subscription.customer.deleted &&
      'email' in subscription.customer
    ) {
      // Customer object is expanded in webhook
      customerEmail = subscription.customer.email;
    } else {
      // Fall back to API call only if needed
      const customer = await stripe.customers.retrieve(customerId);
      if (!customer.deleted && customer.email) {
        customerEmail = customer.email;
      }
    }
  } catch (error) {
    console.warn(
      `⚠️ [WEBHOOK] Could not fetch customer email for ${customerId}:`,
      error
    );
  }

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

  return updateResult;
}

// ✅ NEW: Helper function to get subscription data during checkout processing
async function getSubscriptionDataFromCheckout(
  customerId: string,
  sessionId: string,
  productId: string | null
) {
  try {
    console.log(
      `🔍 [CHECKOUT-SUBSCRIPTION] Attempting to fetch subscription for customer: ${customerId}`
    );

    // Get the customer's subscriptions from Stripe
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 5,
    });

    // Find the most recent active subscription that matches our product
    let targetSubscription = null;

    if (productId) {
      // Look for subscription with matching product
      targetSubscription = subscriptions.data.find(
        sub =>
          sub.items.data.some(item => item.price.product === productId) &&
          ['active', 'trialing'].includes(sub.status)
      );
    }

    // If no product match, get the most recent active subscription
    if (!targetSubscription) {
      targetSubscription = subscriptions.data.find(sub =>
        ['active', 'trialing'].includes(sub.status)
      );
    }

    if (targetSubscription) {
      console.log(
        `✅ [CHECKOUT-SUBSCRIPTION] Found subscription: ${targetSubscription.id}`
      );

      // Extract comprehensive data like the webhook does
      const price = targetSubscription.items.data[0]?.price;
      let discountPercent = null;
      let discountName = null;

      // Handle discounts
      const activeDiscount =
        targetSubscription.discounts && targetSubscription.discounts.length > 0
          ? targetSubscription.discounts[0]
          : (targetSubscription as any).discount;

      if (activeDiscount?.coupon) {
        discountPercent = activeDiscount.coupon.percent_off;
        discountName = activeDiscount.coupon.name;
      }

      const subscriptionData = {
        stripeSubscriptionId: targetSubscription.id,
        subscriptionAutoRenew: !targetSubscription.cancel_at_period_end,
        stripePriceId: price?.id,
        subscriptionAmount: price?.unit_amount,
        subscriptionCurrency: price?.currency,
        subscriptionInterval: price?.recurring?.interval,
        discountPercent,
        discountName,
        subscriptionCreated: new Date(targetSubscription.created * 1000),
        lastWebhookUpdate: new Date(),
      };

      console.log(
        `📊 [CHECKOUT-SUBSCRIPTION] Populated subscription data:`,
        subscriptionData
      );
      return subscriptionData;
    } else {
      console.log(
        `⚠️ [CHECKOUT-SUBSCRIPTION] No active subscription found for customer: ${customerId}`
      );
      return {};
    }
  } catch (error) {
    console.error(
      `❌ [CHECKOUT-SUBSCRIPTION] Error fetching subscription data:`,
      error
    );
    return {}; // Return empty object on error to not break the main flow
  }
}
