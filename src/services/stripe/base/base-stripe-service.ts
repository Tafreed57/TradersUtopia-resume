import Stripe from 'stripe';
import { apiLogger } from '@/lib/enhanced-logger';
import { ValidationError } from '../../database/errors';
import { StripeClientService } from './stripe-client';
import { StripeServiceError } from './errors';

/**
 * Abstract base class for all Stripe-related services.
 * Provides common error handling and validation utilities for Stripe operations.
 *
 * @abstract
 * @example
 * ```typescript
 * class PaymentService extends BaseStripeService {
 *   async createCustomer(email: string) {
 *     return this.handleStripeOperation(
 *       () => this.stripe.customers.create({ email }),
 *       'create_customer',
 *       { email }
 *     );
 *   }
 * }
 * ```
 */
export abstract class BaseStripeService {
  protected stripe: Stripe;

  /**
   * Creates a new Stripe service instance with a configured Stripe client.
   */
  constructor() {
    this.stripe = StripeClientService.getClient();
  }

  /**
   * Handles Stripe operations with centralized error handling and structured logging.
   * Automatically logs successful and failed operations for observability.
   *
   * @template T - The return type of the Stripe operation
   * @param operation - The Stripe operation to execute
   * @param operationName - Name of the operation for logging
   * @param context - Additional context for logging
   * @returns Promise resolving to the operation result
   * @throws {StripeServiceError} If the Stripe operation fails
   */
  protected async handleStripeOperation<T>(
    operation: () => Promise<T>,
    operationName: string,
    context?: any
  ): Promise<T> {
    try {
      const result = await operation();
      apiLogger.databaseOperation(`stripe_${operationName}`, true, { context });
      return result;
    } catch (error) {
      apiLogger.databaseOperation(`stripe_${operationName}`, false, {
        error: error instanceof Error ? error.message : String(error),
        context,
        stripeError:
          error instanceof Stripe.errors.StripeError
            ? {
                type: error.type,
                code: error.code,
                param: error.param,
              }
            : undefined,
      });

      if (error instanceof Stripe.errors.StripeError) {
        throw new StripeServiceError(
          `Failed to ${operationName}`,
          error.type,
          error.code,
          error.message
        );
      }

      throw new StripeServiceError(
        `Failed to ${operationName}`,
        'unknown',
        undefined,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Handles service errors with proper logging and throws appropriate errors
   * Used for error handling in service methods
   */
  protected handleServiceError(
    message: string,
    operation: string,
    error: unknown
  ): never {
    apiLogger.databaseOperation(`stripe_${operation}`, false, {
      error: error instanceof Error ? error.message : String(error),
    });

    if (error instanceof StripeServiceError) {
      throw error;
    }

    throw new StripeServiceError(
      message,
      'unknown',
      undefined,
      error instanceof Error ? error.message : String(error)
    );
  }

  /**
   * Validates that a customer ID follows Stripe's customer ID format.
   *
   * @param customerId - The customer ID to validate
   * @throws {ValidationError} If the customer ID is invalid or malformed
   */
  protected validateCustomerId(customerId: string): void {
    if (!customerId || !customerId.startsWith('cus_')) {
      throw new ValidationError(`Invalid Stripe customer ID: ${customerId}`);
    }
  }

  /**
   * Validates that a subscription ID follows Stripe's subscription ID format.
   *
   * @param subscriptionId - The subscription ID to validate
   * @throws {ValidationError} If the subscription ID is invalid or malformed
   */
  protected validateSubscriptionId(subscriptionId: string): void {
    if (!subscriptionId || !subscriptionId.startsWith('sub_')) {
      throw new ValidationError(
        `Invalid Stripe subscription ID: ${subscriptionId}`
      );
    }
  }

  /**
   * Validates that a payment method ID follows Stripe's payment method ID format.
   *
   * @param paymentMethodId - The payment method ID to validate
   * @throws {ValidationError} If the payment method ID is invalid or malformed
   */
  protected validatePaymentMethodId(paymentMethodId: string): void {
    if (!paymentMethodId || !paymentMethodId.startsWith('pm_')) {
      throw new ValidationError(
        `Invalid Stripe payment method ID: ${paymentMethodId}`
      );
    }
  }

  /**
   * Validates that a price ID follows Stripe's price ID format.
   *
   * @param priceId - The price ID to validate
   * @throws {ValidationError} If the price ID is invalid or malformed
   */
  protected validatePriceId(priceId: string): void {
    if (!priceId || !priceId.startsWith('price_')) {
      throw new ValidationError(`Invalid Stripe price ID: ${priceId}`);
    }
  }

  /**
   * Validates email format for Stripe operations
   *
   * @param email - The email to validate
   * @throws {ValidationError} If the email is invalid
   */
  protected validateEmailForStripe(email: string): void {
    if (!email || typeof email !== 'string') {
      throw new ValidationError('Email is required and must be a string');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new ValidationError('Invalid email format');
    }

    if (email.length > 254) {
      throw new ValidationError('Email too long (max 254 characters)');
    }
  }

  /**
   * Builds expand parameters for Stripe API calls
   *
   * @param additionalExpands - Additional expand parameters
   * @returns Array of expand parameters
   */
  protected buildExpandParams(additionalExpands: string[] = []): string[] {
    const defaultExpands: string[] = [];
    return [...defaultExpands, ...additionalExpands];
  }

  /**
   * Builds metadata object for Stripe entities
   *
   * @param metadata - Raw metadata object
   * @returns Formatted metadata for Stripe
   */
  protected buildMetadata(
    metadata?: Record<string, any>
  ): Record<string, string> {
    if (!metadata) {
      return {};
    }

    const stripeMetadata: Record<string, string> = {};

    for (const [key, value] of Object.entries(metadata)) {
      if (value !== null && value !== undefined) {
        stripeMetadata[key] = String(value);
      }
    }

    return stripeMetadata;
  }

  /**
   * Builds list parameters for Stripe list operations
   *
   * @param options - List options
   * @returns Formatted list parameters
   */
  protected buildListParams(options: {
    limit?: number;
    startingAfter?: string;
    endingBefore?: string;
  }): {
    limit: number;
    starting_after?: string;
    ending_before?: string;
  } {
    return {
      limit: Math.min(options.limit || 10, 100), // Cap at 100 for performance
      ...(options.startingAfter && { starting_after: options.startingAfter }),
      ...(options.endingBefore && { ending_before: options.endingBefore }),
    };
  }
}
