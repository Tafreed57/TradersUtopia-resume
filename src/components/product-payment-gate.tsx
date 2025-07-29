'use client';

import { useEffect } from 'react';
import { useNavigationLoading } from '@/hooks/use-navigation-loading';
import { useComprehensiveLoading } from '@/hooks/use-comprehensive-loading';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { Lock, Star, CheckCircle, Shield } from 'lucide-react';
import { useExtendedUser } from '@/hooks/use-extended-user';

interface ProductPaymentGateProps {
  children: React.ReactNode;
  allowedProductIds?: string[]; // Keep for compatibility but not used since useExtendedUser handles access
  productName?: string;
  upgradeUrl?: string;
  features?: string[];
  adminBypass?: boolean; // Allow parent to override admin check
}

export function ProductPaymentGate({
  children,
  allowedProductIds = [], // Keep for compatibility
  productName = 'Premium Product',
  upgradeUrl = '/pricing',
  features = [
    'Exclusive dashboard access',
    'Premium features',
    'Priority support',
  ],
  adminBypass = true, // Default to true so admins automatically get premium access
}: ProductPaymentGateProps) {
  const { isLoaded, user, isAdmin, hasAccess, isLoading, refetch } =
    useExtendedUser();
  console.log('🚀 [ProductPaymentGate] user:', hasAccess);
  const { navigate } = useNavigationLoading();
  const verifyLoading = useComprehensiveLoading('api');

  const verifyStripePayment = async () => {
    try {
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
        // Re-check access after verification
        await refetch();
      } else {
        alert(`❌ ${result.message || result.error}`);
      }
    } catch (error) {
      console.error('Error verifying payment:', error);
      alert('❌ Error verifying payment with Stripe');
    }
  };

  useEffect(() => {
    if (!isLoaded || !user) {
      // Don't automatically redirect to sign-in to prevent homepage redirects
      // Users will see the payment gate with manual sign-in options
    }
  }, [isLoaded, user]);

  // ✅ ADMIN BYPASS: Skip all checks for admin users
  if (isLoaded && user && isAdmin && adminBypass) {
    console.log(
      '🚀 [ProductPaymentGate] Admin bypass active - rendering content directly'
    );
    return <>{children}</>;
  }

  if (!isLoaded || isLoading) {
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

  // Check if user has access using the useExtendedUser hook
  if (!hasAccess) {
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
              <p className='text-sm text-gray-400'>
                Subscription required to access {productName}
              </p>
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
                      refetch();
                    }}
                    disabled={isLoading}
                  >
                    {isLoading ? 'Checking...' : 'Retry Access Check'}
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
