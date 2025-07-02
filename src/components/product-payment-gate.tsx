'use client';

import { useEffect, useState, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
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
  const router = useRouter();
  const [accessStatus, setAccessStatus] = useState<ProductAccessStatus | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);

  const checkProductAccess = useCallback(async () => {
    if (!isLoaded || !user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Add some delay to prevent immediate duplicate calls
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
        console.warn('Rate limited, waiting before retry...');
        await new Promise(resolve => setTimeout(resolve, 2000));

        const retryResponse = await fetch('/api/check-product-subscription', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            allowedProductIds,
          }),
        });

        if (retryResponse.status === 429) {
          // Still rate limited, use fallback
          setAccessStatus({
            hasAccess: false,
            reason:
              'Rate limit exceeded. Please wait a moment and refresh the page.',
          });
          return;
        }

        const data = await retryResponse.json();
        setAccessStatus(data);
        return;
      }

      const data = await response.json();
      setAccessStatus(data);

      console.log('Product access check:', data);
    } catch (error) {
      console.error('Error checking product access:', error);
      setAccessStatus({
        hasAccess: false,
        reason: 'Error checking subscription status',
      });
    } finally {
      setLoading(false);
    }
  }, [isLoaded, user, allowedProductIds]);

  const verifyStripePayment = async () => {
    setVerifying(true);
    try {
      const response = await fetch('/api/verify-stripe-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (response.ok && result.success) {
        // Re-check product access after verification
        await checkProductAccess();
      } else {
        alert(`❌ ${result.message || result.error}`);
      }
    } catch (error) {
      console.error('Error verifying payment:', error);
      alert('❌ Error verifying payment with Stripe');
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    checkProductAccess();
  }, [isLoaded, user, checkProductAccess]);

  useEffect(() => {
    if (!isLoaded || !user) {
      router.push('/sign-in');
    }
  }, [isLoaded, user, router]);

  if (!isLoaded || !user) {
    return null;
  }

  if (loading) {
    return (
      <div className='flex items-center justify-center min-h-screen'>
        <div className='text-center'>
          <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4'></div>
          <p className='text-muted-foreground'>
            Checking subscription access...
          </p>
        </div>
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
                  onClick={() => router.push('/')}
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
                disabled={verifying}
              >
                {verifying
                  ? 'Verifying...'
                  : '🔍 Verify My Payment with Stripe'}
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
