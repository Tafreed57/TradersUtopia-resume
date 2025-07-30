import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import Stripe from 'stripe';
import { handleCheckoutSessionCompleted } from '@/webhooks/stripe/checkout.session.completed';
import { handleSubscriptionCreated } from '@/webhooks/stripe/customer.subscription.created';
import { handleSubscriptionDeleted } from '@/webhooks/stripe/customer.subscription.deleted';
import { handleSubscriptionUpdated } from '@/webhooks/stripe/customer.subscription.updated';
import { handleInvoicePaymentFailed } from '@/webhooks/stripe/invoice.payment_failed';
import { handleInvoicePaymentSucceeded } from '@/webhooks/stripe/invoice.payment_succeeded';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-06-30.basil',
});

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = headers().get('stripe-signature')!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Webhook signature verification failed' },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(
          event.data.object as Stripe.Subscription
        );
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(
          event.data.object as Stripe.Subscription
        );
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription
        );
        break;

      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(
          event.data.object as Stripe.Checkout.Session
        );
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(
          event.data.object as Stripe.Invoice
        );
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      // Other events we acknowledge but don't process
      case 'customer.subscription.paused':
      case 'customer.subscription.resumed':
      case 'customer.subscription.trial_will_end':
      case 'invoice.payment_action_required':
      case 'invoice.upcoming':
      case 'invoice.created':
      case 'invoice.finalized':
      case 'customer.created':
      case 'customer.updated':
      case 'customer.deleted':
        // Acknowledge these events without processing
        break;

      default:
        // Unhandled event type - just acknowledge
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
