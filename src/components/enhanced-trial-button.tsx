'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ExternalLink, Loader2, ArrowRight } from 'lucide-react';
import { useUser, useAuth } from '@clerk/nextjs';
import { toast } from 'sonner';
import { makeSecureRequest } from '@/lib/csrf-client';

interface EnhancedTrialButtonProps {
  isSignedIn?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function EnhancedTrialButton({
  isSignedIn = false,
  className = '',
  children,
}: EnhancedTrialButtonProps) {
  const { isLoaded, isSignedIn: authSignedIn } = useAuth();
  const router = useRouter();
  const { user } = useUser();
  const [isProcessing, setIsProcessing] = useState(false);
  const [subscriptionData, setSubscriptionData] = useState<any>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function checkSubscription() {
      if (!user) {
        setCheckingStatus(false);
        return;
      }

      try {
        const response = await makeSecureRequest('/api/check-payment-status');
        const data = await response.json();
        setSubscriptionData(data);
      } catch (error) {
        console.error('Error checking subscription:', error);
        // If check fails, assume no subscription
        setSubscriptionData({
          hasAccess: false,
          status: 'ERROR',
          canStartTrial: false,
        });
      } finally {
        setCheckingStatus(false);
      }
    }

    checkSubscription();
  }, [user]);

  const handleStartTrial = async () => {
    setIsLoading(true);

    if (!isLoaded) {
      return;
    }

    if (!isSignedIn) {
      router.push('/sign-up?redirect_url=/dashboard');
      return;
    }

    try {
      const response = await makeSecureRequest('/api/subscription/check');
      const data = await response.json();
      if (data.hasAccess) {
        // Use smart server navigation for users with access
        try {
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
              router.push(`/servers/${server.id}/channels/${firstChannel.id}`);
            } else {
              router.push(`/servers/${server.id}`);
            }
          } else {
            // Fallback to dashboard if server lookup fails
            router.push('/dashboard');
          }
        } catch (error) {
          console.error('❌ [ENHANCED-TRIAL] Server navigation error:', error);
          router.push('/dashboard');
        }
        return;
      }

      if (data.canStartTrial) {
        const trialResponse = await makeSecureRequest(
          '/api/subscription/start-trial',
          {
            method: 'POST',
          }
        );
        const trialData = await trialResponse.json();
        if (trialData.success) {
          toast.success(trialData.message);

          // Use smart server navigation after successful trial start
          try {
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
                router.push(
                  `/servers/${server.id}/channels/${firstChannel.id}`
                );
              } else {
                router.push(`/servers/${server.id}`);
              }
            } else {
              // Fallback to dashboard if server lookup fails
              router.push('/dashboard');
            }
          } catch (error) {
            console.error(
              '❌ [ENHANCED-TRIAL] Post-trial server navigation error:',
              error
            );
            router.push('/dashboard');
          }
        } else {
          throw new Error(trialData.error);
        }
      } else {
        router.push('/pricing');
      }
    } catch (error: any) {
      toast.error('An error occurred', {
        description: error.message || 'Please try again later.',
      });
      setIsLoading(false);
    }
  };

  // Show loading state while checking subscription
  if (checkingStatus) {
    return (
      <Button
        size='lg'
        disabled
        className={`w-full bg-gray-600 text-white py-3 sm:py-4 text-base sm:text-lg font-semibold rounded-lg sm:rounded-full transition-all duration-200 touch-manipulation min-h-[44px] ${className}`}
      >
        <div className='flex items-center gap-2'>
          <Loader2 className='h-4 w-4 sm:h-5 sm:w-5 animate-spin' />
          <span>Checking Status...</span>
        </div>
      </Button>
    );
  }

  // If user has active subscription, show "Go to Dashboard" button
  if (subscriptionData?.hasAccess) {
    return (
      <Button
        size='lg'
        onClick={handleStartTrial}
        disabled={isLoading}
        className={`w-full bg-blue-600 hover:bg-blue-700 text-white py-3 sm:py-4 text-base sm:text-lg font-semibold rounded-lg sm:rounded-full transition-all duration-200 transform hover:scale-105 shadow-xl disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none touch-manipulation min-h-[44px] ${className}`}
      >
        {isLoading ? (
          <div className='flex items-center gap-2'>
            <Loader2 className='h-4 w-4 sm:h-5 sm:w-5 animate-spin' />
            <span>Loading...</span>
          </div>
        ) : (
          <div className='flex items-center gap-2'>
            <ArrowRight className='h-4 w-4 sm:h-5 sm:w-5' />
            <span>Enter Traders Utopia</span>
          </div>
        )}
      </Button>
    );
  }

  // If user doesn't have subscription, show "Subscribe Now" button that goes to payment verification page
  return (
    <Button
      size='lg'
      onClick={handleStartTrial}
      disabled={isLoading}
      className={`w-full bg-green-600 hover:bg-green-700 text-white py-3 sm:py-4 text-base sm:text-lg font-semibold rounded-lg sm:rounded-full transition-all duration-200 transform hover:scale-105 shadow-xl disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none touch-manipulation min-h-[44px] ${className}`}
    >
      {isLoading ? (
        <div className='flex items-center gap-2'>
          <Loader2 className='h-4 w-4 sm:h-5 sm:w-5 animate-spin' />
          <span>Loading...</span>
        </div>
      ) : (
        <div className='flex items-center gap-2'>
          <ExternalLink className='h-4 w-4 sm:h-5 sm:w-5' />
          <span>{children}</span>
        </div>
      )}
    </Button>
  );
}
