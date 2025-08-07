import Stripe from 'stripe';
import { BaseStripeService } from '../base/base-stripe-service';
import { maskEmail } from '@/lib/error-handling';

/**
 * CustomerLookup - Handles customer finding and lookup operations
 *
 * Focused sub-service for customer discovery and retrieval operations.
 */
export class CustomerLookup extends BaseStripeService {
  /**
   * Find customer by email - Most critical method (used 8+ times)
   * Replaces scattered findCustomerByEmail implementations
   */
  async findCustomerByEmail(email: string): Promise<Stripe.Customer | null> {
    this.validateEmailForStripe(email);

    return await this.handleStripeOperation(
      async () => {
        const customers = await this.stripe.customers.list({
          email,
          limit: 1,
          expand: this.buildExpandParams(),
        });

        return customers.data[0] || null;
      },
      'find_customer_by_email',
      { email: maskEmail(email) }
    );
  }

  /**
   * Find customer with expanded subscription data
   * Used in subscription management flows
   */
  async findCustomerWithSubscriptions(
    email: string
  ): Promise<Stripe.Customer | null> {
    this.validateEmailForStripe(email);

    return await this.handleStripeOperation(
      async () => {
        const customers = await this.stripe.customers.list({
          email,
          limit: 1,
          expand: this.buildExpandParams([
            'data.subscriptions',
            'data.subscriptions.data.latest_invoice',
            'data.subscriptions.data.items',
            'data.subscriptions.data.discounts',
            'data.subscriptions.data.discounts.coupon',
          ]),
        });

        return customers.data[0] || null;
      },
      'find_customer_with_subscriptions',
      { email: maskEmail(email) }
    );
  }

  /**
   * Find customer by ID with full details
   * Used for admin operations and detailed customer views
   */
  async findCustomerById(customerId: string): Promise<Stripe.Customer | null> {
    this.validateCustomerId(customerId);

    return await this.handleStripeOperation(
      async () => {
        try {
          const customer = await this.stripe.customers.retrieve(customerId, {
            expand: this.buildExpandParams([
              'subscriptions',
              'subscriptions.data.latest_invoice',
              'default_source',
            ]),
          });

          // Return null if customer was deleted
          if (customer.deleted) {
            return null;
          }

          return customer as Stripe.Customer;
        } catch (error: any) {
          if (error.code === 'resource_missing') {
            return null;
          }
          throw error;
        }
      },
      'find_customer_by_id',
      { customerId }
    );
  }

  /**
   * Get customer subscription summary
   * Used in dashboards to show customer status
   */
  async getCustomerSubscriptionSummary(customerId: string): Promise<{
    customer: Stripe.Customer;
    hasActiveSubscription: boolean;
    subscriptionCount: number;
    totalSpent: number;
    lastPaymentDate?: Date;
  }> {
    this.validateCustomerId(customerId);

    return await this.handleStripeOperation(
      async () => {
        const customer = (await this.stripe.customers.retrieve(customerId, {
          expand: this.buildExpandParams(['subscriptions']),
        })) as Stripe.Customer;

        if (!customer) {
          throw new Error('Customer not found');
        }

        const subscriptions = customer.subscriptions?.data || [];
        const hasActiveSubscription = subscriptions.some(
          sub => sub.status === 'active' || sub.status === 'trialing'
        );

        // Get invoices to calculate total spent
        const invoices = await this.stripe.invoices.list({
          customer: customerId,
          status: 'paid',
          limit: 100, // Get recent paid invoices
        });

        const totalSpent = invoices.data.reduce(
          (sum, invoice) => sum + (invoice.amount_paid || 0),
          0
        );

        const lastPaymentDate = invoices.data[0]?.status_transitions?.paid_at
          ? new Date(invoices.data[0].status_transitions.paid_at * 1000)
          : undefined;

        return {
          customer,
          hasActiveSubscription,
          subscriptionCount: subscriptions.length,
          totalSpent,
          lastPaymentDate,
        };
      },
      'get_customer_subscription_summary',
      { customerId }
    );
  }
}
