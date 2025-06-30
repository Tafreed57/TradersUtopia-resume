import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import Stripe from 'stripe';

// Mark this route as dynamic to prevent static generation
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-05-28.basil',
  });
  try {
    const user = await currentUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const clerkEmails = user.emailAddresses.map(email => email.emailAddress);
    const primaryEmail = user.emailAddresses[0]?.emailAddress;

    console.log('🔍 Debugging email mismatch');
    console.log('Clerk emails:', clerkEmails);

    // Search for customers with each email
    const stripeSearchResults = [];

    for (const email of clerkEmails) {
      try {
        const customers = await stripe.customers.list({
          email: email,
          limit: 5,
        });

        stripeSearchResults.push({
          searchEmail: email,
          found: customers.data.length > 0,
          customers: customers.data.map(c => ({
            id: c.id,
            email: c.email,
            name: c.name,
            created: new Date(c.created * 1000).toISOString(),
          })),
        });
      } catch (error) {
        console.error('Stripe customer search error for email:', email, error);
        stripeSearchResults.push({
          searchEmail: email,
          found: false,
          error: 'Search failed',
        });
      }
    }

    // Also search for customers with similar names
    let nameSearchResults: any[] = [];
    if (user.firstName && user.lastName) {
      try {
        const nameQuery = `${user.firstName} ${user.lastName}`;
        const customersByName = await stripe.customers.search({
          query: `name:'${nameQuery}'`,
          limit: 5,
        });

        nameSearchResults = customersByName.data.map(c => ({
          id: c.id,
          email: c.email,
          name: c.name,
          created: new Date(c.created * 1000).toISOString(),
        }));
      } catch (error) {
        console.log('Name search error:', error);
      }
    }

    return NextResponse.json({
      clerkUser: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        primaryEmail: primaryEmail,
        allEmails: clerkEmails,
      },
      stripeSearchByEmail: stripeSearchResults,
      stripeSearchByName: nameSearchResults,
      summary: {
        clerkEmailCount: clerkEmails.length,
        stripeMatchesFound: stripeSearchResults.filter(r => r.found).length,
        nameMatchesFound: nameSearchResults.length,
      },
    });
  } catch (error) {
    console.error('❌ Error debugging emails:', error);

    // ✅ SECURITY: Generic error response - no internal details exposed
    return NextResponse.json(
      {
        error: 'Debug operation failed',
        message:
          'Unable to retrieve email debug information. Please try again later.',
      },
      { status: 500 }
    );
  }
}
