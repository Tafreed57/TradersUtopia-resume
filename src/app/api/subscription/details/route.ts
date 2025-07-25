import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import Stripe from 'stripe';
import { rateLimitGeneral, trackSuspiciousActivity } from '@/lib/rate-limit';
import { conditionalLog } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  try {
    // ✅ SECURITY FIX: Add rate limiting
    const rateLimitResult = await rateLimitGeneral()(request);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(request, 'SUB_DETAILS_RATE_LIMIT_EXCEEDED');
      return rateLimitResult.error;
    }

    // ✅ FIXED: Handle Clerk API errors gracefully
    let user;
    try {
      user = await currentUser();
    } catch (clerkError) {
      console.error('❌ [SUBSCRIPTION-DETAILS] Clerk API Error:', clerkError);
      return NextResponse.json(
        {
          error: 'Authentication service temporarily unavailable',
          message: 'Please try again in a moment',
        },
        { status: 503 }
      );
    }

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

    // ✅ NEW: Check if user is admin first - admins get special admin access status
    if (profile.isAdmin) {
      conditionalLog.subscriptionDetails(
        `🔑 [SUBSCRIPTION-DETAILS] Admin user ${profile.email} - showing admin access status`
      );

      return NextResponse.json({
        success: true,
        subscription: {
          status: 'ACTIVE',
          productId: 'admin_access',
          customerId: profile.stripeCustomerId || 'admin_override',
          subscriptionStart: profile.createdAt,
          subscriptionEnd: null, // Admins don't have expiration
          lastUpdated: profile.updatedAt,
          isWebhookUpdated: false,
          isAdminAccess: true,
          product: {
            id: 'admin_access',
            name: 'Admin Premium Access',
            description:
              'Full access to all premium features as an administrator',
            images: [],
          },
          stripe: {
            id: 'admin_override',
            status: 'active',
            currentPeriodStart: profile.createdAt?.toISOString(),
            currentPeriodEnd: null, // No expiration for admins
            cancelAtPeriodEnd: false,
            canceledAt: null,
            autoRenew: true, // Always auto-renewing for admins
            priceId: 'admin_access',
            amount: 0, // Free for admins
            originalAmount: 0,
            currency: 'usd',
            interval: 'lifetime',
            trialStart: null,
            trialEnd: null,
            created: profile.createdAt?.toISOString(),
            pauseStartDate: null,
            discountPercent: 100, // 100% discount for admins
            discountAmount: null,
            hasDiscount: true,
            discountDetails: {
              id: 'admin_discount',
              name: 'Administrator Access',
              percentOff: 100,
              amountOff: null,
              duration: 'forever',
              valid: true,
            },
          },
          customer: profile.stripeCustomerId
            ? null
            : {
                id: 'admin_override',
                email: profile.email,
                created: profile.createdAt?.toISOString(),
              },
          dataSource: 'admin_override',
          metadata: {
            lastDatabaseUpdate: profile.updatedAt,
            hasStripeConnection: !!profile.stripeCustomerId,
            isActive: true,
            daysUntilExpiry: null, // Never expires for admins
            dataFreshness: 'admin_override',
            adminNote:
              'This user has administrative privileges and automatic premium access',
          },
        },
      });
    }

    // ✅ WEBHOOK-ONLY: Use database data instead of Stripe API calls
    conditionalLog.subscriptionDetails(
      `📊 [SUBSCRIPTION-DETAILS] Using webhook-cached data for user: ${profile.email}`
    );

    // ✅ FIXED: Determine subscription status based on data availability and expiry (same logic as product check)
    // ✅ CIRCULAR DEPENDENCY FIX: Don't require subscriptionAmount for active status determination
    const hasActiveSubscription =
      profile.stripeProductId &&
      profile.subscriptionEnd &&
      new Date(profile.subscriptionEnd) > new Date() &&
      (profile.subscriptionStatus === 'ACTIVE' || profile.subscriptionAmount);

    const subscriptionStatus = hasActiveSubscription
      ? 'ACTIVE'
      : profile.subscriptionStatus || 'INACTIVE';

    // Build subscription info from database (webhook-cached data)
    let subscriptionInfo = {
      status: subscriptionStatus,
      productId: profile.stripeProductId,
      customerId: profile.stripeCustomerId,
      subscriptionStart: profile.subscriptionStart,
      subscriptionEnd: profile.subscriptionEnd,
      lastUpdated: profile.updatedAt,
      isWebhookUpdated: true,
      // ✅ NEW: Add fields that are available from webhook data
      stripeSubscriptionId: profile.stripeSubscriptionId,
      subscriptionAmount: profile.subscriptionAmount,
      subscriptionCurrency: profile.subscriptionCurrency,
      subscriptionInterval: profile.subscriptionInterval,
      discountPercent: profile.discountPercent,
      discountName: profile.discountName,
      originalAmount: profile.originalAmount,
      // ✅ ENHANCED: Add cached discount details for webhook data
      discountDetails:
        profile.discountPercent && profile.discountPercent > 0
          ? {
              id: 'cached_discount',
              name: profile.discountName || 'Applied Discount',
              percentOff: profile.discountPercent,
              amountOff: null,
              duration: 'unknown',
              valid: true,
            }
          : null,
      dataFreshness: 'webhook_cached' as 'webhook_cached' | 'stripe_fresh',
    } as any;

    // ✅ BILLING FIX: If billing details are missing or outdated, fetch fresh from Stripe
    const shouldFetchFreshData =
      hasActiveSubscription &&
      profile.stripeCustomerId &&
      (!profile.stripeSubscriptionId ||
        !profile.subscriptionAmount ||
        profile.discountPercent === null);

    if (shouldFetchFreshData) {
      conditionalLog.subscriptionDetails(
        `🔄 [SUBSCRIPTION-DETAILS] Fetching fresh billing data from Stripe for accurate pricing`
      );

      try {
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

        let stripeSubscription;

        if (profile.stripeSubscriptionId) {
          // We have the subscription ID, fetch it directly
          stripeSubscription = await stripe.subscriptions.retrieve(
            profile.stripeSubscriptionId,
            {
              expand: ['items.data.price', 'discounts.coupon'],
            }
          );
          console.dir(stripeSubscription, { depth: null });
        } else if (profile.stripeCustomerId) {
          // We don't have subscription ID, find it via customer
          const subscriptions = await stripe.subscriptions.list({
            customer: profile.stripeCustomerId,
            status: 'active',
            limit: 1,
            expand: ['data.discount.coupon', 'data.items.data.price'],
          });

          if (subscriptions.data.length > 0) {
            stripeSubscription = subscriptions.data[0];
            conditionalLog.subscriptionDetails(
              `✅ [SUBSCRIPTION-DETAILS] Found active subscription: ${stripeSubscription.id}`
            );
          } else {
            conditionalLog.subscriptionDetails(
              `❌ [SUBSCRIPTION-DETAILS] No active subscription found for customer`
            );
            stripeSubscription = null;
          }
        } else {
          stripeSubscription = null;
        }

        if (stripeSubscription && stripeSubscription.status === 'active') {
          const price = stripeSubscription.items.data[0]?.price;
          // ✅ FIX: Access discounts array instead of discount property
          const discounts = (stripeSubscription as any).discounts || [];
          const discount = discounts.length > 0 ? discounts[0] : null;

          // ✅ DEBUG: Log the raw subscription data to see what Stripe is returning
          conditionalLog.subscriptionDetails(
            `🔍 [SUBSCRIPTION-DETAILS] Raw Stripe subscription data:`,
            {
              id: stripeSubscription.id,
              status: stripeSubscription.status,
              hasDiscount: !!discount,
              discountId: discount?.id,
              discountCouponId: discount?.coupon?.id,
              discountCouponPercent: discount?.coupon?.percent_off,
              discountCouponAmountOff: discount?.coupon?.amount_off,
              priceAmount: price?.unit_amount,
              currency: price?.currency,
              // ✅ NEW: Log full discount structure
              discountArrayLength: discounts.length,
              fullDiscountData: discount
                ? {
                    id: discount.id,
                    start: discount.start,
                    end: discount.end,
                    couponName: discount.coupon?.name,
                    couponDuration: discount.coupon?.duration,
                    couponCreated: discount.coupon?.created,
                  }
                : null,
            }
          );

          // Calculate billing amounts
          const baseAmount = price?.unit_amount || 0;
          let currentAmount = baseAmount;
          let discountPercent = null;
          let discountName = null;

          if (discount && discount.coupon) {
            conditionalLog.subscriptionDetails(
              `✅ [SUBSCRIPTION-DETAILS] Discount found on subscription`
            );
            if (discount.coupon.percent_off) {
              discountPercent = discount.coupon.percent_off;
              currentAmount = Math.round(
                baseAmount * (1 - discountPercent / 100)
              );
              discountName = discount.coupon.name || `${discountPercent}% off`;
            } else if (discount.coupon.amount_off) {
              const amountOff = discount.coupon.amount_off;
              currentAmount = Math.max(0, baseAmount - amountOff);
              discountPercent = Math.round((amountOff / baseAmount) * 100);
              discountName =
                discount.coupon.name || `$${(amountOff / 100).toFixed(2)} off`;
            }
          } else {
            conditionalLog.subscriptionDetails(
              `ℹ️ [SUBSCRIPTION-DETAILS] No discounts found on subscription`
            );
          }

          // ✅ ENHANCED: Build comprehensive discount details
          let discountDetails = null;
          if (discount && discount.coupon) {
            discountDetails = {
              id: discount.id,
              couponId: discount.coupon.id,
              name: discount.coupon.name || discountName || 'Applied Discount',
              percentOff: discount.coupon.percent_off || null,
              amountOff: discount.coupon.amount_off || null,
              duration: discount.coupon.duration || 'unknown',
              durationInMonths: discount.coupon.duration_in_months || null,
              valid: discount.coupon.valid || true,
              start: discount.start
                ? new Date(discount.start * 1000).toISOString()
                : null,
              end: discount.end
                ? new Date(discount.end * 1000).toISOString()
                : null,
              currency: discount.coupon.currency || price?.currency || 'usd',
              maxRedemptions: discount.coupon.max_redemptions || null,
              redeemBy: discount.coupon.redeem_by
                ? new Date(discount.coupon.redeem_by * 1000).toISOString()
                : null,
              timesRedeemed: discount.coupon.times_redeemed || 0,
              created: discount.coupon.created
                ? new Date(discount.coupon.created * 1000).toISOString()
                : null,
            };
          }

          // Update subscription info with fresh data
          subscriptionInfo = {
            ...subscriptionInfo,
            stripeSubscriptionId: stripeSubscription.id,
            subscriptionAmount: currentAmount,
            subscriptionCurrency: price?.currency || 'usd',
            discountPercent,
            discountName,
            originalAmount: baseAmount,
            discountDetails,
            dataFreshness: 'stripe_fresh',
          } as any;

          // ✅ DEBUG: Log what we're about to store
          conditionalLog.subscriptionDetails(
            `💾 [SUBSCRIPTION-DETAILS] Values being stored in database (CENTS):`,
            {
              subscriptionAmountCents: currentAmount, // Store cents in DB
              originalAmountCents: baseAmount, // Store cents in DB
              subscriptionAmountDollars: currentAmount / 100, // For component display
              originalAmountDollars: baseAmount / 100, // For component display
              discountPercent,
              discountName,
            }
          );

          conditionalLog.subscriptionDetails(
            `✅ [SUBSCRIPTION-DETAILS] Fresh billing data retrieved:`,
            {
              subscriptionId: stripeSubscription.id,
              baseAmountCents: baseAmount,
              currentAmountCents: currentAmount,
              originalAmountDollars: baseAmount / 100,
              currentAmountDollars: currentAmount / 100,
              discountPercent,
              discountName,
              // Debug: What will be stored in database
              willStoreSubscriptionAmount: currentAmount / 100,
              willStoreOriginalAmount: baseAmount / 100,
            }
          );

          // ✅ CACHE UPDATE: Always update database with fresh data
          try {
            await db.profile.update({
              where: { id: profile.id },
              data: {
                stripeSubscriptionId: stripeSubscription.id,
                subscriptionAmount: currentAmount,
                discountPercent,
                discountName,
                originalAmount: baseAmount,
              },
            });
            conditionalLog.subscriptionDetails(
              `🔄 [SUBSCRIPTION-DETAILS] Updated database cache with fresh billing data`
            );
          } catch (updateError) {
            conditionalLog.subscriptionDetails(
              `⚠️ [SUBSCRIPTION-DETAILS] Failed to update database cache:`,
              updateError
            );
          }
        }
      } catch (stripeError) {
        conditionalLog.subscriptionDetails(
          `⚠️ [SUBSCRIPTION-DETAILS] Failed to fetch fresh Stripe data, using cached:`,
          stripeError
        );
        // Continue with cached data if Stripe fetch fails
      }
    }

    let responseData: any = {
      success: true,
      subscription: {
        ...subscriptionInfo,
        product: null,
        stripe: null,
        customer: null,
        dataSource: 'webhook_cached',
      },
    };

    // ✅ WEBHOOK-ONLY: Build product info from cached data
    if (profile.stripeProductId) {
      responseData.subscription.product = {
        id: profile.stripeProductId,
        name: 'Premium Plan',
        description: 'Premium trading platform access',
        images: [],
      };
    }

    // ✅ WEBHOOK-ONLY: Build customer info from cached data
    if (profile.stripeCustomerId) {
      responseData.subscription.customer = {
        id: profile.stripeCustomerId,
        email: profile.stripeCustomerEmail || profile.email,
        created:
          profile.subscriptionCreated?.toISOString() ||
          profile.createdAt?.toISOString(),
      };
    }

    // ✅ WEBHOOK-ONLY: Build comprehensive Stripe data from cached fields
    if (profile.stripeSubscriptionId) {
      const hasDiscount =
        profile.discountPercent && profile.discountPercent > 0;

      responseData.subscription.stripe = {
        id: profile.stripeSubscriptionId,
        status: subscriptionStatus?.toLowerCase() || 'active',
        currentPeriodStart: profile.subscriptionStart?.toISOString(),
        currentPeriodEnd: profile.subscriptionEnd?.toISOString(),
        cancelAtPeriodEnd: !profile.subscriptionAutoRenew,
        canceledAt: profile.subscriptionCancelledAt?.toISOString() || null,
        autoRenew: profile.subscriptionAutoRenew || false,
        priceId: profile.stripePriceId,
        amount: profile.subscriptionAmount || 0,
        originalAmount: (() => {
          // If originalAmount is stored, use it
          if (profile.originalAmount) {
            return profile.originalAmount;
          }

          // If missing, calculate it from discounted amount and discount percentage
          if (
            profile.subscriptionAmount &&
            profile.discountPercent &&
            profile.discountPercent > 0
          ) {
            const discountedAmount = profile.subscriptionAmount;
            const discountPercent = profile.discountPercent;
            const calculatedOriginal = Math.round(
              discountedAmount / (1 - discountPercent / 100)
            );
            return calculatedOriginal;
          }

          // Fallback: no discount or missing data
          return profile.subscriptionAmount || 0;
        })(),
        currency: profile.subscriptionCurrency || 'usd',
        interval: profile.subscriptionInterval || 'month',
        trialStart: null,
        trialEnd: null,
        created:
          profile.subscriptionCreated?.toISOString() ||
          profile.createdAt?.toISOString(),
        pauseStartDate: null,
        discountPercent: profile.discountPercent,
        discountAmount: null,
        hasDiscount: hasDiscount,
        discountDetails: hasDiscount
          ? (subscriptionInfo as any).discountDetails || {
              id: 'cached_discount',
              name: profile.discountName || 'Applied Discount',
              percentOff: profile.discountPercent,
              amountOff: null,
              duration: 'unknown',
              valid: true,
            }
          : null,
      };
    }

    // ✅ WEBHOOK-ONLY: Build metadata from cached data
    responseData.subscription.metadata = {
      lastDatabaseUpdate: profile.updatedAt,
      hasStripeConnection: !!profile.stripeCustomerId,
      isActive: subscriptionStatus === 'ACTIVE',
      daysUntilExpiry: profile.subscriptionEnd
        ? Math.ceil(
            (new Date(profile.subscriptionEnd).getTime() -
              new Date().getTime()) /
              (1000 * 60 * 60 * 24)
          )
        : null,
      dataFreshness: subscriptionInfo.dataFreshness || 'webhook_cached',
      performanceNote:
        'This data is served from webhook-cached database for optimal performance',
    };

    console.log(`✅ [SUBSCRIPTION-DETAILS] Served data for ${profile.email}`);

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('❌ [SUBSCRIPTION-DETAILS] Error:', error);
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
