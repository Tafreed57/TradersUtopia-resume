'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Lock, Star, CheckCircle } from 'lucide-react';

interface PaymentStatus {
  hasAccess: boolean;
  subscriptionStatus: string;
  subscriptionEnd: string | null;
  reason: string;
}

interface ServerPaymentGateProps {
  children: React.ReactNode;
}

export const ServerPaymentGate = ({ children }: ServerPaymentGateProps) => {
  const { user, isLoaded } = useUser();
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkPaymentStatus = async () => {
      if (!isLoaded || !user) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/check-payment-status');
        const data = await response.json();
        setPaymentStatus(data);
      } catch (error) {
        console.error('Error checking payment status:', error);
        setPaymentStatus({
          hasAccess: false,
          subscriptionStatus: 'FREE',
          subscriptionEnd: null,
          reason: 'Error checking status',
        });
      } finally {
        setLoading(false);
      }
    };

    checkPaymentStatus();
  }, [user, isLoaded]);

  if (!isLoaded || loading) {
    return (
      <div className='flex items-center justify-center min-h-screen'>
        <div className='animate-spin rounded-full h-32 w-32 border-b-2 border-primary'></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className='flex items-center justify-center min-h-screen'>
        <Card className='w-full max-w-md'>
          <CardHeader className='text-center'>
            <Lock className='h-12 w-12 mx-auto mb-4 text-muted-foreground' />
            <CardTitle>Authentication Required</CardTitle>
            <CardDescription>
              Please sign in to access the trading server.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className='w-full'
              onClick={() => (window.location.href = '/')}
            >
              Go to Homepage
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!paymentStatus?.hasAccess) {
    return (
      <div className='min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4 safe-area-full'>
        <Card className='w-full max-w-2xl'>
          <CardHeader className='text-center'>
            <div className='mx-auto mb-4 p-3 bg-yellow-100 dark:bg-yellow-900/20 rounded-full w-fit'>
              <Lock className='h-8 w-8 text-yellow-600 dark:text-yellow-400' />
            </div>
            <CardTitle className='text-2xl mb-2'>
              🔒 Premium Access Required
            </CardTitle>
            <CardDescription className='text-lg'>
              Unlock exclusive trading alerts and market insights
            </CardDescription>
          </CardHeader>

          <CardContent className='space-y-6'>
            <div className='text-center'>
              <p className='text-muted-foreground mb-4'>
                Current Status:{' '}
                <span className='font-semibold text-red-600'>
                  {paymentStatus?.subscriptionStatus || 'FREE'}
                </span>
              </p>
              <p className='text-sm text-muted-foreground'>
                {paymentStatus?.reason}
              </p>
            </div>

            <div className='grid gap-4'>
              <div className='bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-6 rounded-lg border'>
                <h3 className='font-semibold mb-3 flex items-center gap-2'>
                  <Star className='h-5 w-5 text-yellow-500' />
                  What You Get With Premium:
                </h3>
                <ul className='space-y-2 text-sm'>
                  <li className='flex items-center gap-2'>
                    <CheckCircle className='h-4 w-4 text-green-500' />
                    Real-time trading alerts and signals
                  </li>
                  <li className='flex items-center gap-2'>
                    <CheckCircle className='h-4 w-4 text-green-500' />
                    Exclusive market analysis and insights
                  </li>
                  <li className='flex items-center gap-2'>
                    <CheckCircle className='h-4 w-4 text-green-500' />
                    Access to premium trading community
                  </li>
                  <li className='flex items-center gap-2'>
                    <CheckCircle className='h-4 w-4 text-green-500' />
                    Advanced trading tools and resources
                  </li>
                  <li className='flex items-center gap-2'>
                    <CheckCircle className='h-4 w-4 text-green-500' />
                    24/7 support and guidance
                  </li>
                </ul>
              </div>
            </div>

            <div className='flex flex-col sm:flex-row gap-3'>
              <Button
                size='lg'
                className='flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
                onClick={() =>
                  window.open(process.env.STRIPE_CHECKOUT_URL, '_blank')
                }
              >
                Upgrade to Premium
              </Button>
              <Button
                variant='outline'
                size='lg'
                onClick={() => (window.location.href = '/')}
              >
                Back to Homepage
              </Button>
            </div>

            <div className='text-center text-xs text-muted-foreground'>
              <p>Secure payment processing by Stripe</p>
              <p>Get instant access</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // User has access, render the protected content
  return <>{children}</>;
};
