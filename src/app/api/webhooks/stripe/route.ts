import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db } from '@/lib/db';
import { rateLimitWebhook, trackSuspiciousActivity } from '@/lib/rate-limit';
import { completedCheckout } from '@/webhooks/stripe/checkout.session.completed';
import { customerSubscriptionCreated } from '@/webhooks/stripe/customer.subscription.created';
import { customerSubscriptionUpdated } from '@/webhooks/stripe/customer.subscription.updated';
import { customerSubscriptionDeleted } from '@/webhooks/stripe/customer.subscription.deleted';
import { invoicePaymentSucceeded } from '@/webhooks/stripe/invoice.payment_succeeded';
import { invoicePaymentFailed } from '@/webhooks/stripe/invoice.payment_failed';

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
    console.log('🎯 [WEBHOOK] Processing Stripe webhook event...');
    const signature = request.headers.get('stripe-signature')!;

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, endpointSecret);
    } catch (err: any) {
      console.error('⚠️  Webhook signature verification failed.', err.message);
      return NextResponse.json({ error: 'Webhook Error' }, { status: 400 });
    }

    console.log(`📥 [WEBHOOK] Processing event: ${event.type}`);

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed':
        console.log('🛒 [WEBHOOK] Processing checkout completion...');
        return completedCheckout(event);
      case 'customer.subscription.created':
        console.log('🆕 [WEBHOOK] Processing new subscription...');
        return customerSubscriptionCreated(event);
      case 'customer.subscription.updated':
        console.log('🔄 [WEBHOOK] Processing subscription update...');
        return customerSubscriptionUpdated(event);
      case 'customer.subscription.deleted':
        console.log('❌ [WEBHOOK] Processing subscription cancellation...');
        return customerSubscriptionDeleted(event);
      case 'invoice.payment_succeeded':
        console.log('💳 [WEBHOOK] Processing successful payment...');
        return invoicePaymentSucceeded(event);
      case 'invoice.payment_failed':
        console.log('⚠️ [WEBHOOK] Processing failed payment...');
        return invoicePaymentFailed(event);
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
