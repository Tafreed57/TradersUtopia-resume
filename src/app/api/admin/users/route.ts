import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { clerkClient } from '@clerk/nextjs/server';
import { rateLimitServer, trackSuspiciousActivity } from '@/lib/rate-limit';
import { getStripeInstance } from '@/lib/stripe';

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
      const stripe = getStripeInstance();
      if (stripe) {
        try {
          const product = await stripe.products.retrieve(
            profile.stripeProductId
          );
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
  }

  return {
    planName: productName,
    subscriptionStart: profile.subscriptionStart
      ? new Date(profile.subscriptionStart).toLocaleDateString()
      : null,
    subscriptionEnd: profile.subscriptionEnd
      ? new Date(profile.subscriptionEnd).toLocaleDateString()
      : null,
    status: profile.subscriptionStatus,
    stripeCustomerId: profile.stripeCustomerId,
    stripeProductId: profile.stripeProductId,
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

    // Find the admin's profile and check admin status
    const adminProfile = await db.profile.findFirst({
      where: { userId: user.id },
    });

    if (!adminProfile || !adminProfile.isAdmin) {
      trackSuspiciousActivity(request, 'NON_ADMIN_USERS_ACCESS');
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    console.log(`👤 [ADMIN] Admin ${adminProfile.email} accessing user list`);

    // Get all profiles from database
    const profiles = await db.profile.findMany({
      orderBy: [
        { subscriptionStatus: 'desc' }, // Active users first
        { createdAt: 'desc' }, // Then newest first
      ],
    });

    console.log(`📊 [ADMIN] Found ${profiles.length} users in database`);

    // Enrich each profile with additional data
    const enrichedUsers = await Promise.all(
      profiles.map(async profile => {
        // Get subscription info with product name
        const subscription = await getSubscriptionWithName(profile);

        // Get Clerk user data
        let clerkUser = null;
        try {
          if (profile.userId && !profile.userId.startsWith('stripe_')) {
            clerkUser = await clerkClient.users.getUser(profile.userId);
          }
        } catch (clerkError) {
          console.warn(
            `Failed to fetch Clerk data for user ${profile.userId}:`,
            clerkError
          );
        }

        // Get Stripe customer data if available
        let stripeCustomer = null;
        if (profile.stripeCustomerId) {
          const stripe = getStripeInstance();
          if (stripe) {
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
        }

        return {
          // Profile data
          id: profile.id,
          userId: profile.userId,
          name: profile.name,
          email: profile.email,
          imageUrl: profile.imageUrl,
          createdAt: profile.createdAt,
          updatedAt: profile.updatedAt,

          // Subscription data
          subscription,

          // Admin status
          isAdmin: profile.isAdmin,

          // 2FA status
          twoFactorEnabled: profile.twoFactorEnabled,

          // External service data
          clerk: clerkUser
            ? {
                id: clerkUser.id,
                firstName: clerkUser.firstName,
                lastName: clerkUser.lastName,
                emailAddresses: clerkUser.emailAddresses,
                createdAt: clerkUser.createdAt,
                lastSignInAt: clerkUser.lastSignInAt,
                banned: clerkUser.banned,
              }
            : null,

          stripe: stripeCustomer,
        };
      })
    );

    console.log(
      `✅ [ADMIN] Successfully enriched user data for ${enrichedUsers.length} users`
    );

    return NextResponse.json({
      users: enrichedUsers,
      totalUsers: enrichedUsers.length,
      summary: {
        active: enrichedUsers.filter(u => u.subscription.status === 'ACTIVE')
          .length,
        expired: enrichedUsers.filter(u => u.subscription.status === 'EXPIRED')
          .length,
        cancelled: enrichedUsers.filter(
          u => u.subscription.status === 'CANCELLED'
        ).length,
        free: enrichedUsers.filter(u => u.subscription.status === 'FREE')
          .length,
        admins: enrichedUsers.filter(u => u.isAdmin).length,
        twoFactorEnabled: enrichedUsers.filter(u => u.twoFactorEnabled).length,
      },
    });
  } catch (error) {
    console.error('❌ [ADMIN] Error fetching users:', error);
    trackSuspiciousActivity(request, 'ADMIN_USERS_ERROR');

    return NextResponse.json(
      {
        error: 'Failed to fetch users',
        message: 'Unable to retrieve user list. Please try again later.',
      },
      { status: 500 }
    );
  }
}
