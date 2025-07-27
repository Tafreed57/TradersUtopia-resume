import Stripe from 'stripe';
import { BaseStripeService } from './base/base-stripe-service';
import { CreateCustomerData, UpdateCustomerData } from '../types';
import { maskEmail } from '@/lib/error-handling';

/**
 * CustomerService - Handles all Stripe customer operations
 * Eliminates 8+ duplicate implementations across the codebase
 */
export class CustomerService extends BaseStripeService {
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
            'data.subscriptions.data.items.data.price',
          ]),
        });

        return customers.data[0] || null;
      },
      'find_customer_with_subscriptions',
      { email: maskEmail(email) }
    );
  }

  /**
   * Create new Stripe customer with standardized metadata
   */
  async createCustomer(data: CreateCustomerData): Promise<Stripe.Customer> {
    this.validateEmailForStripe(data.email);

    return await this.handleStripeOperation(
      () =>
        this.stripe.customers.create({
          email: data.email,
          name: data.name,
          metadata: this.buildMetadata(data.metadata),
        }),
      'create_customer',
      { email: maskEmail(data.email), name: data.name }
    );
  }

  /**
   * Update existing customer information
   */
  async updateCustomer(
    customerId: string,
    data: UpdateCustomerData
  ): Promise<Stripe.Customer> {
    this.validateCustomerId(customerId);

    if (data.email) {
      this.validateEmailForStripe(data.email);
    }

    return await this.handleStripeOperation(
      () =>
        this.stripe.customers.update(customerId, {
          name: data.name,
          email: data.email,
          metadata: data.metadata
            ? this.buildMetadata(data.metadata)
            : undefined,
        }),
      'update_customer',
      {
        customerId: customerId.substring(0, 8) + '***',
        email: data.email ? maskEmail(data.email) : undefined,
      }
    );
  }

  /**
   * Retrieve customer by ID with expanded data
   */
  async getCustomer(
    customerId: string,
    expand?: string[]
  ): Promise<Stripe.Customer> {
    this.validateCustomerId(customerId);

    return await this.handleStripeOperation(
      async () => {
        const customer = await this.stripe.customers.retrieve(customerId, {
          expand: this.buildExpandParams(expand),
        });

        if (!customer || customer.deleted) {
          throw new Error('Customer not found or deleted');
        }

        return customer as Stripe.Customer;
      },
      'get_customer',
      { customerId: customerId.substring(0, 8) + '***' }
    );
  }

  /**
   * Delete customer (used in data cleanup operations)
   */
  async deleteCustomer(customerId: string): Promise<Stripe.DeletedCustomer> {
    this.validateCustomerId(customerId);

    return await this.handleStripeOperation(
      () => this.stripe.customers.del(customerId),
      'delete_customer',
      { customerId: customerId.substring(0, 8) + '***' }
    );
  }

  /**
   * List customers with pagination support
   * Used in admin operations
   */
  async listCustomers(
    options: {
      limit?: number;
      startingAfter?: string;
      endingBefore?: string;
      email?: string;
      created?: Stripe.RangeQueryParam | number;
    } = {}
  ): Promise<Stripe.ApiList<Stripe.Customer>> {
    const listParams = this.buildListParams(options);

    return await this.handleStripeOperation(
      () =>
        this.stripe.customers.list({
          ...listParams,
          email: options.email,
          created: options.created,
          expand: this.buildExpandParams(['data.subscriptions']),
        }),
      'list_customers',
      {
        limit: listParams.limit,
        email: options.email ? maskEmail(options.email) : undefined,
      }
    );
  }

  /**
   * Search customers by metadata or other criteria
   * Used for advanced customer management
   */
  async searchCustomers(
    query: string
  ): Promise<Stripe.ApiSearchResult<Stripe.Customer>> {
    return await this.handleStripeOperation(
      () =>
        this.stripe.customers.search({
          query,
          limit: 20, // Reasonable limit for search results
          expand: this.buildExpandParams(['data.subscriptions']),
        }),
      'search_customers',
      { query: query.substring(0, 50) } // Truncate for logging
    );
  }

  /**
   * Update customer's default payment method
   * Used in subscription management
   */
  async updateDefaultPaymentMethod(
    customerId: string,
    paymentMethodId: string
  ): Promise<Stripe.Customer> {
    this.validateCustomerId(customerId);
    this.validatePaymentMethodId(paymentMethodId);

    return await this.handleStripeOperation(
      () =>
        this.stripe.customers.update(customerId, {
          invoice_settings: {
            default_payment_method: paymentMethodId,
          },
        }),
      'update_default_payment_method',
      {
        customerId: customerId.substring(0, 8) + '***',
        paymentMethodId: paymentMethodId.substring(0, 8) + '***',
      }
    );
  }

  /**
   * Get customer's payment methods
   */
  async getCustomerPaymentMethods(
    customerId: string,
    type?: 'card' | 'us_bank_account'
  ): Promise<Stripe.ApiList<Stripe.PaymentMethod>> {
    this.validateCustomerId(customerId);

    return await this.handleStripeOperation(
      () =>
        this.stripe.paymentMethods.list({
          customer: customerId,
          type: type || 'card',
        }),
      'get_customer_payment_methods',
      {
        customerId: customerId.substring(0, 8) + '***',
        type,
      }
    );
  }

  /**
   * Create or update customer based on email existence
   * Commonly used pattern in the codebase
   */
  async upsertCustomer(data: CreateCustomerData): Promise<Stripe.Customer> {
    // First try to find existing customer
    const existingCustomer = await this.findCustomerByEmail(data.email);

    if (existingCustomer) {
      // Update existing customer
      return await this.updateCustomer(existingCustomer.id, {
        name: data.name,
        metadata: data.metadata,
      });
    } else {
      // Create new customer
      return await this.createCustomer(data);
    }
  }

  /**
   * Validate customer exists and return basic info
   * Used for quick validation in API routes
   */
  async validateCustomerExists(customerId: string): Promise<boolean> {
    this.validateCustomerId(customerId);

    try {
      await this.getCustomer(customerId);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get customer's subscription summary
   * Optimized for dashboard and admin views
   */
  async getCustomerSubscriptionSummary(customerId: string): Promise<{
    customer: Stripe.Customer;
    activeSubscriptions: number;
    totalRevenue: number;
    lastPayment?: Date;
  }> {
    this.validateCustomerId(customerId);

    return await this.handleStripeOperation(
      async () => {
        const customer = await this.stripe.customers.retrieve(customerId, {
          expand: ['subscriptions', 'subscriptions.data.latest_invoice'],
        });

        if (!customer || customer.deleted) {
          throw new Error('Customer not found');
        }

        // Type guard to ensure we have a non-deleted customer
        const activeCustomer = customer as Stripe.Customer;
        const subscriptions = activeCustomer.subscriptions?.data || [];
        const activeSubscriptions = subscriptions.filter(
          sub => sub.status === 'active' || sub.status === 'trialing'
        ).length;

        // Calculate total revenue from active subscriptions
        const totalRevenue =
          subscriptions.reduce((total, sub) => {
            if (sub.status === 'active' || sub.status === 'trialing') {
              return total + (sub.items.data[0]?.price.unit_amount || 0);
            }
            return total;
          }, 0) / 100; // Convert from cents

        // Get last payment date
        const latestInvoice = subscriptions[0]?.latest_invoice;
        const lastPayment =
          latestInvoice &&
          typeof latestInvoice === 'object' &&
          'created' in latestInvoice
            ? new Date(latestInvoice.created * 1000)
            : undefined;

        return {
          customer: activeCustomer,
          activeSubscriptions,
          totalRevenue,
          lastPayment,
        };
      },
      'get_customer_subscription_summary',
      { customerId: customerId.substring(0, 8) + '***' }
    );
  }
}
