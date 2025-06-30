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

      <div className='container-mobile py-2 sm:py-3 relative z-10'>
        <div className='flex flex-col md:flex-row items-center justify-center gap-2 sm:gap-4 text-center'>
          {/* Enhanced Offer Text */}
          <div className='flex flex-col sm:flex-row items-center gap-2 sm:gap-3'>
            <div className='flex items-center gap-2 bg-red-800/40 rounded-full px-3 py-1 sm:px-4 sm:py-1.5 border border-red-300/30 backdrop-blur-sm'>
              <div className='w-1.5 h-1.5 sm:w-2 sm:h-2 bg-red-200 rounded-full animate-pulse shadow-lg shadow-red-200/50'></div>
              <span className='text-red-100 font-bold text-xs uppercase tracking-wider'>
                🔥 LIMITED TIME OFFER
              </span>
            </div>
            <span className='text-white font-bold text-xs sm:text-sm md:text-base bg-gradient-to-r from-white to-gray-100 bg-clip-text text-transparent'>
              Lock in current pricing before increase
            </span>
          </div>

          {/* Enhanced Countdown Timer */}
          <div className='bg-gradient-to-r from-red-800/50 to-orange-800/50 rounded-lg px-3 sm:px-4 py-2 sm:py-2.5 border border-red-300/30 backdrop-blur-sm shadow-lg'>
            <CountdownTimer initialMinutes={47} initialSeconds={33} />
          </div>

          {/* Enhanced Price Info */}
          <div className='text-red-100 text-xs sm:text-sm font-medium bg-red-800/40 rounded-full px-3 py-1 sm:px-4 sm:py-1.5 border border-red-300/30 backdrop-blur-sm'>
            <span className='hidden sm:inline'>⚡ Next price increase: </span>
            <span className='sm:hidden'>⚡ Next: </span>
            <span className='font-bold text-yellow-200'>$199/month</span>
          </div>
        </div>
      </div>
    </div>
  );
}
