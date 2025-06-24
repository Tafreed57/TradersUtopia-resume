import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-05-28.basil',
});

export async function GET(request: NextRequest) {
  try {
    const user = await currentUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const userEmail = user.emailAddresses[0]?.emailAddress;
    if (!userEmail) {
      return NextResponse.json({ error: 'No email found' }, { status: 400 });
    }

    console.log(`🔍 Debugging Stripe data for: ${userEmail}`);

    // Search for customer in Stripe by email
    const customers = await stripe.customers.list({
      email: userEmail,
      limit: 1,
    });

    if (customers.data.length === 0) {
      return NextResponse.json({
        message: 'No customer found in Stripe with this email',
        email: userEmail,
        customerExists: false,
      });
    }

    const customer = customers.data[0];
    console.log(`✅ Found Stripe customer: ${customer.id}`);

    // Get all data for this customer
    const [subscriptions, paymentIntents, checkoutSessions, invoices] = await Promise.all([
      stripe.subscriptions.list({ customer: customer.id, limit: 10 }),
      stripe.paymentIntents.list({ customer: customer.id, limit: 10 }),
      stripe.checkout.sessions.list({ customer: customer.id, limit: 10 }),
      stripe.invoices.list({ customer: customer.id, limit: 10 }),
    ]);

    return NextResponse.json({
      message: 'Stripe data retrieved successfully',
      email: userEmail,
      customerExists: true,
      customer: {
        id: customer.id,
        email: customer.email,
        name: customer.name,
        created: new Date(customer.created * 1000).toISOString(),
      },
      subscriptions: {
        total: subscriptions.data.length,
        active: subscriptions.data.filter(s => s.status === 'active').length,
        data: subscriptions.data.map(sub => ({
          id: sub.id,
          status: sub.status,
          created: new Date(sub.created * 1000).toISOString(),
        }))
      },
      paymentIntents: {
        total: paymentIntents.data.length,
        succeeded: paymentIntents.data.filter(p => p.status === 'succeeded').length,
        data: paymentIntents.data.map(payment => ({
          id: payment.id,
          status: payment.status,
          amount: payment.amount,
          currency: payment.currency,
          created: new Date(payment.created * 1000).toISOString(),
        }))
      },
      checkoutSessions: {
        total: checkoutSessions.data.length,
        completed: checkoutSessions.data.filter(s => s.status === 'complete').length,
        data: checkoutSessions.data.map(session => ({
          id: session.id,
          status: session.status,
          amount_total: session.amount_total,
          currency: session.currency,
          payment_status: session.payment_status,
          created: new Date(session.created * 1000).toISOString(),
        }))
      },
      invoices: {
        total: invoices.data.length,
        paid: invoices.data.filter(i => i.status === 'paid').length,
        data: invoices.data.map(invoice => ({
          id: invoice.id,
          status: invoice.status,
          amount_due: invoice.amount_due,
          amount_paid: invoice.amount_paid,
          currency: invoice.currency,
          created: new Date(invoice.created * 1000).toISOString(),
        }))
      }
    });

  } catch (error) {
    console.error('❌ Error debugging Stripe data:', error);
    
    // ✅ SECURITY: Generic error response - no internal details exposed
    return NextResponse.json({ 
      error: 'Debug operation failed',
      message: 'Unable to retrieve debug information. Please try again later.'
    }, { status: 500 });
  }
} 