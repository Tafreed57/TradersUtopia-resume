import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db } from '@/lib/db';
import { rateLimitWebhook, trackSuspiciousActivity } from '@/lib/rate-limit';

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

        console.log(`🎉 Checkout session completed: ${session.id}`);

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
          console.log(`📧 Using email from customer_details: ${email}`);
        }

        if (!email) {
          console.error('No email found in session or customer');
          return NextResponse.json(
            { error: 'No email found' },
            { status: 400 }
          );
        }

        try {
          console.log(`🔍 Looking for profiles with email: ${email}`);

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

            const updated = await db.profile.update({
              where: { id: targetProfile.id },
              data: {
                subscriptionStatus: 'ACTIVE',
                subscriptionStart: subscriptionStart,
                subscriptionEnd: subscriptionEnd,
                stripeCustomerId: customerId,
                stripeSessionId: session.id,
                stripeProductId: stripeProductId,
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

// ✅ HELPER FUNCTION: Update subscription data in database
async function updateSubscriptionInDatabase(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const subscriptionWithPeriods = subscription as any;

  // Calculate subscription dates
  const subscriptionStart = new Date(
    subscriptionWithPeriods.current_period_start * 1000
  );
  const subscriptionEnd = new Date(
    subscriptionWithPeriods.current_period_end * 1000
  );

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

  // Get product ID from subscription
  let productId = null;
  if (subscription.items.data.length > 0) {
    const price = subscription.items.data[0].price;
    productId = price.product as string;
  }

  console.log(`📊 Updating subscription in database:`, {
    customerId,
    subscriptionId: subscription.id,
    status: dbStatus,
    start: subscriptionStart,
    end: subscriptionEnd,
    productId,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  });

  // Update all profiles with this customer ID
  const updateResult = await db.profile.updateMany({
    where: { stripeCustomerId: customerId },
    data: {
      subscriptionStatus: dbStatus,
      subscriptionStart: subscriptionStart,
      subscriptionEnd: subscriptionEnd,
      stripeProductId: productId,
      // Store additional subscription metadata that can be used in UI
      updatedAt: new Date(),
    },
  });

  console.log(
    `✅ Updated ${updateResult.count} profile(s) for customer ${customerId}`
  );

  return updateResult;
}
