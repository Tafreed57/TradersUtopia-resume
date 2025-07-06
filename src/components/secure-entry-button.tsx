'use client';

import { useState, useTransition } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface SecureEntryButtonProps {
  children: React.ReactNode;
  className?: string;
}

async function makeSecureRequest(
  url: string,
  options: RequestInit = {}
): Promise<any> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || `Request failed: ${response.status}`);
  }

  return response.json();
}

export function SecureEntryButton({
  children,
  className,
}: SecureEntryButtonProps) {
  const { isLoaded, isSignedIn } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleClick = async () => {
    setIsLoading(true);

    if (!isLoaded) return;
    if (!isSignedIn) {
      router.push('/sign-in');
      return;
    }

    try {
      // Step 1: Verify payment status from our server
      const verifyResult = await makeSecureRequest(
        '/api/verify-stripe-payment',
        { method: 'POST' }
      );

      // Step 2: Verify product-specific subscription
      const productResult = await makeSecureRequest(
        '/api/check-product-subscription',
        {
          method: 'POST',
          body: JSON.stringify({
            allowedProductIds: [
              process.env.NEXT_PUBLIC_STRIPE_PRODUCT_ID_PREMIUM!,
            ],
          }),
        }
      );

      // Step 3: Check if both verifications passed
      if (productResult.hasAccess && verifyResult.success) {
        // Step 4: Ensure user is in the default server
        const serverResponse = await makeSecureRequest(
          '/api/servers/ensure-default',
          {
            method: 'POST',
          }
        );

        if (serverResponse.success && serverResponse.server) {
          startTransition(() => {
            router.push(`/servers/${serverResponse.server.id}`);
          });
        } else {
          toast.error('Server Access Failed', {
            description: 'Could not grant access to the trading server.',
          });
        }
      } else {
        // One of the checks failed, redirect to pricing
        startTransition(() => {
          router.push('/pricing');
        });
      }
    } catch (error: any) {
      toast.error('Verification Failed', {
        description: error.message,
      });
      // Optional: If any check fails, revoke access and sync subscription
      try {
        await makeSecureRequest('/api/revoke-access', {
          method: 'POST',
        });
        await makeSecureRequest('/api/subscription/sync', {
          method: 'POST',
        });
      } catch (cleanupError: any) {
        // Silently fail cleanup, main error is already shown
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLoading || isPending || !isLoaded}
      className={cn(
        'w-full md:w-auto px-8 py-3 rounded-full text-lg font-bold transition-all duration-300 ease-in-out transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed',
        'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg hover:shadow-xl',
        className
      )}
    >
      {isLoading || isPending ? (
        <span className='flex items-center justify-center'>
          <Loader2 className='w-6 h-6 mr-2 animate-spin' />
          Verifying...
        </span>
      ) : (
        children
      )}
    </button>
  );
}
