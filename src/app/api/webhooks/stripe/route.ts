import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db } from '@/lib/db';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
});

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
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
      
      // Get the customer ID from the session
      const customerId = session.customer as string;
      
      // Get customer details from Stripe
      const customer = await stripe.customers.retrieve(customerId);
      
      if (customer.deleted) {
        console.error('Customer was deleted');
        return NextResponse.json({ error: 'Customer deleted' }, { status: 400 });
      }

      const email = customer.email;
      
      if (!email) {
        console.error('No email found for customer');
        return NextResponse.json({ error: 'No email found' }, { status: 400 });
      }

      try {
        // Find the user by email and update their subscription status
        const profile = await db.profile.findFirst({
          where: { email: email }
        });

        if (!profile) {
          console.error(`No profile found for email: ${email}`);
          return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
        }

        // Update the user's subscription status
        await db.profile.update({
          where: { id: profile.id },
          data: {
            subscriptionStatus: 'ACTIVE',
            subscriptionStart: new Date(),
            subscriptionEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
            stripeCustomerId: customerId,
            stripeSessionId: session.id,
          }
        });

        console.log(`✅ Successfully updated subscription for user: ${email}`);
        
      } catch (error) {
        console.error('Error updating profile:', error);
        return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
      }
      
      break;
    
    case 'customer.subscription.deleted':
      // Handle subscription cancellation
      const subscription = event.data.object as Stripe.Subscription;
      const cancelledCustomerId = subscription.customer as string;
      
      try {
        await db.profile.updateMany({
          where: { stripeCustomerId: cancelledCustomerId },
          data: {
            subscriptionStatus: 'CANCELLED',
            subscriptionEnd: new Date(),
          }
        });
        
        console.log(`✅ Successfully cancelled subscription for customer: ${cancelledCustomerId}`);
      } catch (error) {
        console.error('Error cancelling subscription:', error);
        return NextResponse.json({ error: 'Cancellation failed' }, { status: 500 });
      }
      
      break;
    
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  return NextResponse.json({ received: true });
}
