'use client';

import { useState, forwardRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { useNavigationLoading } from '@/hooks/use-navigation-loading';
import { useComprehensiveLoading } from '@/hooks/use-comprehensive-loading';
import { Button } from '@/components/ui/button';
import { ButtonLoading } from '@/components/ui/loading-components';
import { Loader2 } from 'lucide-react';

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
  HTMLDivElement,
  SubscriptionProtectedLinkProps
>(function SubscriptionProtectedLink(
  {
    href,
    children,
    allowedProductIds = ['prod_SWIyAf2tfVrJao'], // Default to your current product
    className,
    variant,
    size,
    onClick,
    disabled = false,
  },
  ref
) {
  const { user, isLoaded } = useUser();
  const { navigate } = useNavigationLoading();
  const loading = useComprehensiveLoading('api');
  const [isChecking, setIsChecking] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();

    // Execute any custom onClick first
    if (onClick) {
      onClick(e);
    }

    // If user is not authenticated, redirect to sign-in
    if (!isLoaded || !user) {
      await navigate('/sign-in', {
        message: 'Redirecting to sign in...',
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

  // If it's a Button component
  if (className?.includes('Button') || variant || size) {
    return (
      <Button
        onClick={handleClick}
        className={className}
        variant={variant}
        size={size}
        disabled={disabled || loading.isLoading}
        ref={ref as any}
      >
        <ButtonLoading
          isLoading={loading.isLoading}
          loadingText={loading.message}
        >
          {children}
        </ButtonLoading>
      </Button>
    );
  }

  // For other clickable elements
  return (
    <div
      ref={ref}
      onClick={handleClick}
      className={`cursor-pointer ${disabled || loading.isLoading ? 'pointer-events-none opacity-50' : ''} ${className || ''}`}
      role='button'
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleClick(e as any);
        }
      }}
    >
      <ButtonLoading
        isLoading={loading.isLoading}
        loadingText={loading.message}
      >
        {children}
      </ButtonLoading>
    </div>
  );
});
