import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db } from '@/lib/db';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-05-28.basil',
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
          return NextResponse.json({ error: 'Customer deleted' }, { status: 400 });
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
        return NextResponse.json({ error: 'No email found' }, { status: 400 });
      }

      try {
        console.log(`🔍 Looking for profiles with email: ${email}`);
        
        // Find ALL profiles with this email (to handle duplicates)
        const allProfiles = await db.profile.findMany({
          where: { email: email },
          orderBy: { createdAt: 'desc' } // Most recent first
        });

        if (allProfiles.length === 0) {
          console.log(`No profiles found for email: ${email}, creating new profile...`);
          
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
            }
          });
          
          console.log(`✅ Created new profile for user: ${email}`);
        } else {
          console.log(`✅ Found ${allProfiles.length} profile(s) for email: ${email}`);
          
          // Log all profiles found
          allProfiles.forEach((profile, index) => {
            console.log(`   Profile ${index + 1}: ${profile.id} (${profile.userId}) - Status: ${profile.subscriptionStatus}`);
          });
          
          // Update ALL profiles with the same email to ACTIVE status
          // This ensures no matter which account the user is logged into, they'll have access
          const subscriptionStart = new Date();
          const subscriptionEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
          
          console.log(`🔄 Updating all ${allProfiles.length} profiles to ACTIVE status...`);
          
          const updateResults = await Promise.all(
            allProfiles.map(async (profile) => {
              const updated = await db.profile.update({
                where: { id: profile.id },
                data: {
                  subscriptionStatus: 'ACTIVE',
                  subscriptionStart: subscriptionStart,
                  subscriptionEnd: subscriptionEnd,
                  stripeCustomerId: customerId, // This might be null, which is fine
                  stripeSessionId: session.id,
                }
              });
              
              console.log(`   ✅ Updated profile: ${updated.id} (${updated.userId})`);
              return updated;
            })
          );
          
          console.log(`✅ Successfully updated all profiles for ${email}`);
          console.log(`📅 Subscription valid until: ${subscriptionEnd.toISOString()}`);
          console.log(`🎉 User ${email} should now have access from any account!`);
        }
        
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
