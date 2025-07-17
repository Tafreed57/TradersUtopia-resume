'use client';

import { useEffect, useState, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { useNavigationLoading } from '@/hooks/use-navigation-loading';
import { useComprehensiveLoading } from '@/hooks/use-comprehensive-loading';
import { Button } from '@/components/ui/button';
import { ApiLoading } from '@/components/ui/loading-components';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { Lock, Star, CheckCircle, Shield } from 'lucide-react';

interface ProductPaymentGateProps {
  children: React.ReactNode;
  allowedProductIds: string[];
  productName?: string;
  upgradeUrl?: string;
  features?: string[];
  adminBypass?: boolean; // Allow parent to override admin check
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
  adminBypass = false,
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
  const [hasChecked, setHasChecked] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  const checkProductAccess = useCallback(async () => {
    if (!isLoaded || !user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setApiError(null);

    console.log('🔍 [ProductPaymentGate] Checking product access...');

    try {
      // Fetch profile data first
      const profileResponse = await fetch('/api/user/profile');
      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        setProfile(profileData);
      }
      const result = await apiLoading.withLoading(
        async () => {
          const response = await fetch('/api/check-product-subscription', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              allowedProductIds,
            }),
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          return response.json();
        },
        {
          loadingMessage: `Checking ${productName} access...`,
          errorMessage: 'Failed to verify subscription',
        }
      );

      console.log('📊 [ProductPaymentGate] Access check result:', result);

      if (result.hasAccess) {
        setAccessStatus({
          hasAccess: true,
          productId: result.productId,
          reason: result.reason,
        });
      } else {
        setAccessStatus({
          hasAccess: false,
          reason: result.reason || 'No valid subscription found',
        });
      }
    } catch (error) {
      console.error('❌ [ProductPaymentGate] Access check failed:', error);
      setApiError(
        error instanceof Error ? error.message : 'Unknown error occurred'
      );
      setAccessStatus({
        hasAccess: false,
        reason: 'Failed to verify subscription access',
      });
    } finally {
      setLoading(false);
      setHasChecked(true);
    }
  }, [isLoaded, user?.id, allowedProductIds]); // ✅ SIMPLIFIED: Removed heavy dependencies

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
    // ✅ PERFORMANCE: Only check once on mount if we don't have cached data
    if (!hasChecked && isLoaded) {
      checkProductAccess();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, hasChecked]); // ✅ FIXED: Exclude checkProductAccess to prevent re-render loops

  useEffect(() => {
    if (!isLoaded || !user) {
      // Don't automatically redirect to sign-in to prevent homepage redirects
      // Users will see the payment gate with manual sign-in options
      console.log(
        '🔍 [ProductPaymentGate] User not authenticated, showing payment gate instead of redirecting'
      );
    }
  }, [isLoaded, user]);

  // ✅ ADMIN BYPASS: Skip all checks for admin users
  if (isLoaded && user && profile?.isAdmin && adminBypass) {
    console.log(
      '🚀 [ProductPaymentGate] Admin bypass active - rendering content directly'
    );
    return <>{children}</>;
  }

  if (!isLoaded) {
    return (
      <div className='min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-black text-white flex items-center justify-center safe-area-full'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4'></div>
          <p>Loading authentication...</p>
        </div>
      </div>
    );
  }

  // Show sign-in required page for unauthenticated users (no redirect)
  if (!user) {
    return (
      <div className='min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-black text-white flex items-center justify-center p-4 relative overflow-hidden safe-area-full'>
        {/* Animated Background Effects */}
        <div className='absolute inset-0 pointer-events-none'>
          <div className='absolute -top-40 -right-40 w-80 h-80 bg-blue-500/8 rounded-full blur-3xl animate-pulse'></div>
          <div className='absolute top-60 -left-40 w-96 h-96 bg-purple-500/6 rounded-full blur-3xl animate-pulse delay-1000'></div>
          <div className='absolute bottom-40 right-20 w-64 h-64 bg-yellow-500/8 rounded-full blur-3xl animate-pulse delay-2000'></div>
        </div>

        <Card className='w-full max-w-2xl bg-gradient-to-br from-gray-800/90 via-gray-800/70 to-gray-900/90 backdrop-blur-xl border border-gray-600/30 shadow-2xl relative z-10'>
          <CardHeader className='text-center pb-6'>
            <div className='mx-auto mb-6 p-4 bg-gradient-to-br from-blue-500/20 to-purple-600/20 rounded-full w-fit border border-blue-400/30'>
              <Lock className='h-12 w-12 text-blue-400' />
            </div>
            <CardTitle className='text-3xl mb-4 bg-gradient-to-r from-white to-gray-200 bg-clip-text text-transparent'>
              🔒 Authentication Required
            </CardTitle>
            <CardDescription className='text-xl text-gray-300'>
              Please sign in to access {productName}
            </CardDescription>
          </CardHeader>

          <CardContent className='space-y-8'>
            <div className='text-center bg-gradient-to-r from-blue-900/20 to-purple-900/20 p-6 rounded-xl border border-blue-400/30'>
              <h3 className='font-semibold mb-4 flex items-center justify-center gap-3 text-white'>
                <Star className='h-6 w-6 text-yellow-400' />
                What You Get With {productName}:
              </h3>
              <ul className='space-y-3'>
                {features.map((feature, index) => (
                  <li
                    key={index}
                    className='flex items-center gap-3 text-gray-300'
                  >
                    <CheckCircle className='h-5 w-5 text-green-400 flex-shrink-0' />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className='space-y-4'>
              <Button
                size='lg'
                className='w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105'
                onClick={() =>
                  navigate('/sign-in', {
                    message: 'Please sign in to continue...',
                  })
                }
              >
                Sign In to Continue
              </Button>

              <div className='relative'>
                <div className='absolute inset-0 flex items-center'>
                  <span className='w-full border-t border-gray-600' />
                </div>
                <div className='relative flex justify-center text-xs uppercase'>
                  <span className='bg-gray-800 px-3 py-1 text-gray-400 rounded-full border border-gray-600'>
                    Don't have an account?
                  </span>
                </div>
              </div>

              <Button
                variant='outline'
                size='lg'
                className='w-full border-gray-600 text-gray-300 hover:bg-gray-700/50 hover:text-white transition-all duration-300'
                onClick={() =>
                  navigate('/sign-up', { message: 'Create your account...' })
                }
              >
                Create Account
              </Button>
            </div>

            <div className='text-center text-sm text-gray-400 bg-gradient-to-r from-gray-800/50 to-gray-700/50 p-4 rounded-lg border border-gray-600/30'>
              <p className='font-medium text-gray-300'>
                🔒 Secure authentication by Clerk
              </p>
              <p className='mt-1'>Premium trading platform access</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className='min-h-screen bg-gradient-to-br from-gray-950 via-slate-950/90 to-black safe-area-full'>
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

  // Admin bypass check (fallback to Clerk metadata if adminBypass prop wasn't set)
  const isAdminFromClerk =
    user?.publicMetadata?.isAdmin || user?.unsafeMetadata?.isAdmin;
  const isDev = process.env.NODE_ENV === 'development';

  // Only log when there's an access issue, not for every successful access
  if (!accessStatus?.hasAccess && !isAdminFromClerk) {
    console.log('🔒 [ProductPaymentGate] Access denied:', {
      clerkAdmin: isAdminFromClerk,
      hasAccess: accessStatus?.hasAccess,
      reason: accessStatus?.reason || 'No access status available',
      productName,
    });
  }

  if (!accessStatus?.hasAccess && !isAdminFromClerk) {
    return (
      <div className='min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-black text-white flex items-center justify-center p-4 relative overflow-hidden safe-area-full'>
        {/* Animated Background Effects */}
        <div className='absolute inset-0 pointer-events-none'>
          <div className='absolute -top-40 -right-40 w-80 h-80 bg-blue-500/8 rounded-full blur-3xl animate-pulse'></div>
          <div className='absolute top-60 -left-40 w-96 h-96 bg-purple-500/6 rounded-full blur-3xl animate-pulse delay-1000'></div>
          <div className='absolute bottom-40 right-20 w-64 h-64 bg-yellow-500/8 rounded-full blur-3xl animate-pulse delay-2000'></div>
        </div>

        <Card className='w-full max-w-2xl bg-gradient-to-br from-gray-800/90 via-gray-800/70 to-gray-900/90 backdrop-blur-xl border border-gray-600/30 shadow-2xl relative z-10'>
          <CardHeader className='text-center pb-6'>
            <div className='mx-auto mb-6 p-4 bg-gradient-to-br from-blue-500/20 to-purple-600/20 rounded-full w-fit border border-blue-400/30'>
              <Shield className='h-12 w-12 text-blue-400' />
            </div>
            <CardTitle className='text-3xl mb-4 bg-gradient-to-r from-white to-gray-200 bg-clip-text text-transparent'>
              🔒 {productName} Access Required
            </CardTitle>
            <CardDescription className='text-xl text-gray-300'>
              This dashboard requires a subscription to {productName}
            </CardDescription>
          </CardHeader>

          <CardContent className='space-y-8'>
            <div className='text-center bg-gradient-to-r from-red-900/20 to-red-800/20 p-4 rounded-lg border border-red-600/30'>
              <p className='text-gray-300 mb-2'>
                <strong className='text-white'>Access Status:</strong>{' '}
                <span className='font-semibold text-red-400'>Restricted</span>
              </p>
              <p className='text-sm text-gray-400'>{accessStatus?.reason}</p>
              {allowedProductIds.length > 0 && (
                <p className='text-xs text-gray-500 mt-2'>
                  Required products: {allowedProductIds.join(', ')}
                </p>
              )}
            </div>

            <div className='bg-gradient-to-br from-blue-900/20 via-purple-900/20 to-indigo-900/20 p-6 rounded-xl border border-blue-400/30'>
              <h3 className='font-semibold mb-4 flex items-center gap-3 text-white'>
                <Star className='h-6 w-6 text-yellow-400' />
                What You Get With {productName}:
              </h3>
              <ul className='space-y-3'>
                {features.map((feature, index) => (
                  <li
                    key={index}
                    className='flex items-center gap-3 text-gray-300'
                  >
                    <CheckCircle className='h-5 w-5 text-green-400 flex-shrink-0' />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className='space-y-4'>
              <div className='flex flex-col gap-3'>
                <Button
                  size='lg'
                  className='w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105'
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      window.open(upgradeUrl, '_blank');
                    }
                  }}
                >
                  Subscribe to {productName}
                </Button>

                <div className='flex flex-col sm:flex-row gap-3'>
                  <Button
                    variant='outline'
                    size='lg'
                    className='flex-1 border-gray-600 text-gray-300 hover:bg-gray-700/50 hover:text-white transition-all duration-300'
                    onClick={() => {
                      // Clear cache and retry instead of going to homepage
                      if (user) {
                        const key = `${user.id}:${allowedProductIds.sort().join(',')}`;
                        accessCache.delete(key);
                      }
                      checkProductAccess();
                    }}
                    disabled={loading}
                  >
                    {loading ? 'Checking...' : 'Retry Access Check'}
                  </Button>

                  <Button
                    variant='ghost'
                    size='lg'
                    className='flex-1 text-gray-400 hover:bg-gray-700/30 hover:text-gray-300 transition-all duration-300'
                    onClick={() =>
                      navigate('/', { message: 'Going to homepage...' })
                    }
                  >
                    Back to Homepage
                  </Button>
                </div>
              </div>

              <div className='relative'>
                <div className='absolute inset-0 flex items-center'>
                  <span className='w-full border-t border-gray-600' />
                </div>
                <div className='relative flex justify-center text-xs uppercase'>
                  <span className='bg-gray-800 px-3 py-1 text-gray-400 rounded-full border border-gray-600'>
                    Already subscribed?
                  </span>
                </div>
              </div>

              <Button
                variant='outline'
                size='lg'
                className='w-full border-gray-600 text-gray-300 hover:bg-gray-700/50 hover:text-white transition-all duration-300'
                onClick={verifyStripePayment}
                disabled={verifyLoading.isLoading}
              >
                {verifyLoading.isLoading ? (
                  <div className='flex items-center gap-2'>
                    <Loader2 className='w-4 h-4 animate-spin' />
                    <span>{verifyLoading.message || 'Loading...'}</span>
                  </div>
                ) : (
                  '🔍 Verify My Payment with Stripe'
                )}
              </Button>
            </div>

            <div className='text-center text-sm text-gray-400 bg-gradient-to-r from-gray-800/50 to-gray-700/50 p-4 rounded-lg border border-gray-600/30'>
              <p className='font-medium text-gray-300'>
                🔒 Secure payment processing by Stripe
              </p>
              <p className='mt-1'>Cancel anytime • Premium support included</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // User has access to the required product, render the protected content
  return <>{children}</>;
}
