import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import Stripe from 'stripe';

export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-05-28.basil',
  });
  try {
    const user = await currentUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Find the user's profile
    const profile = await db.profile.findFirst({
      where: { userId: user.id },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    console.log(
      `🔍 [SUBSCRIPTION DETAILS] Fetching for user: ${profile.email}`
    );

    // ✅ ENHANCED: Get comprehensive subscription info from webhook-updated database
    const subscriptionInfo = {
      status: profile.subscriptionStatus,
      productId: profile.stripeProductId,
      customerId: profile.stripeCustomerId,
      subscriptionStart: profile.subscriptionStart,
      subscriptionEnd: profile.subscriptionEnd,
      lastUpdated: profile.updatedAt,
      isWebhookUpdated: true, // Flag to indicate this comes from webhook data
    };

    let responseData: any = {
      success: true,
      subscription: {
        ...subscriptionInfo,
        product: null,
        stripe: null,
        customer: null,
        dataSource: 'database', // Track data source for debugging
      },
    };

    // ✅ ENHANCED: Enrich with Stripe data if customer ID exists
    if (profile.stripeCustomerId) {
      try {
        console.log(
          `🔗 [STRIPE API] Fetching data for customer: ${profile.stripeCustomerId}`
        );

        // Get customer details
        const customer = (await stripe.customers.retrieve(
          profile.stripeCustomerId
        )) as any;

        if (!customer.deleted) {
          responseData.subscription.customer = {
            id: customer.id,
            email: customer.email,
            created: new Date(customer.created * 1000),
          };
        }

        // Get product details if we have a product ID
        if (profile.stripeProductId) {
          try {
            const product = await stripe.products.retrieve(
              profile.stripeProductId
            );
            responseData.subscription.product = {
              id: product.id,
              name: product.name,
              description: product.description,
              images: product.images,
            };
            console.log(`📦 [PRODUCT] Retrieved: ${product.name}`);
          } catch (error) {
            console.error('❌ Error fetching product details:', error);
          }
        }

        // ✅ ENHANCED: Get current subscription details from Stripe for real-time status
        const subscriptions = await stripe.subscriptions.list({
          customer: profile.stripeCustomerId,
          limit: 10,
          expand: ['data.discounts', 'data.discount.coupon'], // Expand discount information
        });

        console.log(
          `📊 [SUBSCRIPTIONS] Found ${subscriptions.data.length} subscription(s)`
        );

        if (subscriptions.data.length > 0) {
          // Find the most relevant subscription
          const relevantSubscription =
            subscriptions.data.find(
              (sub: any) =>
                sub.status === 'active' ||
                (sub.status === 'canceled' &&
                  new Date(sub.current_period_end * 1000) > new Date())
            ) || subscriptions.data[0];

          let subscription = relevantSubscription as any;
          console.log(
            `✅ [ACTIVE SUB] Using: ${subscription.id} (${subscription.status})`
          );

          // 🔍 ENHANCED: Get full subscription details with all discount information
          try {
            const fullSubscription = await stripe.subscriptions.retrieve(
              subscription.id,
              {
                expand: ['discounts', 'discount.coupon'],
              }
            );
            subscription = fullSubscription;
            console.log(
              `🔄 [ENHANCED] Retrieved full subscription details with discounts`
            );
          } catch (error) {
            console.log(
              `⚠️ [WARNING] Could not retrieve full subscription details, using list data`
            );
          }

          // 🐛 DEBUG: Log raw discount data from Stripe
          console.log(`🔍 [DEBUG] Raw subscription discount data:`, {
            hasOldDiscount: !!subscription.discount,
            oldDiscount: subscription.discount,
            hasNewDiscounts: !!(
              subscription.discounts && subscription.discounts.length > 0
            ),
            newDiscounts: subscription.discounts,
            discountsLength: subscription.discounts?.length || 0,
          });

          // Get discount information from the new discounts array format
          const activeDiscount =
            subscription.discounts && subscription.discounts.length > 0
              ? subscription.discounts[0] // Get the first active discount
              : subscription.discount; // Fallback to old single discount format

          const originalAmount =
            subscription.items.data[0]?.price.unit_amount || 0;
          let discountedAmount = originalAmount;
          let discountPercent = null;
          let discountAmount = null;

          if (activeDiscount?.coupon) {
            discountPercent = activeDiscount.coupon.percent_off;
            discountAmount = activeDiscount.coupon.amount_off;

            // Calculate the actual discounted amount
            if (discountPercent) {
              discountedAmount = Math.round(
                originalAmount * (1 - discountPercent / 100)
              );
            } else if (discountAmount) {
              discountedAmount = Math.max(0, originalAmount - discountAmount);
            }
          }

          console.log(
            `💰 [PRICING] Original: ${originalAmount}, Discounted: ${discountedAmount}, Discount: ${discountPercent}%`
          );
          console.log(`🔍 [DEBUG] Active discount object:`, activeDiscount);
          console.log(`🔍 [DEBUG] Final pricing calculation:`, {
            originalAmount,
            discountedAmount,
            discountPercent,
            discountAmount,
            hasActiveDiscount: !!activeDiscount?.coupon,
            couponId: activeDiscount?.coupon?.id,
            couponPercentOff: activeDiscount?.coupon?.percent_off,
            couponAmountOff: activeDiscount?.coupon?.amount_off,
          });

          // ✅ ENHANCED: Comprehensive subscription details for UI
          responseData.subscription.stripe = {
            id: subscription.id,
            status: subscription.status,
            currentPeriodStart: new Date(
              subscription.current_period_start * 1000
            ),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            canceledAt: subscription.canceled_at
              ? new Date(subscription.canceled_at * 1000)
              : null,
            autoRenew: !subscription.cancel_at_period_end,
            priceId: subscription.items.data[0]?.price.id,
            amount: discountedAmount, // Use discounted amount instead of original
            originalAmount: originalAmount, // Keep original for reference
            currency: subscription.items.data[0]?.price.currency,
            interval: subscription.items.data[0]?.price.recurring?.interval,
            // ✅ ENHANCED: Additional metadata for better UI display
            trialStart: subscription.trial_start
              ? new Date(subscription.trial_start * 1000)
              : null,
            trialEnd: subscription.trial_end
              ? new Date(subscription.trial_end * 1000)
              : null,
            created: new Date(subscription.created * 1000),
            pauseStartDate: null, // Placeholder for pause functionality
            discountPercent: discountPercent,
            discountAmount: discountAmount,
            hasDiscount: !!activeDiscount?.coupon,
            discountDetails: activeDiscount?.coupon
              ? {
                  id: activeDiscount.coupon.id,
                  name: activeDiscount.coupon.name,
                  percentOff: activeDiscount.coupon.percent_off,
                  amountOff: activeDiscount.coupon.amount_off,
                  duration: activeDiscount.coupon.duration,
                  valid: activeDiscount.coupon.valid,
                }
              : null,
          };

          responseData.dataSource = 'stripe-enhanced';

          // ✅ WEBHOOK SYNC CHECK: Compare webhook data vs Stripe data
          const webhookEndDate = profile.subscriptionEnd
            ? new Date(profile.subscriptionEnd)
            : null;
          const stripeEndDate = new Date(
            subscription.current_period_end * 1000
          );

          if (
            webhookEndDate &&
            Math.abs(webhookEndDate.getTime() - stripeEndDate.getTime()) >
              24 * 60 * 60 * 1000
          ) {
            console.log(`⚠️ [SYNC WARNING] Webhook data may be outdated:`);
            console.log(`   Webhook end: ${webhookEndDate.toISOString()}`);
            console.log(`   Stripe end: ${stripeEndDate.toISOString()}`);
            responseData.subscription.syncWarning = {
              message: 'Subscription data may be out of sync',
              webhookDate: webhookEndDate,
              stripeDate: stripeEndDate,
            };
          }
        } else {
          console.log(
            `⚠️ [NO SUBSCRIPTIONS] No active subscriptions found for customer`
          );
          responseData.subscription.noActiveSubscription = true;
        }

        responseData.dataSource = 'database-with-stripe';
      } catch (stripeError) {
        console.error(
          '❌ [STRIPE ERROR] Failed to fetch Stripe data:',
          stripeError
        );
        responseData.subscription.stripeError = {
          message: 'Unable to fetch real-time Stripe data',
          error:
            stripeError instanceof Error
              ? stripeError.message
              : 'Unknown error',
        };
        responseData.dataSource = 'database-only';
      }
    } else {
      console.log(`ℹ️ [NO CUSTOMER ID] Using database-only information`);
      responseData.dataSource = 'database-only';
    }

    // ✅ ENHANCED: Add helpful metadata for the UI
    responseData.subscription.metadata = {
      lastDatabaseUpdate: profile.updatedAt,
      hasStripeConnection: !!profile.stripeCustomerId,
      isActive: profile.subscriptionStatus === 'ACTIVE',
      daysUntilExpiry: profile.subscriptionEnd
        ? Math.ceil(
            (new Date(profile.subscriptionEnd).getTime() -
              new Date().getTime()) /
              (1000 * 60 * 60 * 24)
          )
        : null,
      dataFreshness: responseData.dataSource,
    };

    console.log(`✅ [SUCCESS] Subscription details prepared for UI:`, {
      status: responseData.subscription.status,
      dataSource: responseData.dataSource,
      hasStripeData: !!responseData.subscription.stripe,
      hasProductData: !!responseData.subscription.product,
    });

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('❌ [API ERROR] Subscription details fetch failed:', error);

    // ✅ SECURITY: Generic error response - no internal details exposed
    return NextResponse.json(
      {
        error: 'Failed to fetch subscription details',
        message:
          'Unable to retrieve subscription information. Please try again later.',
      },
      { status: 500 }
    );
  }
}
