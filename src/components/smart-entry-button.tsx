'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { LogIn, Shield, Loader2 } from 'lucide-react';
import { useComprehensiveLoading } from '@/hooks/use-comprehensive-loading';
import { makeSecureRequest } from '@/lib/csrf-client';
import { useExtendedUser } from '@/hooks/use-extended-user';
import { TRADING_ALERT_PRODUCTS } from '@/lib/product-config';

interface SmartEntryButtonProps {
  customProductIds?: string[];
  className?: string;
}

export function SmartEntryButton({
  customProductIds = [...TRADING_ALERT_PRODUCTS],
  className = '',
}: SmartEntryButtonProps) {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();
  const loading = useComprehensiveLoading('api');
  const [isProcessing, setIsProcessing] = useState(false);

  // ✅ OPTIMIZED: Use unified auth instead of making separate API call
  const {
    hasAccess,
    isLoading: authLoading,
    refetch,
    isStale,
  } = useExtendedUser();

  const handleEntryClick = async () => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      const returnUrl = `${window.location.origin}?auto_route=true`;
      router.push(`/sign-in?redirect_url=${encodeURIComponent(returnUrl)}`);
      return;
    }

    setIsProcessing(true);

    try {
      await refetch();
      // ✅ OPTIMIZED: Check if auth data is stale and refresh if needed
      if (isStale()) {
        console.log('🔄 [SMART-ENTRY] Auth data is stale, refreshing...');
        await refetch();
      }

      const result = await loading.withLoading(
        async () => {
          // ✅ OPTIMIZED: Use cached auth data instead of API call
          if (hasAccess) {
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
            return { hasAccess: true, serverResult };
          } else {
            return { hasAccess: false };
          }
        },
        {
          loadingMessage: '✨ Entering Traders Utopia...',
          errorMessage: 'Failed to verify access',
        }
      );

      if (result.hasAccess && result.serverResult?.success) {
        const server = result.serverResult.server;
        const firstChannel = server.channels?.[0];

        if (firstChannel) {
          router.push(`/servers/${server.id}/channels/${firstChannel.id}`);
        } else {
          router.push(`/servers/${server.id}`);
        }
      } else {
        router.push('/pricing');
      }
    } catch (error) {
      console.error('❌ Error in smart entry:', error);
      router.push('/pricing');
    } finally {
      setIsProcessing(false);
    }
  };

  const isLoadingState =
    !isLoaded || authLoading || loading.isLoading || isProcessing;

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

      {/* ✅ PERFORMANCE: Show optimization indicator */}
      {!isLoadingState && hasAccess && (
        <div
          className='absolute top-1 right-1 w-2 h-2 bg-green-400 rounded-full opacity-60'
          title='Access verified via optimized cache'
        />
      )}
    </Button>
  );
}
