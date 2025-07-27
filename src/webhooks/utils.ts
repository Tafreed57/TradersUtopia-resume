import { SubscriptionSyncService } from '@/services/subscription-sync-service';
import { UserService } from '@/services/database/user-service';
import Stripe from 'stripe';
import { apiLogger } from '@/lib/enhanced-logger';
import { maskId, maskEmail } from '@/lib/error-handling';

// ✅ ENHANCED HELPER FUNCTION: Store comprehensive subscription data using new services
export async function updateSubscriptionInDatabase(
  subscription: Stripe.Subscription
) {
  const customerId = subscription.customer as string;
  const subscriptionWithPeriods = subscription as any;

  console.log(`📊 [WEBHOOK] Processing subscription update:`, {
    subscriptionId: subscription.id,
    customerId: maskId(customerId),
    status: subscription.status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  });

  try {
    // ✅ OPTIMIZED: Get customer email efficiently without unnecessary API calls
    let customerEmail = null;
    if (
      typeof subscription.customer === 'object' &&
      subscription.customer &&
      !subscription.customer.deleted &&
      'email' in subscription.customer
    ) {
      // Customer object is expanded in webhook - use it directly
      customerEmail = subscription.customer.email;
      console.log(
        `📧 [WEBHOOK-OPTIMIZED] Using expanded customer email: ${customerEmail ? maskEmail(customerEmail) : 'none'}`
      );
    } else {
      // Customer ID only - skip email for performance (not critical for functionality)
      console.log(
        `⚡ [WEBHOOK-OPTIMIZED] Skipping customer email fetch for performance`
      );
    }

    // ✅ NEW: Use SubscriptionSyncService for comprehensive subscription handling
    const subscriptionService = new SubscriptionSyncService();
    const userService = new UserService();

    // First, ensure user exists and has proper Stripe customer ID linkage
    await ensureUserHasStripeCustomer(userService, customerId, customerEmail);

    // Use the centralized subscription sync service to handle all subscription updates
    await subscriptionService.createOrUpdateSubscription(subscription);

    // Update user access based on subscription status
    await subscriptionService.updateUserAccess(customerId);

    // ✅ NEW: Extract and log comprehensive subscription data for debugging
    const subscriptionDetails = extractSubscriptionDetails(subscription);

    apiLogger.databaseOperation('webhook_subscription_processed', true, {
      subscriptionId: subscription.id,
      customerId: maskId(customerId),
      status: subscription.status,
      ...subscriptionDetails,
    });

    console.log(
      `✅ [WEBHOOK] Successfully processed subscription update for ${maskId(customerId)}`
    );

    return { success: true };
  } catch (error) {
    // ✅ ENHANCED: Comprehensive error logging
    apiLogger.databaseOperation('webhook_subscription_error', false, {
      subscriptionId: subscription.id,
      customerId: maskId(customerId),
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    console.error(`❌ [WEBHOOK] Failed to process subscription update:`, {
      subscriptionId: subscription.id,
      customerId: maskId(customerId),
      error: error instanceof Error ? error.message : String(error),
    });

    throw error;
  }
}

// ✅ NEW: Helper function to ensure user has proper Stripe customer linkage
async function ensureUserHasStripeCustomer(
  userService: UserService,
  stripeCustomerId: string,
  customerEmail?: string | null
): Promise<void> {
  try {
    // Try to find user through subscription relationship using SubscriptionSyncService
    const subscriptionService = new SubscriptionSyncService();

    // Check if we already have a subscription record for this customer
    const existingSubscription =
      await subscriptionService.prisma.subscription.findFirst({
        where: { stripeCustomerId },
        include: { user: true },
      });

    if (existingSubscription) {
      console.log(
        `👤 [WEBHOOK] Found user via existing subscription: ${maskId(stripeCustomerId)}`
      );
      return;
    }

    // If customer email is available, try to find by email and the subscription will be created later
    if (customerEmail) {
      const userByEmail = await userService.findByUserIdOrEmail(customerEmail);

      if (userByEmail) {
        console.log(
          `👤 [WEBHOOK] Found user by email, will link to Stripe customer: ${customerEmail ? maskEmail(customerEmail) : 'none'}`
        );
        // The subscription sync service will handle creating the subscription record with the customer ID
        return;
      }
    }

    // User not found - log warning but don't throw error
    // This can happen if webhook arrives before user creation webhook
    console.warn(
      `⚠️ [WEBHOOK] User not found for Stripe customer ${maskId(stripeCustomerId)}. This may be normal if webhook ordering is different.`
    );
  } catch (error) {
    console.error(`❌ [WEBHOOK] Error ensuring user-customer linkage:`, error);
    throw error;
  }
}

// ✅ NEW: Extract comprehensive subscription details for logging
function extractSubscriptionDetails(subscription: Stripe.Subscription) {
  // Extract pricing information
  let productId = null;
  let priceId = null;
  let baseAmount = null;
  let actualAmount = null;
  let currency = null;
  let interval = null;

  if (subscription.items.data.length > 0) {
    const price = subscription.items.data[0].price;
    productId = price.product as string;
    priceId = price.id;
    baseAmount = price.unit_amount; // Original price before discount
    currency = price.currency;
    interval = price.recurring?.interval;
  }

  // Extract discount information
  let discountPercent = null;
  let discountName = null;

  // Handle both old single discount format and new discounts array format
  const activeDiscount =
    subscription.discounts && subscription.discounts.length > 0
      ? subscription.discounts[0] // New format
      : (subscription as any).discount; // Legacy format

  if (activeDiscount?.coupon) {
    discountPercent = activeDiscount.coupon.percent_off;
    discountName = activeDiscount.coupon.name;
  }

  // Calculate the actual amount the customer pays
  if (baseAmount) {
    if (discountPercent && discountPercent > 0) {
      // Calculate the discounted amount (what customer actually pays)
      actualAmount = Math.round(baseAmount * (1 - discountPercent / 100));
    } else {
      // No discount, actual amount = base amount
      actualAmount = baseAmount;
    }
  }

  // Calculate period dates
  let periodStart: Date | null = null;
  let periodEnd: Date | null = null;

  const subscriptionWithPeriods = subscription as any;
  if (
    subscriptionWithPeriods.current_period_start &&
    subscriptionWithPeriods.current_period_end
  ) {
    periodStart = new Date(subscriptionWithPeriods.current_period_start * 1000);
    periodEnd = new Date(subscriptionWithPeriods.current_period_end * 1000);
  } else if (subscription.items?.data?.[0]) {
    const item = subscription.items.data[0] as any;
    if (item.current_period_start && item.current_period_end) {
      periodStart = new Date(item.current_period_start * 1000);
      periodEnd = new Date(item.current_period_end * 1000);
    }
  }

  return {
    productId: productId ? maskId(productId) : null,
    priceId: priceId ? maskId(priceId) : null,
    baseAmount: baseAmount ? `$${(baseAmount / 100).toFixed(2)}` : null,
    actualAmount: actualAmount ? `$${(actualAmount / 100).toFixed(2)}` : null,
    currency,
    interval,
    autoRenew: !subscription.cancel_at_period_end,
    discountPercent,
    discountName,
    periodStart: periodStart?.toISOString() || null,
    periodEnd: periodEnd?.toISOString() || null,
    cancelledAt: subscription.canceled_at
      ? new Date(subscription.canceled_at * 1000).toISOString()
      : null,
    createdAt: new Date(subscription.created * 1000).toISOString(),
  };
}
