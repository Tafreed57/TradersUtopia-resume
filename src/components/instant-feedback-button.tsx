'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface InstantFeedbackButtonProps {
  children: React.ReactNode;
  onClick: () => Promise<void> | void;
  disabled?: boolean;
  className?: string;
  variant?:
    | 'default'
    | 'destructive'
    | 'outline'
    | 'secondary'
    | 'ghost'
    | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  loadingText?: string;
  successText?: string;
  errorText?: string;
  successDuration?: number;
  errorDuration?: number;
}

export function InstantFeedbackButton({
  children,
  onClick,
  disabled = false,
  className,
  variant = 'default',
  size = 'default',
  loadingText = 'Loading...',
  successText,
  errorText,
  successDuration = 2000,
  errorDuration = 3000,
}: InstantFeedbackButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');
  const [message, setMessage] = useState<string>('');

  const handleClick = async () => {
    // ✅ IMMEDIATE FEEDBACK: Set loading state immediately
    setIsLoading(true);
    setStatus('loading');
    setMessage(loadingText);

    try {
      await onClick();

      // Success state
      if (successText) {
        setStatus('success');
        setMessage(successText);
        setTimeout(() => {
          setStatus('idle');
          setMessage('');
        }, successDuration);
      } else {
        setStatus('idle');
        setMessage('');
      }
    } catch (error) {
      // Error state
      setStatus('error');
      setMessage(errorText || 'Something went wrong');
      setTimeout(() => {
        setStatus('idle');
        setMessage('');
      }, errorDuration);
    } finally {
      setIsLoading(false);
    }
  };

  const getButtonContent = () => {
    switch (status) {
      case 'loading':
        return (
          <>
            <Loader2 className='h-4 w-4 mr-2 animate-spin' />
            {loadingText}
          </>
        );
      case 'success':
        return successText || children;
      case 'error':
        return errorText || children;
      default:
        return children;
    }
  };

  const getButtonVariant = () => {
    switch (status) {
      case 'success':
        return 'default';
      case 'error':
        return 'destructive';
      default:
        return variant;
    }
  };

  return (
    <Button
      onClick={handleClick}
      disabled={disabled || isLoading}
      className={className}
      variant={getButtonVariant()}
      size={size}
    >
      {getButtonContent()}
    </Button>
  );
}
