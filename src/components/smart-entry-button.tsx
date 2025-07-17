'use client';

import { useUser } from '@clerk/nextjs';
import { useNavigationLoading } from '@/hooks/use-navigation-loading';
import { useComprehensiveLoading } from '@/hooks/use-comprehensive-loading';
import { Button } from '@/components/ui/button';
import { LogIn, Loader2, Zap, Crown } from 'lucide-react';
import { makeSecureRequest } from '@/lib/csrf-client';
import { TRADING_ALERT_PRODUCTS } from '@/lib/product-config';

interface SmartEntryButtonProps {
  customProductIds?: string[]; // Allow override for specific use cases
  className?: string;
}

export function SmartEntryButton({
  customProductIds = [...TRADING_ALERT_PRODUCTS], // ✅ UPDATED: Use client-safe config, convert readonly to mutable
  className = '',
}: SmartEntryButtonProps) {
  const { isLoaded, isSignedIn, user } = useUser();
  const { navigate } = useNavigationLoading();
  const loading = useComprehensiveLoading('api');

  const handleEntryClick = async () => {
    if (!isLoaded) {
      return;
    }

    if (!isSignedIn) {
      // Redirect to sign-in page with auto-route parameter
      await navigate(
        '/sign-in?redirect_url=' + encodeURIComponent('/?auto_route=true'),
        { message: 'Please sign in to continue...' }
      );
      return;
    }

    // User is signed in, now check their subscription status

    try {
      const result = await loading.withLoading(
        async () => {
          // Check if user has valid product subscription
          console.log('🎯 [SMART-ENTRY] Checking products:', customProductIds);

          const productResponse = await fetch(
            '/api/check-product-subscription',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                allowedProductIds: customProductIds, // ✅ UPDATED: Use configurable product IDs
              }),
            }
          );

          const productResult = await productResponse.json();
          console.log('📊 [SMART-ENTRY] Subscription result:', productResult);

          if (productResult.hasAccess) {
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

      if (result.hasAccess) {
        // User has subscription access - try to get server
        if (result.serverResult?.success && result.serverResult?.server) {
          const server = result.serverResult.server;
          const firstChannel = server.channels?.[0];

          if (firstChannel) {
            await navigate(
              `/servers/${server.id}/channels/${firstChannel.id}`,
              {
                message: 'Opening trading room...',
              }
            );
          } else {
            await navigate(`/servers/${server.id}`, {
              message: 'Opening server...',
            });
          }
        } else {
          // Has access but server lookup failed - try to create/get server again
          console.log('🔄 [SMART-ENTRY] Server lookup failed, retrying...');

          try {
            const retryServerResponse = await makeSecureRequest(
              '/api/servers/ensure-default',
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
              }
            );

            const retryResult = await retryServerResponse.json();

            if (retryResult.success && retryResult.server) {
              const server = retryResult.server;
              const firstChannel = server.channels?.[0];

              if (firstChannel) {
                await navigate(
                  `/servers/${server.id}/channels/${firstChannel.id}`,
                  {
                    message: 'Opening trading room...',
                  }
                );
              } else {
                await navigate(`/servers/${server.id}`, {
                  message: 'Opening server...',
                });
              }
            } else {
              // Still failed - this is unusual, fallback to dashboard but log it
              console.error(
                '❌ [SMART-ENTRY] Server creation/lookup failed twice:',
                retryResult
              );
              await navigate('/dashboard', {
                message: 'Opening dashboard...',
              });
            }
          } catch (retryError) {
            console.error('❌ [SMART-ENTRY] Server retry failed:', retryError);
            await navigate('/dashboard', {
              message: 'Opening dashboard...',
            });
          }
        }
      } else {
        // No subscription access - redirect to pricing
        await navigate('/pricing', {
          message: 'Please upgrade to access...',
        });
      }
    } catch (error) {
      console.error('❌ Error checking subscription:', error);
      // On error, default to pricing page
      await navigate('/pricing', {
        message: 'Redirecting to pricing...',
      });
    }
  };

  if (!isLoaded) {
    return (
      <Button
        size='lg'
        disabled
        className={`bg-gradient-to-r from-yellow-500 to-yellow-600 text-black px-6 sm:px-8 md:px-12 py-4 sm:py-5 md:py-6 text-base sm:text-lg md:text-xl font-bold rounded-lg opacity-50 border border-yellow-400/50 w-full sm:w-auto touch-manipulation ${className}`}
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
        className={`bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-black px-6 sm:px-8 md:px-12 py-4 sm:py-5 md:py-6 text-base sm:text-lg md:text-xl font-bold rounded-lg transition-all duration-200 transform hover:scale-105 shadow-2xl border border-yellow-400/50 w-full sm:w-auto touch-manipulation min-h-[48px] sm:min-h-[52px] md:min-h-[56px] ${className}`}
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
      disabled={loading.isLoading}
      className={`bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white px-6 sm:px-8 md:px-12 py-4 sm:py-5 md:py-6 text-base sm:text-lg md:text-xl font-bold rounded-lg transition-all duration-200 transform hover:scale-105 shadow-2xl disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none border border-green-500/50 w-full sm:w-auto touch-manipulation min-h-[48px] sm:min-h-[52px] md:min-h-[56px] ${className}`}
    >
      {loading.isLoading ? (
        <div className='flex items-center gap-2'>
          <Loader2 className='h-4 w-4 sm:h-5 sm:w-5 animate-spin' />
          <span className='text-sm sm:text-base md:text-lg'>
            {loading.message || 'Entering...'}
          </span>
        </div>
      ) : (
        <div className='flex items-center gap-2'>
          <Zap className='h-4 w-4 sm:h-5 sm:w-5' />
          <span className='text-sm sm:text-base md:text-lg'>
            Enter Traders Utopia
          </span>
        </div>
      )}
    </Button>
  );
}
