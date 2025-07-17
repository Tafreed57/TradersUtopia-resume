import { db } from '@/lib/db';
import { currentUser } from '@clerk/nextjs/server';
import { TRADING_ALERT_PRODUCTS, PRODUCT_TIERS } from '@/lib/product-config';

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
 * Enhanced product access check with auto-sync
 */
export async function checkProductAccessWithSync(allowedProductIds: string[]) {
  // First try the quick database check
  const quickCheck = await checkProductAccess(allowedProductIds);

  if (quickCheck.hasAccess) {
    return quickCheck;
  }

  // If no access found, this could be a stale cache issue
  // Return the result but recommend using the enhanced API endpoint
  return {
    ...quickCheck,
    recommendSync: true,
    syncEndpoint: '/api/check-product-subscription',
  };
}

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

/**
 * ✅ CONVENIENCE: Quick access check for trading alerts
 */
export async function checkTradingAlertAccess() {
  return checkProductAccess([...TRADING_ALERT_PRODUCTS]);
}

/**
 * ✅ CONVENIENCE: Client-side trading alert access check
 */
export async function fetchTradingAlertAccess() {
  return fetchProductAccess([...TRADING_ALERT_PRODUCTS]);
}

// Re-export the product configurations for backward compatibility
export { TRADING_ALERT_PRODUCTS, PRODUCT_TIERS } from '@/lib/product-config';
