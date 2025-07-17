import { SignedIn, SignedOut } from '@clerk/nextjs';
import { SharedNavbar } from '@/components/shared-navbar';
import { HeroBanner } from '@/components/hero-banner';
import { ComprehensivePricingSection } from '@/components/comprehensive-pricing-section';
import { Users, TrendingUp, Shield } from 'lucide-react';

export default function PricingPage() {
  return (
    <div className='min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-black text-white relative overflow-hidden pwa-layout safe-min-height'>
      {/* Animated Background Effects */}
      <div className='absolute inset-0 overflow-hidden'>
        <div className='absolute -top-40 -right-40 w-80 h-80 bg-blue-500/8 rounded-full blur-3xl animate-pulse'></div>
        <div className='absolute top-60 -left-40 w-96 h-96 bg-purple-500/6 rounded-full blur-3xl animate-pulse delay-1000'></div>
        <div className='absolute bottom-40 right-20 w-64 h-64 bg-yellow-500/8 rounded-full blur-3xl animate-pulse delay-2000'></div>
        <div className='absolute top-20 left-1/2 w-72 h-72 bg-green-500/5 rounded-full blur-3xl animate-pulse delay-3000'></div>
        <div className='absolute bottom-20 left-1/4 w-56 h-56 bg-pink-500/6 rounded-full blur-3xl animate-pulse delay-4000'></div>
      </div>

      <div className='relative z-10 pwa-safe-top pwa-safe-bottom safe-area-inset-left safe-area-inset-right'>
        {/* Hero Banner */}
        <HeroBanner />

        {/* Shared Navigation */}
        <SharedNavbar currentPage='pricing' />

        {/* Enhanced Main Content - Mobile-Optimized with PWA Support */}
        <main className='flex flex-col items-center justify-center min-h-[calc(100vh-200px)] px-4 sm:px-6 py-8 sm:py-16 pwa-safe-bottom safe-area-inset-bottom'>
          {/* Hero Section - Mobile-First */}
          <div className='text-center max-w-6xl mx-auto mb-8 sm:mb-16'>
            <div className='flex items-center justify-center mb-4 sm:mb-6'>
              <div className='w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-2xl'>
                <TrendingUp className='w-6 h-6 sm:w-8 sm:h-8 text-white' />
              </div>
            </div>

            <h1 className='text-2xl xs:text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold mb-6 sm:mb-8 leading-tight px-2'>
              Join{' '}
              <span className='bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent'>
                Traders Utopia
              </span>
            </h1>

            <p className='text-base sm:text-lg md:text-xl lg:text-2xl text-gray-300 mb-6 sm:mb-8 max-w-4xl mx-auto leading-relaxed px-4'>
              Shehroze Trade Alerts and Education - Professional Trading
              Community
            </p>

            <div className='flex flex-wrap items-center justify-center gap-4 sm:gap-6 lg:gap-8 text-gray-400 text-xs sm:text-sm px-4'>
              <div className='flex items-center gap-1 sm:gap-2'>
                <Users className='w-3 h-3 sm:w-4 sm:h-4' />
                <span>1000+ Active Traders</span>
              </div>
              <div className='flex items-center gap-1 sm:gap-2'>
                <Shield className='w-3 h-3 sm:w-4 sm:h-4' />
                <span>Proven Track Record</span>
              </div>
              <div className='flex items-center gap-1 sm:gap-2'>
                <TrendingUp className='w-3 h-3 sm:w-4 sm:h-4' />
                <span>Real-Time Alerts</span>
              </div>
            </div>
          </div>

          {/* Comprehensive Pricing Section with Subscription Detection */}
          <SignedIn>
            <ComprehensivePricingSection isSignedIn={true} />
          </SignedIn>
          <SignedOut>
            <ComprehensivePricingSection isSignedIn={false} />
          </SignedOut>
        </main>
      </div>
    </div>
  );
}
