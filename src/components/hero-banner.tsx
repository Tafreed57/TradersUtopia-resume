'use client';

import { CountdownTimer } from '@/components/countdown-timer';

interface HeroBannerProps {
  className?: string;
}

export function HeroBanner({ className = '' }: HeroBannerProps) {
  return (
    <div
      className={`w-full bg-gradient-to-r from-red-600/80 via-orange-600/70 to-red-700/80 backdrop-blur-sm border-b border-red-400/30 ${className}`}
    >
      <div className='max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6'>
        <div className='flex flex-col md:flex-row items-center justify-between gap-4 md:gap-6'>
          {/* Left side - Urgency message */}
          <div className='flex flex-col md:flex-row items-center gap-3 md:gap-4'>
            <div className='flex items-center gap-2'>
              <div className='w-3 h-3 bg-red-200 rounded-full animate-pulse shadow-lg shadow-red-200/50'></div>
              <span className='text-red-100 font-bold text-sm sm:text-base uppercase tracking-wider'>
                Limited Time Offer
              </span>
            </div>
            <div className='text-center md:text-left'>
              <p className='text-white font-bold text-lg sm:text-xl mb-1'>
                Lock in current pricing before increase
              </p>
              <p className='text-red-100 text-sm font-medium'>
                Next price increase: $199/month
              </p>
            </div>
          </div>

          {/* Right side - Countdown timer */}
          <div className='flex-shrink-0'>
            <CountdownTimer initialMinutes={47} initialSeconds={26} />
          </div>
        </div>
      </div>
    </div>
  );
}
