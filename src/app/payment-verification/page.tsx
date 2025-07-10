'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import NextImage from 'next/image';
import Link from 'next/link';
import { AuthHeader } from '@/components/auth-header';
import { GlobalMobileMenu } from '@/components/global-mobile-menu';
import { NavigationButton } from '@/components/navigation-button';
import { useLoading } from '@/contexts/loading-provider';
import {
  CheckCircle,
  CreditCard,
  Loader2,
  ExternalLink,
  Users,
} from 'lucide-react';

export default function PaymentVerificationPage() {
  const router = useRouter();
  const { startLoading } = useLoading();
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<
    'idle' | 'success' | 'error'
  >('idle');
  const [verificationResult, setVerificationResult] = useState<any>(null);

  const verifyStripePayment = async () => {
    setIsVerifying(true);
    setVerificationStatus('idle');

    try {
      const response = await fetch('/api/verify-stripe-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setVerificationStatus('success');
        setVerificationResult(result);

        setTimeout(() => {
          startLoading('Setting up your dashboard and servers...');
          router.push('/dashboard');
        }, 1000);
      } else {
        setVerificationStatus('error');
        alert(`❌ ${result.message || result.error}`);
      }
    } catch (error) {
      console.error('Error verifying payment:', error);
      setVerificationStatus('error');
      alert('❌ Error verifying payment with Stripe');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className='h-screen w-screen bg-gradient-to-br from-gray-950 via-slate-950/90 to-black text-white relative overflow-hidden'>
      {/* Animated Background Effects */}
      <div className='absolute inset-0 overflow-hidden'>
        <div className='absolute -top-40 -right-40 w-80 h-80 bg-blue-500/8 rounded-full blur-3xl animate-pulse'></div>
        <div className='absolute top-60 -left-40 w-96 h-96 bg-purple-500/6 rounded-full blur-3xl animate-pulse delay-1000'></div>
        <div className='absolute bottom-40 right-20 w-64 h-64 bg-yellow-500/8 rounded-full blur-3xl animate-pulse delay-2000'></div>
      </div>

      {/* Header */}
      <header className='absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-4 sm:p-6 max-w-7xl mx-auto w-full pwa-safe-top safe-area-inset-left safe-area-inset-right'>
        <div className='flex items-center gap-3 sm:gap-6'>
          {/* Logo and Title */}
          <Link href='/' className='flex items-center gap-2 sm:gap-3'>
            <div className='w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-lg flex items-center justify-center'>
              <NextImage
                src='/logo.png'
                alt='TradersUtopia'
                width={20}
                height={20}
                className='sm:w-6 sm:h-6'
              />
            </div>
            <span className='text-white text-lg sm:text-xl font-bold'>
              TradersUtopia
            </span>
          </Link>

          {/* Authentication Section */}
          <div className='hidden lg:block'>
            <AuthHeader />
          </div>
        </div>

        <div className='flex items-center gap-2 sm:gap-4'>
          <NavigationButton
            href='/pricing'
            asButton={true}
            variant='ghost'
            className='text-white hover:bg-white/10 bg-gray-700/30 backdrop-blur-sm border border-gray-600/30'
            loadingMessage='Loading pricing information...'
          >
            Back to Pricing
          </NavigationButton>
          <GlobalMobileMenu />
        </div>
      </header>

      {/* Main Content - Absolutely Centered */}
      <div className='absolute inset-0 z-10 flex items-center justify-center p-4 sm:p-6'>
        <div className='w-full max-w-2xl'>
          <Card className='bg-gradient-to-br from-gray-800/80 via-gray-800/60 to-gray-900/80 backdrop-blur-md rounded-2xl sm:rounded-3xl p-6 sm:p-8 lg:p-10 w-full border border-gray-600/30 shadow-2xl'>
            <CardHeader className='text-center pb-6'>
              <div className='w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-yellow-400 via-yellow-500 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl'>
                <CreditCard className='w-8 h-8 sm:w-10 sm:h-10 text-black' />
              </div>

              <CardTitle className='text-2xl sm:text-3xl font-bold mb-4'>
                <span className='bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent'>
                  Complete Your Purchase
                </span>
              </CardTitle>

              <CardDescription className='text-gray-300 text-base sm:text-lg text-center'>
                Complete your payment in the Stripe window, then verify your
                purchase below to access your premium features.
              </CardDescription>
            </CardHeader>

            <CardContent>
              {/* Payment Steps */}
              <div className='grid gap-4'>
                <div className='flex items-center gap-4 p-4 bg-gradient-to-r from-blue-600/20 to-blue-700/20 rounded-xl border border-blue-400/30'>
                  <div className='w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center flex-shrink-0'>
                    <span className='text-blue-400 font-bold'>1</span>
                  </div>
                  <div className='flex-1'>
                    <p className='text-white font-semibold'>
                      Complete Payment in Stripe
                    </p>
                    <p className='text-blue-200 text-sm'>
                      Secure checkout powered by Stripe
                    </p>
                  </div>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() =>
                      window.open(
                        'https://buy.stripe.com/test_28E6oG8nd5Bm3N1esU4Ja01',
                        '_blank'
                      )
                    }
                    className='border-blue-400 text-blue-400 hover:bg-blue-400 hover:text-black flex-shrink-0'
                  >
                    <ExternalLink className='w-4 h-4 mr-2' />
                    Open Stripe
                  </Button>
                </div>

                <div className='flex items-center gap-4 p-4 bg-gradient-to-r from-green-600/20 to-green-700/20 rounded-xl border border-green-400/30'>
                  <div className='w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center flex-shrink-0'>
                    <span className='text-green-400 font-bold'>2</span>
                  </div>
                  <div className='flex-1'>
                    <p className='text-white font-semibold'>
                      Verify Your Purchase
                    </p>
                    <p className='text-green-200 text-sm'>
                      Click below after completing payment
                    </p>
                  </div>
                </div>
              </div>

              {/* Verification Button */}
              <div className='mt-6'>
                {verificationStatus === 'success' ? (
                  <div className='text-center space-y-4'>
                    <div className='w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto'>
                      <CheckCircle className='w-8 h-8 text-green-400' />
                    </div>
                    <div>
                      <p className='text-green-400 font-semibold text-lg'>
                        Payment Verified Successfully!
                      </p>
                      {verificationResult?.serversJoined > 0 && (
                        <div className='flex items-center justify-center gap-2 mt-2'>
                          <Users className='w-4 h-4 text-blue-400' />
                          <p className='text-blue-300 text-sm'>
                            Added to {verificationResult.serversJoined} trading
                            servers
                          </p>
                        </div>
                      )}
                      <p className='text-gray-300 text-sm mt-2'>
                        Setting up your dashboard...
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className='space-y-4'>
                    <Button
                      onClick={verifyStripePayment}
                      disabled={isVerifying}
                      className='w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white py-4 text-lg font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none'
                    >
                      {isVerifying ? (
                        <div className='flex items-center justify-center gap-2'>
                          <Loader2 className='w-5 h-5 animate-spin' />
                          <span>Verifying Payment & Setting Up Servers...</span>
                        </div>
                      ) : (
                        <div className='flex items-center justify-center gap-2'>
                          <CheckCircle className='w-5 h-5' />
                          <span>Verify Stripe Payment</span>
                        </div>
                      )}
                    </Button>

                    {verificationStatus === 'error' && (
                      <div className='bg-red-600/20 border border-red-400/30 rounded-xl p-4 text-center'>
                        <p className='text-red-300 text-sm'>
                          ❌ Verification failed. Please ensure your payment
                          completed successfully and try again.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Help Text */}
              <div className='bg-gray-800/60 rounded-xl p-4 border border-gray-600/30 mt-6'>
                <div className='text-center'>
                  <p className='text-gray-300 text-sm mb-2'>
                    <strong>Need help?</strong>
                  </p>
                  <div className='space-y-1 text-xs text-gray-400'>
                    <p>• Complete your payment in the Stripe window</p>
                    <p>• Return here and click "Verify Stripe Payment"</p>
                    <p>• Your servers will be set up automatically</p>
                    <p>• You'll be redirected to your dashboard</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
