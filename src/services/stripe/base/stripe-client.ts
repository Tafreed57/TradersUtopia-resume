import Stripe from 'stripe';
import { StripeConfigError } from './errors';

/**
 * Singleton service for managing Stripe client instances.
 * Ensures consistent configuration and prevents multiple client instantiations.
 *
 * @example
 * ```typescript
 * const stripe = StripeClientService.getClient();
 * const customer = await stripe.customers.create({ email: 'test@example.com' });
 * ```
 */
export class StripeClientService {
  private static instance: Stripe | null = null;

  /**
   * Gets the singleton Stripe client instance.
   * Creates a new instance if one doesn't exist.
   *
   * @returns Configured Stripe client instance
   * @throws {StripeConfigError} If required environment variables are missing
   */
  static getClient(): Stripe {
    if (!this.instance) {
      this.validateConfig();
      this.instance = new Stripe(process.env.STRIPE_SECRET_KEY!, {
        apiVersion: '2025-06-30.basil', // Pin API version for consistency with Stripe 18.3.0
        typescript: true,
        telemetry: false, // Disable telemetry for performance
      });
    }
    return this.instance;
  }

  /**
   * Validates that all required Stripe environment variables are present.
   *
   * @throws {StripeConfigError} If any required environment variables are missing
   */
  static validateConfig(): void {
    const required = [
      'STRIPE_SECRET_KEY',
      'STRIPE_WEBHOOK_SECRET',
      'STRIPE_PUBLISHABLE_KEY',
    ];

    const missing = required.filter(key => !process.env[key]);
    if (missing.length > 0) {
      throw new StripeConfigError(
        `Missing Stripe configuration: ${missing.join(', ')}`
      );
    }
  }

  /**
   * Resets the singleton instance. Primarily useful for testing.
   *
   * @internal
   */
  static resetInstance(): void {
    this.instance = null;
  }
}
