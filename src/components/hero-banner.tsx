'use client';

import { CountdownTimer } from '@/components/countdown-timer';

interface HeroBannerProps {
  className?: string;
}

export function HeroBanner({ className = '' }: HeroBannerProps) {
  return (
    <div
      className={`w-full bg-gradient-to-r from-red-600/90 via-orange-500/80 to-red-700/90 backdrop-blur-sm border-b border-red-400/30 relative overflow-hidden ${className}`}
    >
      {/* Background Animation Effects */}
      <div className='absolute inset-0 overflow-hidden'>
        <div className='absolute -top-10 -right-10 w-32 h-32 bg-yellow-500/10 rounded-full blur-2xl animate-pulse'></div>
        <div className='absolute -bottom-10 -left-10 w-40 h-40 bg-orange-500/10 rounded-full blur-2xl animate-pulse delay-1000'></div>
      </div>

      <div className='max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 relative z-10'>
        <div className='flex flex-col md:flex-row items-center justify-center gap-4 md:gap-6 text-center'>
          {/* Enhanced urgency message */}
          <div className='flex flex-col md:flex-row items-center gap-3 md:gap-4'>
            <div className='flex items-center gap-3 bg-red-800/40 rounded-full px-4 py-2 border border-red-300/30 backdrop-blur-sm'>
              <div className='w-2 h-2 bg-red-200 rounded-full animate-pulse shadow-lg shadow-red-200/50'></div>
              <span className='text-red-100 font-bold text-xs sm:text-sm uppercase tracking-wider'>
                🔥 Limited Time Offer
              </span>
            </div>
            <div className='text-center'>
              <p className='text-white font-bold text-base sm:text-lg md:text-xl mb-1 bg-gradient-to-r from-white to-gray-100 bg-clip-text text-transparent'>
                Lock in current pricing before increase
              </p>
              <p className='text-red-100 text-xs sm:text-sm font-medium opacity-90'>
                ⚡ Next price increase:{' '}
                <span className='font-bold text-yellow-200'>$199/month</span>
              </p>
            </div>
          </div>

          {/* Enhanced countdown timer */}
          <div className='bg-gradient-to-r from-red-800/50 to-orange-800/50 rounded-xl px-3 sm:px-4 py-2 sm:py-3 border border-red-300/30 backdrop-blur-sm shadow-lg'>
            <CountdownTimer />
          </div>
        </div>
      </div>
    </div>
  );
}
