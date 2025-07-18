import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { clerkClient } from '@clerk/nextjs/server';
import { rateLimitServer, trackSuspiciousActivity } from '@/lib/rate-limit';
import Stripe from 'stripe';

// Cache for product data to avoid repeated API calls
const productCache = new Map<string, string>();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
export const dynamic = 'force-dynamic';

// Helper function to get subscription with product name
async function getSubscriptionWithName(profile: any) {
  let productName = 'Premium Subscription';
  let planName = 'Premium Plan';

  // Try to get product name from Stripe if we have a product ID
  if (profile.stripeProductId) {
    // Check cache first
    if (productCache.has(profile.stripeProductId)) {
      productName = productCache.get(profile.stripeProductId)!;
    } else {
      try {
        const product = await stripe.products.retrieve(profile.stripeProductId);
        productName = product.name || 'Premium Subscription';
        // Cache the result
        productCache.set(profile.stripeProductId, productName);
      } catch (error) {
        //
      }
    }
  }

  // Try to get price/plan name from active subscriptions
  if (profile.stripeCustomerId) {
    try {
      const subscriptions = await stripe.subscriptions.list({
        customer: profile.stripeCustomerId,
        status: 'all',
        limit: 5,
      });

      if (subscriptions.data.length > 0) {
        const latestSubscription = subscriptions.data[0];
        if (latestSubscription.items.data.length > 0) {
          const priceId = latestSubscription.items.data[0].price.id;
          try {
            const price = await stripe.prices.retrieve(priceId);
            if (price.nickname) {
              planName = price.nickname;
            } else if (price.product && typeof price.product === 'string') {
              const product = await stripe.products.retrieve(price.product);
              productName = product.name || productName;
            }
          } catch (priceError) {
            //
          }
        }
      }
    } catch (error) {
      //
    }
  }

  return {
    id: profile.id, // Using profile ID as subscription ID
    status: profile.subscriptionStatus.toLowerCase(),
    currentPeriodEnd:
      profile.subscriptionEnd?.toISOString() ||
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    customerId: profile.stripeCustomerId || '',
    subscriptionId: profile.stripeSessionId || '',
    priceId: '', // Not stored in this schema
    productId: profile.stripeProductId || '',
    productName: productName,
    planName: planName,
    createdAt:
      profile.subscriptionStart?.toISOString() ||
      profile.createdAt.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  try {
    // Rate limiting for admin operations
    const rateLimitResult = await rateLimitServer()(request);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(request, 'ADMIN_USERS_RATE_LIMIT_EXCEEDED');
      return rateLimitResult.error;
    }

    const user = await currentUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Find the user's profile and check admin status
    const profile = await db.profile.findFirst({
      where: { userId: user.id },
    });

    if (!profile || !profile.isAdmin) {
      trackSuspiciousActivity(request, 'NON_ADMIN_USERS_ACCESS_ATTEMPT');
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Fetch all profiles from database
    const profiles = await db.profile.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Format user data for admin panel
    const formattedUsers = profiles.map(profile => {
      let subscriptionInfo = null;
      let productInfo = null;

      // ✅ WEBHOOK-OPTIMIZED: Use cached subscription data instead of live Stripe calls
      if (profile.subscriptionStatus === 'ACTIVE' && profile.stripeProductId) {
        subscriptionInfo = {
          id: profile.stripeSubscriptionId || 'unknown',
          status: profile.subscriptionStatus,
          current_period_start: profile.subscriptionStart?.getTime()
            ? profile.subscriptionStart.getTime() / 1000
            : null,
          current_period_end: profile.subscriptionEnd?.getTime()
            ? profile.subscriptionEnd.getTime() / 1000
            : null,
          cancel_at_period_end: !profile.subscriptionAutoRenew,
          canceled_at: profile.subscriptionCancelledAt?.getTime()
            ? profile.subscriptionCancelledAt.getTime() / 1000
            : null,
          // Additional cached data
          items: profile.stripePriceId
            ? {
                data: [
                  {
                    price: {
                      id: profile.stripePriceId,
                      unit_amount: profile.subscriptionAmount,
                      currency: profile.subscriptionCurrency,
                      recurring: {
                        interval: profile.subscriptionInterval,
                      },
                    },
                  },
                ],
              }
            : null,
          discount: profile.discountPercent
            ? {
                coupon: {
                  name: profile.discountName,
                  percent_off: profile.discountPercent,
                },
              }
            : null,
          lastWebhookUpdate: profile.lastWebhookUpdate,
          dataSource: 'webhook_cached',
        };

        // ✅ WEBHOOK-OPTIMIZED: Use cached product info or provide default
        productInfo = {
          id: profile.stripeProductId,
          name: 'Premium Plan', // Could be cached in future if needed
          description: 'Premium trading platform access',
          metadata: {},
          dataSource: 'default', // Indicate this is default data
        };
      }

      return {
        id: profile.userId,
        name: profile.name,
        email: profile.email,
        imageUrl: profile.imageUrl,
        subscriptionStatus: profile.subscriptionStatus,
        subscriptionStart: profile.subscriptionStart,
        subscriptionEnd: profile.subscriptionEnd,
        stripeCustomerId: profile.stripeCustomerId,
        isAdmin: profile.isAdmin,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt,

        // ✅ WEBHOOK-OPTIMIZED: Enhanced subscription data from cache
        subscription: subscriptionInfo,
        product: productInfo,
        cachedSubscriptionData: {
          stripeSubscriptionId: profile.stripeSubscriptionId,
          subscriptionAmount: profile.subscriptionAmount,
          subscriptionCurrency: profile.subscriptionCurrency,
          subscriptionInterval: profile.subscriptionInterval,
          subscriptionAutoRenew: profile.subscriptionAutoRenew,
          discountPercent: profile.discountPercent,
          discountName: profile.discountName,
          lastWebhookUpdate: profile.lastWebhookUpdate,
        },
        performanceNote: 'Using webhook-cached data for optimal performance',
      };
    });

    return NextResponse.json({
      success: true,
      users: formattedUsers,
      total: formattedUsers.length,
    });
  } catch (error) {
    trackSuspiciousActivity(request, 'ADMIN_USERS_FETCH_ERROR');

    return NextResponse.json(
      {
        error: 'Failed to fetch users',
        message: 'Unable to load user data. Please try again later.',
      },
      { status: 500 }
    );
  }
}
