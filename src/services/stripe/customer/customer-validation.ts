import Stripe from 'stripe';
import { BaseStripeService } from '../base/base-stripe-service';
import { CustomerLookup } from './customer-lookup';

/**
 * CustomerValidation - Handles customer validation and existence checks
 *
 * Focused sub-service for customer validation and verification operations.
 */
export class CustomerValidation extends BaseStripeService {
  private lookup: CustomerLookup;

  constructor() {
    super();
    this.lookup = new CustomerLookup();
  }

  /**
   * Validate customer exists in Stripe
   * Used before performing operations that require existing customer
   */
  async validateCustomerExists(customerId: string): Promise<boolean> {
    this.validateCustomerId(customerId);

    try {
      const customer = await this.lookup.findCustomerById(customerId);
      return !!customer;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if customer has any active subscriptions
   * Used for access control and business logic
   */
  async customerHasActiveSubscriptions(customerId: string): Promise<boolean> {
    const summary = await this.lookup.getCustomerSubscriptionSummary(
      customerId
    );
    return summary.hasActiveSubscription;
  }

  /**
   * Get customer existence and status in one call
   * Convenient method for comprehensive customer checks
   */
  async getCustomerStatus(customerId: string): Promise<{
    exists: boolean;
    hasActiveSubscriptions: boolean;
    subscriptionCount: number;
    customer?: Stripe.Customer;
  }> {
    this.validateCustomerId(customerId);

    try {
      const summary = await this.lookup.getCustomerSubscriptionSummary(
        customerId
      );

      return {
        exists: true,
        hasActiveSubscriptions: summary.hasActiveSubscription,
        subscriptionCount: summary.subscriptionCount,
        customer: summary.customer,
      };
    } catch (error) {
      return {
        exists: false,
        hasActiveSubscriptions: false,
        subscriptionCount: 0,
      };
    }
  }
}
