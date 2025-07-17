// Smart routing utility for handling authentication and subscription-based navigation
'use client';

import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { TRADING_ALERT_PRODUCTS } from '@/lib/product-config';

interface SmartRoutingOptions {
  onError?: (error: Error) => void;
  loadingCallback?: (loading: boolean) => void;
  customProductIds?: string[]; // Allow override for specific use cases
}

export function useSmartRouting(options: SmartRoutingOptions = {}) {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();
  const {
    onError,
    loadingCallback,
    customProductIds = [...TRADING_ALERT_PRODUCTS], // ✅ UPDATED: Use client-safe config, convert readonly to mutable
  } = options;

  const handleSmartNavigation = async () => {
    if (!isLoaded) {
      return; // Wait for Clerk to load
    }

    try {
      loadingCallback?.(true);

      // If user is not signed in, redirect to sign-in page
      if (!isSignedIn) {
        router.push('/sign-in');
        return;
      }

      // User is signed in - check subscription status
      console.log('🎯 [SMART-ROUTING] Checking products:', customProductIds);

      const response = await fetch('/api/check-product-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          allowedProductIds: customProductIds, // ✅ UPDATED: Use configurable product IDs
        }),
      });

      if (!response.ok) {
        console.warn(
          '⚠️ [SMART-ROUTING] Subscription check failed, redirecting to pricing'
        );
        router.push('/pricing');
        return;
      }

      const result = await response.json();
      console.log('📊 [SMART-ROUTING] Subscription result:', result);

      if (result.hasAccess) {
        // User has subscription - go to dashboard
        console.log(
          '✅ [SMART-ROUTING] Access granted, redirecting to dashboard'
        );
        router.push('/dashboard');
      } else {
        // User doesn't have subscription - go to pricing
        console.log('❌ [SMART-ROUTING] No access, redirecting to pricing');
        router.push('/pricing');
      }
    } catch (error) {
      console.error('❌ Error in smart routing:', error);
      onError?.(error as Error);
      // On error, redirect to pricing to be safe
      router.push('/pricing');
    } finally {
      loadingCallback?.(false);
    }
  };

  return {
    handleSmartNavigation,
    isLoaded,
    isSignedIn,
    productIds: customProductIds, // ✅ ADDED: Expose which products are being checked
  };
}
