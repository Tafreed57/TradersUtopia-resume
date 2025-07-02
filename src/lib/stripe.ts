import Stripe from 'stripe';

// Shared Stripe instance with proper error handling
let stripe: Stripe | null = null;
let stripeInitError: string | null = null;

/**
 * Get a Stripe instance with proper error handling
 * Returns null if Stripe is not configured (prevents build-time errors)
 */
export function getStripeInstance(): Stripe | null {
  // Return cached instance if available
  if (stripe) return stripe;

  // Return null if we already know there's an error
  if (stripeInitError) {
    console.warn(`⚠️ [STRIPE] ${stripeInitError}`);
    return null;
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secretKey) {
    stripeInitError =
      'STRIPE_SECRET_KEY not configured - Stripe features disabled';
    console.warn(`⚠️ [STRIPE] ${stripeInitError}`);
    return null;
  }

  try {
    stripe = new Stripe(secretKey);

    console.log('✅ [STRIPE] Stripe SDK initialized successfully');
    return stripe;
  } catch (error) {
    stripeInitError = `Failed to initialize Stripe SDK: ${error instanceof Error ? error.message : 'Unknown error'}`;
    console.error(`❌ [STRIPE] ${stripeInitError}`);
    return null;
  }
}

/**
 * Get webhook endpoint secret
 */
export function getWebhookSecret(): string | null {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.warn(
      '⚠️ [STRIPE] STRIPE_WEBHOOK_SECRET not configured - webhook validation disabled'
    );
    return null;
  }

  return webhookSecret;
}

/**
 * Check if Stripe is properly configured
 */
export function isStripeConfigured(): boolean {
  return !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
}

/**
 * Get configuration status for debugging
 */
export function getStripeConfigStatus() {
  return {
    hasSecretKey: !!process.env.STRIPE_SECRET_KEY,
    hasWebhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
    secretKeyPrefix: process.env.STRIPE_SECRET_KEY
      ? `${process.env.STRIPE_SECRET_KEY.substring(0, 8)}...`
      : 'NOT_SET',
    webhookSecretPrefix: process.env.STRIPE_WEBHOOK_SECRET
      ? `${process.env.STRIPE_WEBHOOK_SECRET.substring(0, 8)}...`
      : 'NOT_SET',
    isConfigured: isStripeConfigured(),
    initError: stripeInitError,
  };
}
