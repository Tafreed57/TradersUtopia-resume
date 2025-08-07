import Stripe from 'stripe';
import { BaseStripeService } from '../base/base-stripe-service';
import { SubscriptionStatus } from '@prisma/client';
import { ValidationError } from '../../database/errors';
import { apiLogger } from '@/lib/enhanced-logger';

/**
 * ExtractionUtilities - Shared utilities for all extraction operations
 *
 * Contains common validation, transformation, and utility methods used across
 * all extraction sub-services.
 */
export class ExtractionUtilities extends BaseStripeService {
  /**
   * Extract customer ID from various customer field types
   */
  extractCustomerId(
    customer: string | Stripe.Customer | Stripe.DeletedCustomer | null
  ): string {
    if (!customer) {
      throw new ValidationError('Customer information is missing');
    }

    if (typeof customer === 'string') {
      this.validateCustomerId(customer);
      return customer;
    }

    if ('id' in customer) {
      this.validateCustomerId(customer.id);
      return customer.id;
    }

    throw new ValidationError('Invalid customer data structure');
  }

  /**
   * Extract current period end from subscription data
   */
  extractCurrentPeriodEnd(subscription: Stripe.Subscription): Date | null {
    const currentPeriodEnd = (subscription as any).current_period_end;
    if (!currentPeriodEnd) {
      return null;
    }

    return new Date(currentPeriodEnd * 1000);
  }

  /**
   * Map Stripe subscription status to database enum
   */
  mapStripeStatusToDbStatus(stripeStatus: string): SubscriptionStatus {
    const statusMap: Record<string, SubscriptionStatus> = {
      active: 'ACTIVE',
      canceled: 'CANCELED',
      incomplete: 'INCOMPLETE',
      incomplete_expired: 'INCOMPLETE_EXPIRED',
      past_due: 'PAST_DUE',
      trialing: 'TRIALING',
      unpaid: 'UNPAID',
      paused: 'PAUSED',
    };

    return statusMap[stripeStatus] || 'FREE';
  }

  /**
   * Get customer email from various customer field types
   */
  async getCustomerEmail(
    customer: string | Stripe.Customer | Stripe.DeletedCustomer | null
  ): Promise<string> {
    if (!customer) {
      throw new ValidationError('Customer information is missing');
    }

    // If customer is already an object with email
    if (typeof customer === 'object' && 'email' in customer && customer.email) {
      return customer.email;
    }

    // If customer is a string (ID), fetch the full customer object
    if (typeof customer === 'string') {
      try {
        const customerObject = await this.stripe.customers.retrieve(customer);
        if ('email' in customerObject && customerObject.email) {
          return customerObject.email;
        }
        throw new ValidationError('Customer email not found');
      } catch (error) {
        apiLogger.databaseOperation('fetch_customer_email', false, {
          error: error instanceof Error ? error.message : String(error),
          customerId: customer,
        });
        throw new ValidationError('Failed to fetch customer email');
      }
    }

    // If customer is an object with ID but no email, fetch from Stripe
    if (typeof customer === 'object' && 'id' in customer) {
      try {
        const customerObject = await this.stripe.customers.retrieve(
          customer.id
        );
        if ('email' in customerObject && customerObject.email) {
          return customerObject.email;
        }
        throw new ValidationError('Customer email not found');
      } catch (error) {
        apiLogger.databaseOperation('fetch_customer_email', false, {
          error: error instanceof Error ? error.message : String(error),
          customerId: customer.id,
        });
        throw new ValidationError('Failed to fetch customer email');
      }
    }

    throw new ValidationError('Invalid customer data structure');
  }

  /**
   * Validate Stripe subscription ID format
   */
  validateSubscriptionId(subscriptionId: string): void {
    if (!subscriptionId || !subscriptionId.startsWith('sub_')) {
      throw new ValidationError('Invalid subscription ID format');
    }
  }

  /**
   * Validate Stripe customer ID format
   */
  validateCustomerId(customerId: string): void {
    if (!customerId || !customerId.startsWith('cus_')) {
      throw new ValidationError('Invalid customer ID format');
    }
  }

  /**
   * Type checking utilities
   */
  isSubscriptionObject(obj: any): obj is Stripe.Subscription {
    return obj.object === 'subscription';
  }

  isInvoiceObject(obj: any): obj is Stripe.Invoice {
    return obj.object === 'invoice';
  }

  isCheckoutSessionObject(obj: any): obj is Stripe.Checkout.Session {
    return obj.object === 'checkout.session';
  }

  /**
   * Get object type for logging purposes
   */
  getObjectType(obj: any): string {
    return obj.object || 'unknown';
  }
}
