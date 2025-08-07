import Stripe from 'stripe';
import { BaseStripeService } from '../base/base-stripe-service';
import { CustomerLookup } from './customer-lookup';
import { CreateCustomerData, UpdateCustomerData } from '../../types';
import { maskEmail } from '@/lib/error-handling';

/**
 * CustomerManagement - Handles customer create, update, delete operations
 *
 * Focused sub-service for customer lifecycle management operations.
 */
export class CustomerManagement extends BaseStripeService {
  private lookup: CustomerLookup;

  constructor() {
    super();
    this.lookup = new CustomerLookup();
  }

  /**
   * Create new customer
   * Replaces scattered customer creation implementations
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
      {
        email: maskEmail(data.email),
        hasName: !!data.name,
        hasMetadata: !!data.metadata,
      }
    );
  }

  /**
   * Update existing customer
   * Used for profile updates and metadata changes
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
          ...(data.email && { email: data.email }),
          ...(data.name && { name: data.name }),
          ...(data.metadata && { metadata: this.buildMetadata(data.metadata) }),
        }),
      'update_customer',
      {
        customerId,
        emailUpdated: !!data.email,
        nameUpdated: !!data.name,
        metadataUpdated: !!data.metadata,
      }
    );
  }

  /**
   * Delete customer and all associated data
   * Use with caution - this is irreversible
   */
  async deleteCustomer(customerId: string): Promise<Stripe.DeletedCustomer> {
    this.validateCustomerId(customerId);

    return await this.handleStripeOperation(
      () => this.stripe.customers.del(customerId),
      'delete_customer',
      { customerId }
    );
  }

  /**
   * Upsert customer - create if doesn't exist, update if exists
   * Convenient method for syncing customer data
   */
  async upsertCustomer(data: CreateCustomerData): Promise<Stripe.Customer> {
    this.validateEmailForStripe(data.email);

    return await this.handleStripeOperation(
      async () => {
        // Try to find existing customer first
        const existingCustomer = await this.lookup.findCustomerByEmail(
          data.email
        );

        if (existingCustomer) {
          // Update existing customer if data has changed
          const needsUpdate =
            (data.name && existingCustomer.name !== data.name) ||
            (data.metadata &&
              JSON.stringify(existingCustomer.metadata) !==
                JSON.stringify(data.metadata));

          if (needsUpdate) {
            return await this.updateCustomer(existingCustomer.id, {
              name: data.name,
              metadata: data.metadata,
            });
          }

          return existingCustomer;
        } else {
          // Create new customer
          return await this.createCustomer(data);
        }
      },
      'upsert_customer',
      {
        email: maskEmail(data.email),
        hasName: !!data.name,
        hasMetadata: !!data.metadata,
      }
    );
  }
}
