import Stripe from 'stripe';
import { BaseStripeService } from './base/base-stripe-service';
import {
  CreateSubscriptionData,
  UpdateSubscriptionData,
  ListSubscriptionOptions,
} from '../types';
import {
  SubscriptionLookup,
  SubscriptionManagement,
  SubscriptionStatus,
} from './subscription';

/**
 * SubscriptionService - Main facade for subscription operations
 *
 * This facade maintains the exact same public interface as the original SubscriptionService
 * while delegating to focused sub-services for better organization and maintainability.
 *
 * Handles all Stripe subscription operations
 * Eliminates 15+ duplicate implementations across the codebase
 */
export class SubscriptionService extends BaseStripeService {
  private lookup: SubscriptionLookup;
  private management: SubscriptionManagement;
  private status: SubscriptionStatus;

  constructor() {
    super();
    this.lookup = new SubscriptionLookup();
    this.management = new SubscriptionManagement();
    this.status = new SubscriptionStatus();
  }

  // ===== SUBSCRIPTION LOOKUP (SubscriptionLookup) =====

  /**
   * List subscriptions by user ID - checks database first
   * Replaces scattered subscription lookup implementations
   * Use this for access control and status checks
   */
  async listSubscriptionsByCustomer(
    userIdOrCustomerId: string,
    options: ListSubscriptionOptions = {}
  ): Promise<Stripe.Subscription[]> {
    return this.lookup.listSubscriptionsByCustomer(userIdOrCustomerId, options);
  }

  /**
   * Get subscriptions directly from Stripe by customer ID
   * Use only when you need fresh Stripe data or specific Stripe operations
   */
  async getStripeSubscriptionsByCustomerId(
    customerId: string,
    options: ListSubscriptionOptions = {}
  ): Promise<Stripe.Subscription[]> {
    return this.lookup.getStripeSubscriptionsByCustomerId(customerId, options);
  }

  /**
   * Retrieve single subscription with full details
   */
  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return this.lookup.getSubscription(subscriptionId);
  }

  /**
   * Get active subscription for customer - Convenience method
   */
  async getActiveSubscription(
    customerId: string
  ): Promise<Stripe.Subscription | null> {
    return this.lookup.getActiveSubscription(customerId);
  }

  /**
   * Get subscription by customer email
   * Used to find user's subscription when only email is known
   */
  async getSubscriptionByCustomerEmail(
    email: string
  ): Promise<Stripe.Subscription | null> {
    return this.lookup.getSubscriptionByCustomerEmail(email);
  }

  // ===== SUBSCRIPTION MANAGEMENT (SubscriptionManagement) =====

  /**
   * Create new subscription (admin operations)
   */
  async createSubscription(
    data: CreateSubscriptionData
  ): Promise<Stripe.Subscription> {
    return this.management.createSubscription(data);
  }

  /**
   * Update subscription (toggle auto-renew, modify items)
   */
  async updateSubscription(
    subscriptionId: string,
    data: UpdateSubscriptionData
  ): Promise<Stripe.Subscription> {
    return this.management.updateSubscription(subscriptionId, data);
  }

  /**
   * Cancel subscription immediately
   */
  async cancelSubscription(
    subscriptionId: string
  ): Promise<Stripe.Subscription> {
    return this.management.cancelSubscription(subscriptionId);
  }

  /**
   * Apply coupon to subscription
   * Used for applying discounts to existing subscriptions
   */
  async applyCouponToSubscription(
    subscriptionId: string,
    couponId: string
  ): Promise<Stripe.Subscription> {
    return this.management.applyCouponToSubscription(subscriptionId, couponId);
  }

  /**
   * Toggle auto-renewal for subscription (cancel at period end)
   * Used for soft cancellation - subscription continues until period end
   */
  async toggleAutoRenew(
    subscriptionId: string,
    autoRenew: boolean
  ): Promise<Stripe.Subscription> {
    return this.management.toggleAutoRenew(subscriptionId, autoRenew);
  }

  /**
   * Change subscription plan/price
   * Used when users upgrade/downgrade
   */
  async changeSubscriptionPlan(
    subscriptionId: string,
    newPriceId: string,
    prorate: boolean = true
  ): Promise<Stripe.Subscription> {
    return this.management.changeSubscriptionPlan(
      subscriptionId,
      newPriceId,
      prorate
    );
  }

  // ===== SUBSCRIPTION STATUS (SubscriptionStatus) =====

  /**
   * Check if user has active subscription - Database first approach
   * Used for access control decisions
   */
  async hasActiveSubscription(userIdOrCustomerId: string): Promise<boolean> {
    return this.status.hasActiveSubscription(userIdOrCustomerId);
  }

  /**
   * Get user subscription status from database
   * Fast database-only check for subscription status
   */
  async getUserSubscriptionStatusFromDB(userId: string): Promise<{
    status: string;
    hasActiveSubscription: boolean;
    currentPeriodEnd?: Date;
    stripeSubscriptionId?: string;
  }> {
    return this.status.getUserSubscriptionStatusFromDB(userId);
  }

  /**
   * Get subscription status summary
   * Used in dashboard and admin views
   */
  async getSubscriptionStatus(subscriptionId: string): Promise<{
    subscription: Stripe.Subscription;
    isActive: boolean;
    isTrialing: boolean;
    isCanceled: boolean;
    nextBillingDate?: Date;
    trialEndDate?: Date;
    cancelDate?: Date;
  }> {
    return this.status.getSubscriptionStatus(subscriptionId);
  }

  /**
   * Validate subscription exists
   */
  async validateSubscriptionExists(subscriptionId: string): Promise<boolean> {
    return this.status.validateSubscriptionExists(subscriptionId);
  }

  /**
   * Get subscription pricing information
   * Used to display current costs, next billing amount
   */
  async getSubscriptionPricing(subscriptionId: string): Promise<{
    currentAmount: number;
    currency: string;
    interval: string;
    nextBillingAmount?: number;
    priceId: string;
  }> {
    return this.status.getSubscriptionPricing(subscriptionId);
  }
}
