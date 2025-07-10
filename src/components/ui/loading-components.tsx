'use client';

import { Loader2, TrendingUp, Upload, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

// Button Loading Component
interface ButtonLoadingProps {
  isLoading: boolean;
  children: React.ReactNode;
  loadingText?: string;
  className?: string;
  disabled?: boolean;
}

export function ButtonLoading({
  isLoading,
  children,
  loadingText = 'Loading...',
  className,
}: ButtonLoadingProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {isLoading && <Loader2 className='w-4 h-4 animate-spin' />}
      <span>{isLoading ? loadingText : children}</span>
    </div>
  );
}

// Component Loading Overlay
interface ComponentLoadingProps {
  isLoading: boolean;
  children: React.ReactNode;
  message?: string;
  progress?: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function ComponentLoading({
  isLoading,
  children,
  message = 'Loading...',
  progress,
  className = '',
  size = 'md',
}: ComponentLoadingProps) {
  const sizeClasses = {
    sm: 'min-h-[100px]',
    md: 'min-h-[200px]',
    lg: 'min-h-[300px]',
  };

  const spinnerSizes = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  if (!isLoading) return <>{children}</>;

  return (
    <div className={cn('relative', className)}>
      {/* Backdrop */}
      <div className='absolute inset-0 bg-gray-900/50 backdrop-blur-sm rounded-lg z-10' />

      {/* Loading Content */}
      <div
        className={cn(
          'absolute inset-0 flex flex-col items-center justify-center z-20 text-white',
          sizeClasses[size]
        )}
      >
        <div className='text-center space-y-4'>
          <div className='relative'>
            {/* Outer ring */}
            <div
              className={cn(
                'border-4 border-gray-600 rounded-full',
                spinnerSizes[size]
              )}
            />
            {/* Spinning ring */}
            <div
              className={cn(
                'absolute inset-0 border-4 border-yellow-400 rounded-full border-t-transparent animate-spin',
                spinnerSizes[size]
              )}
            />
          </div>

          <div className='space-y-2'>
            <p className='text-sm font-medium'>{message}</p>

            {progress !== undefined && (
              <div className='w-32 bg-gray-700 rounded-full h-2'>
                <div
                  className='h-2 bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-full transition-all duration-300'
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Original content (blurred) */}
      <div className='filter blur-sm opacity-50'>{children}</div>
    </div>
  );
}

// Inline Loading Component
interface InlineLoadingProps {
  isLoading: boolean;
  message?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'spinner' | 'dots' | 'pulse';
}

export function InlineLoading({
  isLoading,
  message = 'Loading...',
  size = 'md',
  variant = 'spinner',
}: InlineLoadingProps) {
  if (!isLoading) return null;

  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  const spinnerSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const renderVariant = () => {
    switch (variant) {
      case 'spinner':
        return (
          <Loader2
            className={cn('animate-spin text-yellow-400', spinnerSizes[size])}
          />
        );

      case 'dots':
        return (
          <div className='flex space-x-1'>
            <div className='w-2 h-2 bg-yellow-400 rounded-full animate-bounce' />
            <div className='w-2 h-2 bg-yellow-400 rounded-full animate-bounce delay-100' />
            <div className='w-2 h-2 bg-yellow-400 rounded-full animate-bounce delay-200' />
          </div>
        );

      case 'pulse':
        return (
          <div
            className={cn(
              'bg-yellow-400 rounded-full animate-pulse',
              spinnerSizes[size]
            )}
          />
        );

      default:
        return (
          <Loader2
            className={cn('animate-spin text-yellow-400', spinnerSizes[size])}
          />
        );
    }
  };

  return (
    <div className='flex items-center gap-2 text-gray-300'>
      {renderVariant()}
      <span className={sizeClasses[size]}>{message}</span>
    </div>
  );
}

// API Loading Component
interface ApiLoadingProps {
  isLoading: boolean;
  error?: string | null;
  retry?: () => void;
  message?: string;
}

export function ApiLoading({
  isLoading,
  error,
  retry,
  message = 'Loading data...',
}: ApiLoadingProps) {
  if (error) {
    return (
      <div className='flex flex-col items-center gap-4 p-6 text-center'>
        <div className='w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center'>
          <Zap className='w-6 h-6 text-red-400' />
        </div>
        <div className='space-y-2'>
          <h3 className='text-lg font-semibold text-white'>Failed to load</h3>
          <p className='text-gray-400 text-sm'>{error}</p>
        </div>
        {retry && (
          <button
            onClick={retry}
            className='px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-black rounded-lg font-medium transition-colors'
          >
            Try Again
          </button>
        )}
      </div>
    );
  }

  if (!isLoading) return null;

  return (
    <div className='flex flex-col items-center gap-4 p-6'>
      <div className='relative w-16 h-16'>
        <div className='absolute inset-0 border-4 border-gray-600 rounded-full' />
        <div className='absolute inset-0 border-4 border-yellow-400 rounded-full border-t-transparent animate-spin' />
        <div className='absolute inset-3 bg-yellow-400/20 rounded-full animate-pulse flex items-center justify-center'>
          <TrendingUp className='w-6 h-6 text-yellow-400' />
        </div>
      </div>
      <p className='text-gray-300 text-sm font-medium'>{message}</p>
    </div>
  );
}

// Upload Loading Component
interface UploadLoadingProps {
  isLoading: boolean;
  progress?: number;
  fileName?: string;
  message?: string;
}

export function UploadLoading({
  isLoading,
  progress = 0,
  fileName,
  message = 'Uploading...',
}: UploadLoadingProps) {
  if (!isLoading) return null;

  return (
    <div className='flex items-center gap-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700'>
      <div className='flex-shrink-0'>
        <div className='relative w-10 h-10'>
          <div className='absolute inset-0 border-2 border-gray-600 rounded-full' />
          <div
            className='absolute inset-0 border-2 border-yellow-400 rounded-full transition-all duration-300'
            style={{
              background: `conic-gradient(from 0deg, #facc15 ${progress * 3.6}deg, transparent ${progress * 3.6}deg)`,
            }}
          />
          <div className='absolute inset-2 bg-gray-800 rounded-full flex items-center justify-center'>
            <Upload className='w-4 h-4 text-yellow-400' />
          </div>
        </div>
      </div>

      <div className='flex-1 min-w-0'>
        <div className='flex items-center justify-between mb-1'>
          <p className='text-sm font-medium text-white truncate'>
            {fileName || message}
          </p>
          <span className='text-xs text-gray-400'>{Math.round(progress)}%</span>
        </div>

        <div className='w-full bg-gray-700 rounded-full h-1.5'>
          <div
            className='h-1.5 bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-full transition-all duration-300'
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// Navigation Loading Component
interface NavigationLoadingProps {
  isLoading: boolean;
  message?: string;
}

export function NavigationLoading({
  isLoading,
  message = 'Navigating...',
}: NavigationLoadingProps) {
  if (!isLoading) return null;

  return (
    <div className='fixed top-0 left-0 right-0 z-50 bg-yellow-400 h-1 pwa-safe-top'>
      <div
        className='h-full bg-yellow-600 animate-pulse'
        style={{
          animation: 'loading-bar 2s ease-in-out infinite',
        }}
      />

      <style jsx>{`
        @keyframes loading-bar {
          0% {
            width: 0%;
          }
          50% {
            width: 70%;
          }
          100% {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}

// Skeleton Loading Component
interface SkeletonLoadingProps {
  lines?: number;
  className?: string;
}

export function SkeletonLoading({
  lines = 3,
  className,
}: SkeletonLoadingProps) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className='h-4 bg-gray-700 rounded animate-pulse'
          style={{ width: `${Math.random() * 40 + 60}%` }}
        />
      ))}
    </div>
  );
}
