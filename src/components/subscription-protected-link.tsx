'use client';

import { forwardRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { useNavigationLoading } from '@/hooks/use-navigation-loading';
import { useComprehensiveLoading } from '@/hooks/use-comprehensive-loading';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { TRADING_ALERT_PRODUCTS } from '@/lib/product-config';

interface SubscriptionProtectedLinkProps {
  href: string;
  children: React.ReactNode;
  allowedProductIds?: string[];
  className?: string;
  variant?:
    | 'default'
    | 'destructive'
    | 'outline'
    | 'secondary'
    | 'ghost'
    | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  onClick?: (e: React.MouseEvent) => void;
  disabled?: boolean;
}

export const SubscriptionProtectedLink = forwardRef<
  HTMLButtonElement,
  SubscriptionProtectedLinkProps
>(
  (
    {
      href,
      children,
      allowedProductIds = [...TRADING_ALERT_PRODUCTS], // ✅ UPDATED: Use client-safe config as default, convert readonly to mutable
      className,
      variant = 'default',
      size = 'default',
      onClick,
      disabled,
    },
    ref
  ) => {
    const { user } = useUser();
    const { navigate } = useNavigationLoading();
    const loading = useComprehensiveLoading('api');

    const handleClick = async (e: React.MouseEvent) => {
      e.preventDefault();

      if (onClick) {
        onClick(e);
      }

      if (disabled || loading.isLoading) {
        return;
      }

      if (!user) {
        await navigate('/sign-in', {
          message: 'Please sign in to continue...',
        });
        return;
      }

      // Use comprehensive loading wrapper
      try {
        const result = await loading.withLoading(
          async () => {
            const response = await fetch('/api/check-product-subscription', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                allowedProductIds,
              }),
            });

            if (response.status === 429) {
              throw new Error(
                'Rate limited. Please wait a moment before trying again.'
              );
            }

            return response.json();
          },
          {
            loadingMessage: 'Checking subscription access...',
            errorMessage: 'Failed to verify subscription',
          }
        );

        console.log('result', result);

        if (result.hasAccess) {
          await navigate(href, {
            message: `Opening ${href}...`,
          });
        } else {
          await navigate('/pricing', {
            message: 'Redirecting to pricing...',
          });
        }
      } catch (error) {
        console.error('❌ Error checking subscription:', error);
        if (error instanceof Error && error.message.includes('Rate limited')) {
          alert(error.message);
        } else {
          // On error, redirect to pricing to be safe
          await navigate('/pricing', {
            message: 'Redirecting to pricing...',
          });
        }
      }
    };

    return (
      <Button
        onClick={handleClick}
        className={className}
        variant={variant}
        size={size}
        disabled={disabled || loading.isLoading}
        ref={ref}
      >
        {loading.isLoading ? (
          <div className='flex items-center gap-2'>
            <Loader2 className='w-4 h-4 animate-spin' />
            <span>{loading.message || 'Loading...'}</span>
          </div>
        ) : (
          children
        )}
      </Button>
    );
  }
);

SubscriptionProtectedLink.displayName = 'SubscriptionProtectedLink';
