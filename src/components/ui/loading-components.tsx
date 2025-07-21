'use client';

import { TrendingUp, Zap } from 'lucide-react';

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
