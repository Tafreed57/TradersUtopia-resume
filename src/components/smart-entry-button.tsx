'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { LogIn, Shield, Loader2 } from 'lucide-react';
import { useComprehensiveLoading } from '@/hooks/use-comprehensive-loading';

interface SmartEntryButtonProps {
  className?: string;
}

export function SmartEntryButton({ className = '' }: SmartEntryButtonProps) {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();
  const loading = useComprehensiveLoading('api');
  const [isNavigating, setIsNavigating] = useState(false);

  const handleEntryClick = async () => {
    if (!isLoaded || isNavigating) return;

    if (!isSignedIn) {
      setIsNavigating(true);
      router.push(`/sign-in?redirect_url=${encodeURIComponent('/pricing')}`);
      // Keep loading state active during navigation
      return;
    }

    try {
      setIsNavigating(true);
      await loading.withLoading(
        async () => {
          // Fetch server data
          const serverResponse = await fetch('/api/servers');

          // Check if response is ok and contains valid server data
          if (serverResponse.ok) {
            const serverData = await serverResponse.json();

            // Validate that we have the required server data
            if (serverData?.serverId && serverData?.landingChannelId) {
              // Valid server data - take user to the server with new routing format
              router.push(
                `/servers/${serverData.serverId}?channel=${serverData.landingChannelId}`
              );
              // Keep isNavigating true - it will be reset by page unload or user interaction
              return;
            }
          }

          // If we get here, either the response was not ok or the data is invalid
          // Redirect to pricing page as fallback
          router.push('/pricing');
          // Keep isNavigating true - it will be reset by page unload or user interaction
        },
        {
          loadingMessage: '✨ Entering Traders Utopia...',
          errorMessage: 'Failed to enter application',
        }
      );
    } catch (error) {
      console.error('❌ Error in smart entry:', error);
      router.push('/pricing');
      // Keep isNavigating true - it will be reset by page unload or user interaction
    }
  };

  const isLoadingState = !isLoaded || loading.isLoading || isNavigating;

  return (
    <Button
      onClick={handleEntryClick}
      disabled={isLoadingState}
      size='lg'
      className={`
        group relative overflow-hidden
        bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600
        hover:from-blue-700 hover:via-purple-700 hover:to-indigo-700
        text-white font-semibold text-base md:text-lg lg:text-xl
        px-4 py-3 md:px-8 md:py-4 lg:px-12 lg:py-6 rounded-lg md:rounded-xl
        shadow-lg hover:shadow-xl
        transform transition-all duration-200
        md:hover:scale-105 md:hover:-translate-y-1
        border border-blue-500/30
        min-h-[48px] md:min-h-[56px] lg:min-h-[64px]
        w-full max-w-full sm:w-auto sm:max-w-none
        min-w-0
        text-center
        ${className}
      `}
    >
      <div className='flex flex-col md:flex-row items-center justify-center w-full gap-1.5 md:gap-3 text-center'>
        {isLoadingState ? (
          <Loader2 className='w-5 h-5 md:w-6 md:h-6 animate-spin' />
        ) : !isSignedIn ? (
          <LogIn className='w-5 h-5 md:w-6 md:h-6' />
        ) : null}

        <span className='block font-bold tracking-wide whitespace-normal break-words leading-snug text-center max-w-full sm:max-w-none'>
          {isLoadingState
            ? 'Loading...'
            : !isSignedIn
            ? 'Enter Traders Utopia'
            : 'Enter Traders Utopia'}
        </span>
      </div>
    </Button>
  );
}
