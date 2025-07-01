'use client';

import { CountdownTimer } from './countdown-timer';

export function PricingHeroBanner() {
  return (
    <div className='bg-gradient-to-r from-red-600/90 via-orange-500/80 to-red-700/90 border-b border-red-400/30 backdrop-blur-sm relative overflow-hidden'>
      {/* Background Animation Effects */}
      <div className='absolute inset-0 overflow-hidden'>
        <div className='absolute -top-10 -right-10 w-32 h-32 bg-yellow-500/10 rounded-full blur-2xl animate-pulse'></div>
        <div className='absolute -bottom-10 -left-10 w-40 h-40 bg-orange-500/10 rounded-full blur-2xl animate-pulse delay-1000'></div>
      </div>

      <div className='container-mobile py-1 sm:py-2 relative z-10'>
        <div className='flex flex-col md:flex-row items-center justify-center gap-1 sm:gap-3 text-center'>
          {/* Left Side - Offer Text */}
          <div className='flex flex-col sm:flex-row items-center gap-1 sm:gap-2'>
            <div className='flex items-center gap-1 sm:gap-2'>
              <div className='w-1.5 h-1.5 sm:w-2 sm:h-2 bg-red-200 rounded-full animate-pulse shadow-lg shadow-red-200/50'></div>
              <span className='text-red-100 font-bold text-xs uppercase tracking-wider'>
                LIMITED TIME OFFER
              </span>
            </div>
            <span className='text-white font-bold text-xs sm:text-sm md:text-base'>
              Lock in current pricing before increase
            </span>
          </div>

          {/* Center - Countdown Timer */}
          <div className='flex items-center'>
            <div className='bg-gradient-to-r from-red-800/50 to-orange-800/50 rounded px-2 sm:px-3 py-1 sm:py-1.5 border border-red-300/30 backdrop-blur-sm'>
              <CountdownTimer initialMinutes={47} initialSeconds={33} />
            </div>
          </div>

          {/* Right Side - Price Info */}
          <div className='text-red-100 text-xs font-medium'>
            <span className='hidden sm:inline'>Next price increase: </span>
            <span className='sm:hidden'>Next: </span>
            <span className='font-bold text-white'>$199/month</span>
          </div>
        </div>
      </div>
    </div>
  );
}
