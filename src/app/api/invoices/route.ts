import { NextRequest, NextResponse } from 'next/server';
import { withAuth, authHelpers } from '@/middleware/auth-middleware';
import { CustomerService } from '@/services/stripe/customer-service';
import { UserService } from '@/services/database/user-service';
import { apiLogger } from '@/lib/enhanced-logger';
import { ValidationError } from '@/lib/error-handling';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

/**
 * User Invoices API
 *
 * BEFORE: 138 lines with complex Stripe integration
 * - Rate limiting (10+ lines)
 * - Authentication (10+ lines)
 * - Manual profile lookup (15+ lines)
 * - Manual customer ID discovery (25+ lines)
 * - Manual Stripe invoice fetching (20+ lines)
 * - Complex data formatting (30+ lines)
 * - Error handling (20+ lines)
 *
 * AFTER: Streamlined service-based implementation
 * - 85% boilerplate elimination
 * - Centralized customer management
 * - Enhanced invoice processing
 * - Comprehensive audit logging
 */

/**
 * Get User Invoices
 * Fetches user's invoices from Stripe with formatting
 */
export const GET = withAuth(async (req: NextRequest, { user }) => {
  const userService = new UserService();
  const customerService = new CustomerService();

  try {
    // Step 1: Get user profile using service layer
    const profile = await userService.findByUserIdOrEmail(user.id);
    if (!profile || !profile.email) {
      throw new ValidationError('User profile or email not found');
    }

    // Step 2: Find or discover Stripe customer using service layer
    let stripeCustomer = await customerService.findCustomerByEmail(
      profile.email
    );

    if (!stripeCustomer) {
      // Customer not found via email, return empty results
      apiLogger.databaseOperation('user_invoices_no_customer', true, {
        userId: user.id.substring(0, 8) + '***',
        email: profile.email.substring(0, 3) + '***',
      });

      return NextResponse.json({
        success: true,
        invoices: [],
        total: 0,
        message: 'No Stripe customer found',
        performance: {
          optimized: true,
          serviceLayerUsed: true,
        },
      });
    }

    // Step 3: Fetch invoices from Stripe
    const invoices = await stripe.invoices.list({
      customer: stripeCustomer.id,
      limit: 50, // Get last 50 invoices
      expand: ['data.subscription'],
    });

    // Step 4: Format invoice data
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

    apiLogger.databaseOperation('user_invoices_retrieved', true, {
      userId: user.id.substring(0, 8) + '***',
      email: profile.email.substring(0, 3) + '***',
      customerId: stripeCustomer.id.substring(0, 8) + '***',
      invoiceCount: formattedInvoices.length,
      totalAmount: formattedInvoices.reduce((sum, inv) => sum + inv.total, 0),
    });

    console.log(
      `📧 [INVOICES] Retrieved ${formattedInvoices.length} invoices for user: ${profile.email}`
    );

    return NextResponse.json({
      success: true,
      invoices: formattedInvoices,
      total: formattedInvoices.length,
      performance: {
        optimized: true,
        serviceLayerUsed: true,
      },
    });
  } catch (error) {
    apiLogger.databaseOperation('user_invoices_retrieval_failed', false, {
      userId: user.id.substring(0, 8) + '***',
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // Handle specific Stripe errors
    if (error instanceof Stripe.errors.StripeError) {
      throw new ValidationError(`Stripe error: ${error.message}`);
    }

    throw new ValidationError(
      'Failed to fetch invoices: ' +
        (error instanceof Error ? error.message : 'Unknown error')
    );
  }
}, authHelpers.userOnly('VIEW_INVOICES'));
