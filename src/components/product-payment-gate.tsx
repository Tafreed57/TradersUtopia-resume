'use client';

import { useEffect, useState, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { useNavigationLoading } from '@/hooks/use-navigation-loading';
import { useComprehensiveLoading } from '@/hooks/use-comprehensive-loading';
import { Button } from '@/components/ui/button';
import {
  ComponentLoading,
  ApiLoading,
  ButtonLoading,
} from '@/components/ui/loading-components';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Lock, Star, CheckCircle, Shield } from 'lucide-react';

interface ProductPaymentGateProps {
  children: React.ReactNode;
  allowedProductIds: string[];
  productName?: string;
  upgradeUrl?: string;
  features?: string[];
}

interface ProductAccessStatus {
  hasAccess: boolean;
  productId?: string;
  reason: string;
  subscriptionEnd?: string;
}

// ✅ PERFORMANCE: Simple in-memory cache to avoid redundant API calls
const accessCache = new Map<
  string,
  { status: ProductAccessStatus; timestamp: number }
>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

function getCacheKey(userId: string, productIds: string[]): string {
  return `${userId}:${productIds.sort().join(',')}`;
}

function getCachedAccess(
  userId: string,
  productIds: string[]
): ProductAccessStatus | null {
  const key = getCacheKey(userId, productIds);
  const cached = accessCache.get(key);

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.status;
  }

  // Clean up expired cache entries
  if (cached) {
    accessCache.delete(key);
  }

  return null;
}

function setCachedAccess(
  userId: string,
  productIds: string[],
  status: ProductAccessStatus
): void {
  const key = getCacheKey(userId, productIds);
  accessCache.set(key, { status, timestamp: Date.now() });
}

