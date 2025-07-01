import { db } from '@/lib/db';
import { currentUser } from '@clerk/nextjs/server';

/**
 * Check if the current user has access to any of the specified products
 * Use this in server components or API routes
 */
export async function checkProductAccess(allowedProductIds: string[]) {
  try {
    const user = await currentUser();

    if (!user) {
      return {
        hasAccess: false,
        reason: 'User not authenticated',
        productId: null,
      };
    }

    const profile = await db.profile.findFirst({
      where: {
        userId: user.id,
        subscriptionStatus: 'ACTIVE',
        subscriptionEnd: {
          gt: new Date(),
        },
        stripeProductId: {
          in: allowedProductIds,
        },
      },
    });

    if (!profile) {
      return {
        hasAccess: false,
        reason: 'No valid subscription found for required products',
        productId: null,
      };
    }

    return {
      hasAccess: true,
      reason: 'Valid subscription found',
      productId: profile.stripeProductId,
      subscriptionEnd: profile.subscriptionEnd,
    };
  } catch (error) {
    console.error('Error checking product access:', error);
    return {
      hasAccess: false,
      reason: 'Error checking access',
      productId: null,
    };
  }
}

/**
 * Product access middleware for API routes
 * Use this to protect API endpoints with product-specific access
 */
export async function requireProductAccess(allowedProductIds: string[]) {
  const accessCheck = await checkProductAccess(allowedProductIds);

  if (!accessCheck.hasAccess) {
    throw new Error(`Access denied: ${accessCheck.reason}`);
  }

  return accessCheck;
}

/**
 * Common product ID configurations
 * Define your product tiers here for easy reuse
 */
export const PRODUCT_TIERS = {
  // Your actual product configurations
  DASHBOARD_ACCESS: ['prod_SWIyAf2tfVrJao'], // Your current product for dashboard access

  // Example configurations for when you add more products
  // BASIC: ['prod_basic_monthly', 'prod_basic_yearly'],
  // PREMIUM: ['prod_premium_monthly', 'prod_premium_yearly'],
  // VIP: ['prod_vip_monthly', 'prod_vip_yearly'],
  // LIFETIME: ['prod_lifetime_access'],

  // Combined tiers (user with any of these gets access)
  // ALL_PAID: ['prod_SWIyAf2tfVrJao', 'prod_future_product2', 'prod_future_product3']
} as const;

/**
 * Hook for client-side product access checking
 * Use this in client components
 */
export async function fetchProductAccess(allowedProductIds: string[]) {
  const response = await fetch('/api/check-product-subscription', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ allowedProductIds }),
  });

  return response.json();
}
