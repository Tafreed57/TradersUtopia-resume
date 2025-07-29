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
      const returnUrl = `${window.location.origin}?auto_route=true`;
      router.push(`/sign-in?redirect_url=${encodeURIComponent(returnUrl)}`);
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
              // Valid server data - take user to the server
              router.push(
                `/servers/${serverData.serverId}/channels/${serverData.landingChannelId}`
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
        text-white font-semibold text-lg
        px-8 py-4 rounded-xl
        shadow-lg hover:shadow-xl
        transform transition-all duration-200
        hover:scale-105 hover:-translate-y-1
        border border-blue-500/30
        min-h-[56px] min-w-[200px]
        ${className}
      `}
    >
      <div className='flex items-center justify-center space-x-3'>
        {isLoadingState ? (
          <Loader2 className='w-6 h-6 animate-spin' />
        ) : !isSignedIn ? (
          <LogIn className='w-6 h-6' />
        ) : (
          <Shield className='w-6 h-6' />
        )}

        <span className='font-bold tracking-wide'>
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
