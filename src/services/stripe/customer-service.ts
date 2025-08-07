import Stripe from 'stripe';
import { BaseStripeService } from './base/base-stripe-service';
import { CreateCustomerData, UpdateCustomerData } from '../types';
import {
  CustomerLookup,
  CustomerManagement,
  CustomerValidation,
} from './customer';

/**
 * CustomerService - Main facade for customer operations
 *
 * This facade maintains the exact same public interface as the original CustomerService
 * while delegating to focused sub-services for better organization and maintainability.
 *
 * Handles all Stripe customer operations
 * Eliminates 8+ duplicate implementations across the codebase
 */
export class CustomerService extends BaseStripeService {
  private lookup: CustomerLookup;
  private management: CustomerManagement;
  private validation: CustomerValidation;

  constructor() {
    super();
    this.lookup = new CustomerLookup();
    this.management = new CustomerManagement();
    this.validation = new CustomerValidation();
  }

  // ===== CUSTOMER LOOKUP (CustomerLookup) =====

  /**
   * Find customer by email - Most critical method (used 8+ times)
   * Replaces scattered findCustomerByEmail implementations
   */
  async findCustomerByEmail(email: string): Promise<Stripe.Customer | null> {
    return this.lookup.findCustomerByEmail(email);
  }

  /**
   * Find customer with expanded subscription data
   * Used in subscription management flows
   */
  async findCustomerWithSubscriptions(
    email: string
  ): Promise<Stripe.Customer | null> {
    return this.lookup.findCustomerWithSubscriptions(email);
  }

  /**
   * Find customer by ID with full details
   */
  async findCustomerById(customerId: string): Promise<Stripe.Customer | null> {
    return this.lookup.findCustomerById(customerId);
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
    return this.lookup.getCustomerSubscriptionSummary(customerId);
  }

  // ===== CUSTOMER MANAGEMENT (CustomerManagement) =====

  /**
   * Create new customer
   * Replaces scattered customer creation implementations
   */
  async createCustomer(data: CreateCustomerData): Promise<Stripe.Customer> {
    return this.management.createCustomer(data);
  }

  /**
   * Update existing customer
   */
  async updateCustomer(
    customerId: string,
    data: UpdateCustomerData
  ): Promise<Stripe.Customer> {
    return this.management.updateCustomer(customerId, data);
  }

  /**
   * Delete customer and all associated data
   * Use with caution - this is irreversible
   */
  async deleteCustomer(customerId: string): Promise<Stripe.DeletedCustomer> {
    return this.management.deleteCustomer(customerId);
  }

  /**
   * Upsert customer - create if doesn't exist, update if exists
   * Convenient method for syncing customer data
   */
  async upsertCustomer(data: CreateCustomerData): Promise<Stripe.Customer> {
    return this.management.upsertCustomer(data);
  }

  // ===== CUSTOMER VALIDATION (CustomerValidation) =====

  /**
   * Validate customer exists in Stripe
   */
  async validateCustomerExists(customerId: string): Promise<boolean> {
    return this.validation.validateCustomerExists(customerId);
  }

  /**
   * Check if customer has any active subscriptions
   */
  async customerHasActiveSubscriptions(customerId: string): Promise<boolean> {
    return this.validation.customerHasActiveSubscriptions(customerId);
  }

  /**
   * Get customer existence and status in one call
   */
  async getCustomerStatus(customerId: string): Promise<{
    exists: boolean;
    hasActiveSubscriptions: boolean;
    subscriptionCount: number;
    customer?: Stripe.Customer;
  }> {
    return this.validation.getCustomerStatus(customerId);
  }
}
