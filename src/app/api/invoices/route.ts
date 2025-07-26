import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import Stripe from 'stripe';
import { db } from '@/lib/db';
import { rateLimitGeneral, trackSuspiciousActivity } from '@/lib/rate-limit';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function GET(req: NextRequest) {
  try {
    // 1. Rate limiting
    const rateLimitResult = await rateLimitGeneral()(req);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(req, 'Rate limit exceeded on invoice fetch');
      return rateLimitResult.error;
    }

    // 2. Authentication
    const user = await currentUser();
    if (!user) {
      trackSuspiciousActivity(req, 'Unauthorized invoice fetch attempt');
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // 3. Get user's profile to find their Stripe customer ID
    const profile = await db.profile.findFirst({
      where: { userId: user.id },
      select: {
        id: true,
        stripeCustomerId: true,
      },
    });

    if (!profile) {
      return NextResponse.json(
        {
          success: false,
          error: 'Profile not found',
        },
        { status: 404 }
      );
    }

    let customerId = profile.stripeCustomerId;

    // If no customer ID in database, try to find it in Stripe by user email
    if (!customerId) {
      // Get user email from current user object
      const email = user.emailAddresses?.[0]?.emailAddress;

      if (email) {
        // Search for customer by email in Stripe
        const customers = await stripe.customers.list({
          email: email,
          limit: 1,
        });

        if (customers.data.length > 0) {
          customerId = customers.data[0].id;

          // Update database with found customer ID
          await db.profile.update({
            where: { id: profile.id },
            data: { stripeCustomerId: customerId },
          });
        }
      }
    }

    if (!customerId) {
      return NextResponse.json({
        success: true,
        invoices: [],
        message: 'No Stripe customer found',
      });
    }

    // 4. Fetch invoices from Stripe
    const invoices = await stripe.invoices.list({
      customer: customerId,
      limit: 50, // Get last 50 invoices
      expand: ['data.subscription'],
    });

    // 5. Format invoice data
    const formattedInvoices = invoices.data.map(invoice => ({
      id: invoice.id,
      number: invoice.number,
      status: invoice.status,
      created: new Date(invoice.created * 1000).toISOString(),
      due_date: invoice.due_date
        ? new Date(invoice.due_date * 1000).toISOString()
        : null,
      amount_paid: invoice.amount_paid,
      amount_due: invoice.amount_due,
      total: invoice.total,
      currency: invoice.currency,
      hosted_invoice_url: invoice.hosted_invoice_url,
      invoice_pdf: invoice.invoice_pdf,
      description:
        invoice.description ||
        `Subscription for ${new Date(invoice.created * 1000).toLocaleDateString()}`,
      period_start: invoice.period_start
        ? new Date(invoice.period_start * 1000).toISOString()
        : null,
      period_end: invoice.period_end
        ? new Date(invoice.period_end * 1000).toISOString()
        : null,
    }));

    return NextResponse.json({
      success: true,
      invoices: formattedInvoices,
      total: invoices.data.length,
    });
  } catch (error) {
    console.error('❌ Invoice fetch error:', error);

    if (error instanceof Stripe.errors.StripeError) {
      return NextResponse.json(
        {
          success: false,
          error: `Stripe error: ${error.message}`,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch invoices',
      },
      { status: 500 }
    );
  }
}
