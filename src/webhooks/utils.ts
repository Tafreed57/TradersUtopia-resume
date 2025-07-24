import { db } from '@/lib/db';
import Stripe from 'stripe';

// ✅ ENHANCED HELPER FUNCTION: Store comprehensive subscription data for webhook-only operation
export async function updateSubscriptionInDatabase(
  subscription: Stripe.Subscription
) {
  const customerId = subscription.customer as string;
  const subscriptionWithPeriods = subscription as any;

  // ✅ FIXED: Calculate subscription dates with proper fallbacks
  let subscriptionStart: Date;
  let subscriptionEnd: Date;

  // Try multiple sources for period dates
  if (
    subscriptionWithPeriods.current_period_start &&
    subscriptionWithPeriods.current_period_end
  ) {
    // Available at subscription level
    subscriptionStart = new Date(
      subscriptionWithPeriods.current_period_start * 1000
    );
    subscriptionEnd = new Date(
      subscriptionWithPeriods.current_period_end * 1000
    );
  } else if (subscription.items?.data?.[0]) {
    // Try subscription item level
    const item = subscription.items.data[0] as any;
    if (item.current_period_start && item.current_period_end) {
      subscriptionStart = new Date(item.current_period_start * 1000);
      subscriptionEnd = new Date(item.current_period_end * 1000);
    } else {
      // Fallback: Use subscription creation time + 30 days
      subscriptionStart = new Date(subscription.created * 1000);
      subscriptionEnd = new Date(
        subscription.created * 1000 + 30 * 24 * 60 * 60 * 1000
      );
      console.warn(
        `⚠️ [WEBHOOK] Using fallback dates for subscription ${subscription.id}`
      );
    }
  } else {
    // Final fallback
    subscriptionStart = new Date(subscription.created * 1000);
    subscriptionEnd = new Date(
      subscription.created * 1000 + 30 * 24 * 60 * 60 * 1000
    );
    console.warn(
      `⚠️ [WEBHOOK] Using final fallback dates for subscription ${subscription.id}`
    );
  }

  // ✅ FIXED: Validate dates before using them
  if (isNaN(subscriptionStart.getTime()) || isNaN(subscriptionEnd.getTime())) {
    console.error(
      `❌ [WEBHOOK] Invalid dates calculated for subscription ${subscription.id}`
    );
    subscriptionStart = new Date();
    subscriptionEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }

  // Determine status based on Stripe subscription status
  let dbStatus: 'ACTIVE' | 'CANCELLED' | 'EXPIRED' | 'FREE' = 'ACTIVE';
  if (subscription.status === 'canceled') {
    dbStatus = 'CANCELLED';
  } else if (
    subscription.status === 'unpaid' ||
    subscription.status === 'past_due'
  ) {
    dbStatus = 'EXPIRED';
  } else if (['active', 'trialing'].includes(subscription.status)) {
    dbStatus = 'ACTIVE';
  }

  // ✅ NEW: Extract comprehensive subscription data
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

  // ✅ NEW: Extract discount information and calculate actual amount
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

  // ✅ CRITICAL FIX: Calculate the actual amount the customer pays
  if (baseAmount) {
    if (discountPercent && discountPercent > 0) {
      // Calculate the discounted amount (what customer actually pays)
      actualAmount = Math.round(baseAmount * (1 - discountPercent / 100));
      console.log(`💰 [WEBHOOK] Discount calculation:`, {
        baseAmount: `$${(baseAmount / 100).toFixed(2)}`,
        discountPercent: `${discountPercent}%`,
        actualAmount: `$${(actualAmount / 100).toFixed(2)}`,
        savings: `$${((baseAmount - actualAmount) / 100).toFixed(2)}`,
      });
    } else {
      // No discount, actual amount = base amount
      actualAmount = baseAmount;
    }
  }

  // ✅ NEW: Calculate cancellation date
  const cancelledAt = subscription.canceled_at
    ? new Date(subscription.canceled_at * 1000)
    : null;

  // ✅ NEW: Calculate creation date
  const createdAt = subscription.created
    ? new Date(subscription.created * 1000)
    : null;

  console.log(`📊 [WEBHOOK] Storing comprehensive subscription data:`, {
    customerId,
    subscriptionId: subscription.id,
    status: dbStatus,
    start: subscriptionStart.toISOString(),
    end: subscriptionEnd.toISOString(),
    productId,
    priceId,
    baseAmount: baseAmount ? `$${(baseAmount / 100).toFixed(2)}` : null,
    actualAmount: actualAmount ? `$${(actualAmount / 100).toFixed(2)}` : null,
    currency,
    interval,
    autoRenew: !subscription.cancel_at_period_end,
    discountPercent,
    discountName,
    cancelledAt: cancelledAt?.toISOString() || null,
    createdAt: createdAt?.toISOString() || null,
  });

  // ✅ OPTIMIZED: Get customer email efficiently without unnecessary API calls
  let customerEmail = null;
  try {
    if (
      typeof subscription.customer === 'object' &&
      subscription.customer &&
      !subscription.customer.deleted &&
      'email' in subscription.customer
    ) {
      // Customer object is expanded in webhook - use it directly
      customerEmail = subscription.customer.email;
      console.log(
        `📧 [WEBHOOK-OPTIMIZED] Using expanded customer email: ${customerEmail}`
      );
    } else {
      // Customer ID only - skip email for performance (not critical for functionality)
      console.log(
        `⚡ [WEBHOOK-OPTIMIZED] Skipping customer email fetch for performance`
      );
    }
  } catch (error) {
    console.warn(
      `⚠️ [WEBHOOK] Could not get customer email for ${customerId}:`,
      error
    );
  }

  // ✅ FIXED: Removed non-existent subscription table update (subscription data is stored in profile)

  // ✅ NEW: Comprehensive database update with all Stripe data
  const updateData = {
    // Existing fields
    subscriptionStatus: dbStatus,
    subscriptionStart: subscriptionStart,
    subscriptionEnd: subscriptionEnd,
    stripeProductId: productId,
    updatedAt: new Date(),

    // ✅ NEW: Store all Stripe data for webhook-only operation
    stripeSubscriptionId: subscription.id,
    subscriptionAutoRenew: !subscription.cancel_at_period_end,
    stripePriceId: priceId,
    // ✅ CRITICAL FIX: Store the actual amount customer pays (not original price)
    subscriptionAmount: actualAmount, // What customer actually pays after discount
    originalAmount: baseAmount, // Original price before discount for reference
    subscriptionCurrency: currency,
    subscriptionInterval: interval,
    subscriptionCancelledAt: cancelledAt,
    discountPercent: discountPercent,
    discountName: discountName,
    stripeCustomerEmail: customerEmail,
    subscriptionCreated: createdAt,
  };

  // Update all profiles with this customer ID
  const updateResult = await db.profile.updateMany({
    where: { stripeCustomerId: customerId },
    data: updateData,
  });

  console.log(
    `✅ [WEBHOOK] Updated ${updateResult.count} profile(s) with comprehensive Stripe data for customer ${customerId}`
  );

  console.log(
    `⚡ [WEBHOOK-OPTIMIZED] Subscription update completed with zero unnecessary API calls`
  );

  return updateResult;
}
