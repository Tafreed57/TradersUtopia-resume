"use client";

import { useState } from 'react';
import { useUser, useSignIn } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Shield, LogIn, Loader2 } from 'lucide-react';

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
      router.push('/sign-in?redirect_url=' + encodeURIComponent('/?auto_route=true'));
      return;
    }

    // User is signed in, now check their subscription status
    console.log('✅ User is signed in, checking subscription status...');
    setIsProcessing(true);

    try {
      // Check if user has valid product subscription
      console.log('🔍 Checking product subscription for:', user?.emailAddresses[0]?.emailAddress);
      
      const productResponse = await fetch('/api/check-product-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          allowedProductIds: ['prod_SWIyAf2tfVrJao']
        })
      });

      const productResult = await productResponse.json();
      console.log('📊 Subscription check result:', productResult);

      if (productResult.hasAccess) {
        console.log('✅ User has valid subscription, redirecting to dashboard...');
        router.push('/dashboard');
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
        size="lg" 
        disabled
        className="bg-indigo-600 text-white px-8 py-4 text-lg font-semibold rounded-full opacity-50"
      >
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading...
      </Button>
    );
  }

  if (!isSignedIn) {
    return (
      <Button 
        size="lg" 
        onClick={handleEntryClick}
        className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 text-lg font-semibold rounded-full transition-all duration-200 transform hover:scale-105 shadow-xl"
      >
        <LogIn className="h-5 w-5 mr-2" />
        Enter Traders Utopia
      </Button>
    );
  }

  // User is signed in, show processing state if checking subscription
  return (
    <Button 
      size="lg" 
      onClick={handleEntryClick}
      disabled={isProcessing}
      className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 text-lg font-semibold rounded-full transition-all duration-200 transform hover:scale-105 shadow-xl disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
    >
      {isProcessing ? (
        <div className="flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Checking Access...</span>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          <span>Enter Traders Utopia</span>
        </div>
      )}
    </Button>
  );
} 