export function ProductPaymentGate({
  children,
  allowedProductIds,
  productName = 'Premium Product',
  upgradeUrl = '/pricing',
  features = [
    'Exclusive dashboard access',
    'Premium features',
    'Priority support',
  ],
}: ProductPaymentGateProps) {
  const { isLoaded, user } = useUser();
  const { navigate } = useNavigationLoading();
  const apiLoading = useComprehensiveLoading('api');
  const verifyLoading = useComprehensiveLoading('api');
  const [accessStatus, setAccessStatus] = useState<ProductAccessStatus | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  const checkProductAccess = useCallback(async () => {
    if (!isLoaded || !user) {
      setLoading(false);
      return;
    }

    try {
      setApiError(null);

      // ✅ PERFORMANCE: Check cache first
      const cachedStatus = getCachedAccess(user.id, allowedProductIds);
      if (cachedStatus) {
        setAccessStatus(cachedStatus);
        setLoading(false);
        return;
      }

      const data = await apiLoading.withLoading(
        async () => {
          // ✅ PERFORMANCE: Debounce multiple rapid calls
          await new Promise(resolve => setTimeout(resolve, 100));

          const response = await fetch('/api/check-product-subscription', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              allowedProductIds,
            }),
          });

          if (response.status === 429) {
            // Rate limited - wait and retry once
            await new Promise(resolve => setTimeout(resolve, 2000));

            const retryResponse = await fetch(
              '/api/check-product-subscription',
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  allowedProductIds,
                }),
              }
            );

            if (retryResponse.status === 429) {
              throw new Error(
                'Rate limit exceeded. Please wait a moment and refresh the page.'
              );
            }

            return retryResponse.json();
          }

          return response.json();
        },
        {
          loadingMessage: `Checking ${productName} access...`,
          errorMessage: 'Failed to verify subscription access',
        }
      );

      setAccessStatus(data);
      setCachedAccess(user.id, allowedProductIds, data);
    } catch (error) {
      console.error('Error checking product access:', error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Error checking subscription status';
      setApiError(errorMessage);
      const errorStatus = {
        hasAccess: false,
        reason: errorMessage,
      };
      setAccessStatus(errorStatus);
    } finally {
      setLoading(false);
    }
  }, [isLoaded, user, allowedProductIds, apiLoading, productName]);

  const verifyStripePayment = async () => {
    try {
      // ✅ PERFORMANCE: Clear cache on manual verification
      if (user) {
        const key = getCacheKey(user.id, allowedProductIds);
        accessCache.delete(key);
      }

      const result = await verifyLoading.withLoading(
        async () => {
          const response = await fetch('/api/verify-stripe-payment', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          return response.json();
        },
        {
          loadingMessage: 'Verifying payment with Stripe...',
          successMessage: 'Payment verified successfully!',
          errorMessage: 'Failed to verify payment',
        }
      );

      if (result.success) {
        // Re-check product access after verification
        await checkProductAccess();
      } else {
        alert(`❌ ${result.message || result.error}`);
      }
    } catch (error) {
      console.error('Error verifying payment:', error);
      alert('❌ Error verifying payment with Stripe');
    }
  };

  useEffect(() => {
    // ✅ PERFORMANCE: Only check once on mount, rely on cache for subsequent renders
    checkProductAccess();
  }, [isLoaded, user?.id]); // Removed checkProductAccess from deps to prevent loops

  useEffect(() => {
    if (!isLoaded || !user) {
      navigate('/sign-in', {
        message: 'Please sign in to continue...',
      });
    }
  }, [isLoaded, user, navigate]);

  if (!isLoaded || !user) {
    return null;
  }

  if (loading) {
    return (
      <div className='min-h-screen bg-gradient-to-br from-gray-950 via-slate-950/90 to-black'>
        <ApiLoading
          isLoading={loading || apiLoading.isLoading}
          error={apiError}
          retry={checkProductAccess}
          message={
            apiLoading.isLoading
              ? apiLoading.message
              : `Checking ${productName} access...`
          }
        />
      </div>
    );
  }

  if (!accessStatus?.hasAccess) {
    return (
      <div className='min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4'>
        <Card className='w-full max-w-2xl'>
          <CardHeader className='text-center'>
            <div className='mx-auto mb-4 p-3 bg-blue-100 rounded-full w-fit'>
              <Shield className='h-8 w-8 text-blue-600' />
            </div>
            <CardTitle className='text-2xl mb-2'>
              🔒 {productName} Access Required
            </CardTitle>
            <CardDescription className='text-lg'>
              This dashboard requires a subscription to {productName}
            </CardDescription>
          </CardHeader>

          <CardContent className='space-y-6'>
            <div className='text-center'>
              <p className='text-muted-foreground mb-2'>
                <strong>Access Status:</strong>{' '}
                <span className='font-semibold text-red-600'>Restricted</span>
              </p>
              <p className='text-sm text-muted-foreground'>
                {accessStatus?.reason}
              </p>
              {allowedProductIds.length > 0 && (
                <p className='text-xs text-muted-foreground mt-2'>
                  Required products: {allowedProductIds.join(', ')}
                </p>
              )}
            </div>

            <div className='bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border'>
              <h3 className='font-semibold mb-3 flex items-center gap-2'>
                <Star className='h-5 w-5 text-yellow-500' />
                What You Get With {productName}:
              </h3>
              <ul className='space-y-2 text-sm'>
                {features.map((feature, index) => (
                  <li key={index} className='flex items-center gap-2'>
                    <CheckCircle className='h-4 w-4 text-green-500' />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>

            <div className='space-y-3'>
              <div className='flex flex-col sm:flex-row gap-3'>
                <Button
                  size='lg'
                  className='flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      window.open(upgradeUrl, '_blank');
                    }
                  }}
                >
                  Subscribe to {productName}
                </Button>
                <Button
                  variant='outline'
                  size='lg'
                  onClick={() =>
                    navigate('/', { message: 'Going to homepage...' })
                  }
                >
                  Back to Homepage
                </Button>
              </div>

              <div className='relative'>
                <div className='absolute inset-0 flex items-center'>
                  <span className='w-full border-t' />
                </div>
                <div className='relative flex justify-center text-xs uppercase'>
                  <span className='bg-background px-2 text-muted-foreground'>
                    Already subscribed?
                  </span>
                </div>
              </div>

              <Button
                variant='outline'
                size='lg'
                className='w-full'
                onClick={verifyStripePayment}
                disabled={verifyLoading.isLoading}
              >
                <ButtonLoading
                  isLoading={verifyLoading.isLoading}
                  loadingText={verifyLoading.message}
                >
                  🔍 Verify My Payment with Stripe
                </ButtonLoading>
              </Button>
            </div>

            <div className='text-center text-xs text-muted-foreground'>
              <p>Secure payment processing by Stripe</p>
              <p>Cancel anytime • Premium support included</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // User has access to the required product, render the protected content
  return <>{children}</>;
}
