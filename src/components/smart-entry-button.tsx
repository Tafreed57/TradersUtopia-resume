'use client';

import { useState } from 'react';
import { useUser, useSignIn } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Shield, LogIn, Loader2 } from 'lucide-react';
import { makeSecureRequest } from '@/lib/csrf-client';

export function SmartEntryButton() {
  const { isLoaded, isSignedIn, user } = useUser();
  const { signIn, setActive } = useSignIn();
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleEntryClick = async () => {
    console.log('🎯 Smart entry button clicked');

    if (!isLoaded) {
      console.log('⏳ User data not loaded yet...');
      return;
    }

    if (!isSignedIn) {
      console.log('🔐 User not signed in, redirecting to sign-in...');
      // Redirect to sign-in page with auto-route parameter
      router.push(
        '/sign-in?redirect_url=' + encodeURIComponent('/?auto_route=true')
      );
      return;
    }

    // User is signed in, now check their subscription status
    console.log('✅ User is signed in, checking subscription status...');
    setIsProcessing(true);

    try {
      // Check if user has valid product subscription
      console.log(
        '🔍 Checking product subscription for:',
        user?.emailAddresses[0]?.emailAddress
      );

      const productResponse = await fetch('/api/check-product-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          allowedProductIds: ['prod_SWIyAf2tfVrJao'],
        }),
      });

      const productResult = await productResponse.json();
      console.log('📊 Subscription check result:', productResult);

      if (productResult.hasAccess) {
        console.log(
          '✅ User has valid subscription, getting default server...'
        );

        // Get or create the default server and redirect to it
        const serverResponse = await makeSecureRequest(
          '/api/servers/ensure-default',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        const serverResult = await serverResponse.json();

        if (serverResult.success && serverResult.server) {
          const server = serverResult.server;
          const firstChannel = server.channels?.[0];

          if (firstChannel) {
            console.log(
              '🎯 Redirecting to server channel:',
              `${server.name}/${firstChannel.name}`
            );
            router.push(`/servers/${server.id}/channels/${firstChannel.id}`);
          } else {
            console.log('🎯 Redirecting to server:', server.name);
            router.push(`/servers/${server.id}`);
          }
        } else {
          console.log('⚠️ Could not get server, falling back to dashboard...');
          router.push('/dashboard');
        }
      } else {
        console.log('❌ User needs subscription, redirecting to pricing...');
        router.push('/pricing');
      }
    } catch (error) {
      console.error('❌ Error checking subscription:', error);
      // On error, default to pricing page
      router.push('/pricing');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isLoaded) {
    return (
      <Button
        size='lg'
        disabled
        className='bg-gradient-to-r from-yellow-500 to-yellow-600 text-black px-6 sm:px-8 md:px-12 py-4 sm:py-5 md:py-6 text-base sm:text-lg md:text-xl font-bold rounded-lg opacity-50 border border-yellow-400/50 w-full sm:w-auto touch-manipulation'
      >
        <Loader2 className='h-4 w-4 sm:h-5 sm:w-5 animate-spin mr-2' />
        <span className='text-sm sm:text-base md:text-lg'>Loading...</span>
      </Button>
    );
  }

  if (!isSignedIn) {
    return (
      <Button
        size='lg'
        onClick={handleEntryClick}
        className='bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-black px-6 sm:px-8 md:px-12 py-4 sm:py-5 md:py-6 text-base sm:text-lg md:text-xl font-bold rounded-lg transition-all duration-200 transform hover:scale-105 shadow-2xl border border-yellow-400/50 w-full sm:w-auto touch-manipulation min-h-[48px] sm:min-h-[52px] md:min-h-[56px]'
      >
        <LogIn className='h-4 w-4 sm:h-5 sm:w-5 mr-2' />
        <span className='text-sm sm:text-base md:text-lg'>Get Access Now</span>
      </Button>
    );
  }

  // User is signed in, show processing state if checking subscription
  return (
    <Button
      size='lg'
      onClick={handleEntryClick}
      disabled={isProcessing}
      className='bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white px-6 sm:px-8 md:px-12 py-4 sm:py-5 md:py-6 text-base sm:text-lg md:text-xl font-bold rounded-lg transition-all duration-200 transform hover:scale-105 shadow-2xl disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none border border-green-500/50 w-full sm:w-auto touch-manipulation min-h-[48px] sm:min-h-[52px] md:min-h-[56px]'
    >
      {isProcessing ? (
        <div className='flex items-center gap-2'>
          <Loader2 className='h-4 w-4 sm:h-5 sm:w-5 animate-spin' />
          <span className='text-sm sm:text-base md:text-lg'>
            Accessing Platform...
          </span>
        </div>
      ) : (
        <div className='flex items-center gap-2'>
          <Shield className='h-4 w-4 sm:h-5 sm:w-5' />
          <span className='text-sm sm:text-base md:text-lg'>
            Access Trading Platform
          </span>
        </div>
      )}
    </Button>
  );
}
