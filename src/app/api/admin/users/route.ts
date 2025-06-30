import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { clerkClient } from '@clerk/nextjs/server';
import { rateLimitServer, trackSuspiciousActivity } from '@/lib/rate-limit';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-05-28.basil',
});

// Cache for product data to avoid repeated API calls
const productCache = new Map<string, string>();

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
        console.warn(
          `Failed to fetch product name for ${profile.stripeProductId}:`,
          error
        );
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
            console.warn(
              `Failed to fetch price details for ${priceId}:`,
              priceError
            );
          }
        }
      }
    } catch (error) {
      console.warn(
        `Failed to fetch subscription details for customer ${profile.stripeCustomerId}:`,
        error
      );
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

    // Enrich with Clerk and Stripe data
    const enrichedUsers = await Promise.all(
      profiles.map(async profile => {
        try {
          // Get Clerk user data
          let clerkData = null;
          try {
            const clerkUser = await clerkClient.users.getUser(profile.userId);
            clerkData = {
              id: clerkUser.id,
              username: clerkUser.username,
              firstName: clerkUser.firstName,
              lastName: clerkUser.lastName,
              emailAddresses: clerkUser.emailAddresses,
              phoneNumbers: clerkUser.phoneNumbers,
              externalAccounts: clerkUser.externalAccounts,
              createdAt: clerkUser.createdAt,
              updatedAt: clerkUser.updatedAt,
              lastSignInAt: clerkUser.lastSignInAt,
              passwordEnabled: clerkUser.passwordEnabled,
            };
          } catch (clerkError: any) {
            // Only log for non-404 errors (user not found is expected for deleted users)
            if (clerkError?.status !== 404) {
              console.warn(
                `Failed to fetch Clerk data for user ${profile.userId}:`,
                clerkError
              );
            }
            // For 404 errors, silently continue without Clerk data
          }

          // Get Stripe customer data if exists
          let stripeCustomer = null;
          if (profile.stripeCustomerId) {
            try {
              const customer = await stripe.customers.retrieve(
                profile.stripeCustomerId
              );
              if (customer && !customer.deleted) {
                // Get customer's subscriptions
                const subscriptions = await stripe.subscriptions.list({
                  customer: profile.stripeCustomerId,
                  limit: 10,
                });

                // Get customer's payment methods
                const paymentMethods = await stripe.paymentMethods.list({
                  customer: profile.stripeCustomerId,
                  limit: 10,
                });

                // Get recent invoices
                const invoices = await stripe.invoices.list({
                  customer: profile.stripeCustomerId,
                  limit: 5,
                });

                stripeCustomer = {
                  id: customer.id,
                  email: customer.email,
                  name: customer.name,
                  created: customer.created,
                  defaultSource: customer.default_source,
                  subscriptions: subscriptions.data,
                  paymentMethods: paymentMethods.data,
                  invoices: invoices.data,
                };
              }
            } catch (stripeError) {
              console.warn(
                `Failed to fetch Stripe data for customer ${profile.stripeCustomerId}:`,
                stripeError
              );
            }
          }

          return {
            id: profile.id,
            userId: profile.userId,
            name: profile.name,
            email: profile.email,
            imageUrl: profile.imageUrl,
            isAdmin: profile.isAdmin,
            twoFactorEnabled: profile.twoFactorEnabled,
            createdAt: profile.createdAt.toISOString(),
            updatedAt: profile.updatedAt.toISOString(),
            lastActiveAt: undefined, // lastActiveAt field doesn't exist in this schema
            subscription:
              profile.subscriptionStatus !== 'FREE'
                ? await getSubscriptionWithName(profile)
                : undefined,
            stripeCustomer,
            clerkData,
          };
        } catch (error) {
          console.error(`Error enriching user ${profile.userId}:`, error);
          // Return basic profile data even if enrichment fails
          return {
            id: profile.id,
            userId: profile.userId,
            name: profile.name,
            email: profile.email,
            imageUrl: profile.imageUrl,
            isAdmin: profile.isAdmin,
            twoFactorEnabled: profile.twoFactorEnabled,
            createdAt: profile.createdAt.toISOString(),
            updatedAt: profile.updatedAt.toISOString(),
            lastActiveAt: undefined, // lastActiveAt field doesn't exist in this schema
            subscription:
              profile.subscriptionStatus !== 'FREE'
                ? await getSubscriptionWithName(profile)
                : undefined,
          };
        }
      })
    );

    console.log(
      `📊 [ADMIN] Admin ${profile.email} fetched ${enrichedUsers.length} users`
    );

    return NextResponse.json({
      success: true,
      users: enrichedUsers,
      total: enrichedUsers.length,
    });
  } catch (error) {
    console.error('Error fetching users:', error);
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
