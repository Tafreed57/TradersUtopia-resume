import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db } from '@/lib/db';
import { rateLimitWebhook, trackSuspiciousActivity } from '@/lib/rate-limit';
import { getStripeInstance, getWebhookSecret } from '@/lib/stripe';

export async function POST(request: NextRequest) {
  try {
    // ✅ SECURITY: Rate limiting for webhook operations (generous limit for external systems)
    const rateLimitResult = await rateLimitWebhook()(request);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(request, 'STRIPE_WEBHOOK_RATE_LIMIT_EXCEEDED');
      return rateLimitResult.error;
    }

    const stripe = getStripeInstance();
    const endpointSecret = getWebhookSecret();

    if (!stripe || !endpointSecret) {
      console.error('❌ [WEBHOOK] Stripe not properly configured');
      return NextResponse.json(
        { error: 'Webhook service not configured' },
        { status: 503 }
      );
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

        // Extract product ID from line items or subscription
        let stripeProductId: string | null = null;

        if (session.line_items) {
          try {
            // Retrieve line items if not already expanded
            const lineItems = await stripe.checkout.sessions.listLineItems(
              session.id,
              { limit: 10 }
            );

            if (lineItems.data.length > 0) {
              const priceId = lineItems.data[0].price?.id;
              if (priceId) {
                const price = await stripe.prices.retrieve(priceId);
                stripeProductId = price.product as string;
              }
            }
          } catch (error) {
            console.error('Failed to retrieve line items:', error);
          }
        }

        if (!stripeProductId && session.subscription) {
          try {
            const subscription = await stripe.subscriptions.retrieve(
              session.subscription as string
            );
            if (subscription.items.data.length > 0) {
              const priceId = subscription.items.data[0].price.id;
              const price = await stripe.prices.retrieve(priceId);
              stripeProductId = price.product as string;
            }
          } catch (error) {
            console.error('Failed to retrieve subscription product:', error);
          }
        }

        console.log(
          `📦 Product ID from checkout: ${stripeProductId || 'Unknown'}`
        );

        // Check if user already exists in database
        const existingProfile = await db.profile.findFirst({
          where: { email },
        });

        if (existingProfile) {
          // Update existing user's subscription
          await db.profile.update({
            where: { id: existingProfile.id },
            data: {
              subscriptionStatus: 'ACTIVE',
              subscriptionStart: new Date(),
              subscriptionEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
              stripeCustomerId: customerId,
              stripeSessionId: session.id,
              stripeProductId: stripeProductId,
            },
          });

          console.log(
            `✅ Updated existing profile for user: ${email} with product: ${stripeProductId}`
          );
        } else {
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
            `✅ Created new profile for user: ${email} with product: ${stripeProductId}`
          );
        }

        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        const subscription = event.data.object as Stripe.Subscription;

        // Update database with subscription changes
        if (subscription.customer) {
          const customer = (await stripe.customers.retrieve(
            subscription.customer as string
          )) as Stripe.Customer;

          if (!customer.deleted && customer.email) {
            // Type cast to access period properties
            const subscriptionWithPeriods = subscription as any;

            await db.profile.updateMany({
              where: { email: customer.email },
              data: {
                subscriptionStatus:
                  subscription.status === 'active' ? 'ACTIVE' : 'EXPIRED',
                subscriptionStart: new Date(
                  subscriptionWithPeriods.current_period_start * 1000
                ),
                subscriptionEnd: new Date(
                  subscriptionWithPeriods.current_period_end * 1000
                ),
              },
            });

            console.log(
              `✅ Updated subscription for customer: ${customer.email}`
            );
          }
        }
        break;

      case 'customer.subscription.deleted':
        const deletedSubscription = event.data.object as Stripe.Subscription;

        // Mark subscription as cancelled
        if (deletedSubscription.customer) {
          const customer = (await stripe.customers.retrieve(
            deletedSubscription.customer as string
          )) as Stripe.Customer;

          if (!customer.deleted && customer.email) {
            await db.profile.updateMany({
              where: { email: customer.email },
              data: {
                subscriptionStatus: 'CANCELLED',
              },
            });

            console.log(
              `✅ Marked subscription as cancelled for customer: ${customer.email}`
            );
          }
        }
        break;

      case 'invoice.payment_succeeded':
        const invoice = event.data.object as Stripe.Invoice;
        console.log(`💰 Payment succeeded for invoice: ${invoice.id}`);
        break;

      case 'invoice.payment_failed':
        const failedInvoice = event.data.object as Stripe.Invoice;
        console.log(`❌ Payment failed for invoice: ${failedInvoice.id}`);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('❌ [WEBHOOK] Error:', error);
    return NextResponse.json({ error: 'Webhook failed' }, { status: 500 });
  }
}
