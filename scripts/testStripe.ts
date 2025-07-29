import { Prisma } from '@prisma/client';
import Stripe from 'stripe';
// import { SubscriptionSyncService } from '../src/services/subscription-sync-service';
// const SubscriptionSyncService = require('../src/services/subscription-sync-service');
async function main() {
  // const subscriptionSyncService = new SubscriptionSyncService();
  const stripe = new Stripe(
    'sk_test_51MDu3yCnZNXu29wPPlNKTVlXmmDX72cLYnCoRu2zuWxuc0xr47AuCftghjWdgZmHzzWE0Z31t142TpjXhe9JdewT00AyQiZmpq'
  );
  const customerResult = await stripe.customers.list({
    email: 'afaqnabi00@gmail.com',
    limit: 1,
    expand: [
      'data.subscriptions',
      'data.subscriptions.data.latest_invoice',
      'data.subscriptions.data.items',
    ],
  });
  let activeSubscriptions = [];
  if (customerResult) {
    // Handle both possible return formats: single customer or list response
    let customer = null;

    // Check if this is a list response (has object: 'list' and data array)
    if (
      customerResult.object === 'list' &&
      Array.isArray(customerResult.data)
    ) {
      customer = customerResult.data[0] || null;
    } else {
      // Assume it's a single customer object
      customer = customerResult;
    }

    if (customer) {
      // Check for active subscriptions directly from customer data
      activeSubscriptions =
        customer.subscriptions?.data?.filter(
          sub => sub.status === 'active' || sub.status === 'trialing'
        ) || [];

      // if (activeSubscriptions.length > 0) {
      //   console.log('hasActiveSubscription', activeSubscriptions);
      // }
    }
  }
  const subscriptionData = mapStripeSubscriptionToDbFields(
    activeSubscriptions[0]
  );
  console.log('subscriptionData', extractPeriodFromItems(subscriptionData));
  // console.log('subscriptionData', subscriptionData);
  // console.log('activeSubscriptions', activeSubscriptions);
}

function mapStripeSubscriptionToDbFields(stripeSubscription: any) {
  // Extract discount information
  let discountPercent: number | null = null;
  let discountName: string | null = null;

  if (stripeSubscription.discounts && stripeSubscription.discounts.length > 0) {
    const firstDiscount = stripeSubscription.discounts[0];
    if (typeof firstDiscount !== 'string' && firstDiscount.coupon) {
      discountPercent = firstDiscount.coupon.percent_off || null;
      discountName = firstDiscount.coupon.name || null;
    }
  } else if (stripeSubscription.discount?.coupon) {
    // Legacy single discount format
    discountPercent = stripeSubscription.discount.coupon.percent_off || null;
    discountName = stripeSubscription.discount.coupon.name || null;
  }

  return {
    stripeSubscriptionId: stripeSubscription.id,
    stripeCustomerId: stripeSubscription.customer as string,
    // status: this.mapStripeStatusToDbStatus(stripeSubscription.status),
    currency: stripeSubscription.currency,
    created: new Date(stripeSubscription.created * 1000),
    currentPeriodStart: stripeSubscription.current_period_start
      ? new Date(stripeSubscription.current_period_start * 1000)
      : null,
    currentPeriodEnd: stripeSubscription.current_period_end
      ? new Date(stripeSubscription.current_period_end * 1000)
      : null,
    cancelAt: stripeSubscription.cancel_at
      ? new Date(stripeSubscription.cancel_at * 1000)
      : null,
    cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
    canceledAt: stripeSubscription.canceled_at
      ? new Date(stripeSubscription.canceled_at * 1000)
      : null,
    endedAt: stripeSubscription.ended_at
      ? new Date(stripeSubscription.ended_at * 1000)
      : null,
    startDate: stripeSubscription.start_date
      ? new Date(stripeSubscription.start_date * 1000)
      : null,
    trialStart: stripeSubscription.trial_start
      ? new Date(stripeSubscription.trial_start * 1000)
      : null,
    trialEnd: stripeSubscription.trial_end
      ? new Date(stripeSubscription.trial_end * 1000)
      : null,
    defaultPaymentMethod:
      (stripeSubscription.default_payment_method as string) || null,
    latestInvoice: (stripeSubscription.latest_invoice as string) || null,
    collectionMethod: stripeSubscription.collection_method,

    // Additional Stripe fields
    automaticTax: stripeSubscription.automatic_tax
      ? JSON.stringify(stripeSubscription.automatic_tax)
      : Prisma.JsonNull,
    billingCycleAnchor: stripeSubscription.billing_cycle_anchor
      ? new Date(stripeSubscription.billing_cycle_anchor * 1000)
      : null,
    description: stripeSubscription.description || null,
    pendingSetupIntent:
      (stripeSubscription.pending_setup_intent as string) || null,
    pendingUpdate: stripeSubscription.pending_update
      ? JSON.stringify(stripeSubscription.pending_update)
      : Prisma.JsonNull,

    // Custom fields for business logic
    discountPercent,
    discountName,
    lastInvoiceUrl: null, // This gets updated when invoice.payment_succeeded webhook fires

    // Subscription items and metadata
    items: stripeSubscription.items
      ? JSON.stringify(stripeSubscription.items)
      : Prisma.JsonNull,
    metadata: stripeSubscription.metadata
      ? JSON.stringify(stripeSubscription.metadata)
      : Prisma.JsonNull,
    updatedAt: new Date(),
  };
}

function extractPeriodFromItems(subscription: any): {
  currentPeriodEnd: Date | null;
} {
  try {
    // First try direct properties (for Stripe API responses)
    if (
      'current_period_start' in subscription &&
      subscription.current_period_start
    ) {
      return {
        currentPeriodEnd: subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000)
          : null,
      };
    }

    // Then try items field (for database records)
    if (
      'items' in subscription &&
      subscription.items &&
      typeof subscription.items === 'string'
    ) {
      const itemsData = JSON.parse(subscription.items);
      if (itemsData.data && itemsData.data.length > 0) {
        const firstItem = itemsData.data[0];
        return {
          currentPeriodEnd: firstItem.current_period_end
            ? new Date(firstItem.current_period_end * 1000)
            : null,
        };
      }
    }

    // Fallback to existing properties if available
    if (
      'currentPeriodStart' in subscription &&
      subscription.currentPeriodStart
    ) {
      return {
        currentPeriodEnd:
          subscription.currentPeriodEnd instanceof Date
            ? subscription.currentPeriodEnd
            : subscription.currentPeriodEnd
              ? new Date(subscription.currentPeriodEnd)
              : null,
      };
    }

    return {
      currentPeriodEnd: null,
    };
  } catch (error) {
    // Get subscription ID based on type - database records have stripeSubscriptionId, Stripe objects have id
    const subscriptionId =
      'stripeSubscriptionId' in subscription
        ? subscription.stripeSubscriptionId
        : 'id' in subscription
          ? subscription.id
          : 'unknown';

    apiLogger.databaseOperation('extract_period_from_items', false, {
      error: error instanceof Error ? error.message : 'Unknown error',
      subscriptionId,
    });
    return {
      currentPeriodEnd: null,
    };
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
