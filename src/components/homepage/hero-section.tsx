'use client';

import { SmartEntryButton } from '@/components/smart-entry-button';
import { Check, Shield, Lock, Award } from 'lucide-react';

export function HeroSection() {
  return (
    <>
      {/* Trust Bar - Mobile-Optimized */}
      <div className='bg-gradient-to-r from-yellow-600/20 via-yellow-500/25 to-yellow-400/20 border-b border-yellow-400/30 backdrop-blur-sm'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 py-2 sm:py-3'>
          <div className='flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-xs sm:text-sm text-yellow-100'>
            <div className='flex items-center gap-1 sm:gap-2'>
              <Shield className='w-3 h-3 sm:w-4 sm:h-4' />
              <span className='whitespace-nowrap'>SEC Compliant</span>
            </div>
            <div className='flex items-center gap-1 sm:gap-2'>
              <Lock className='w-3 h-3 sm:w-4 sm:h-4' />
              <span className='whitespace-nowrap'>Bank-Level Security</span>
            </div>
            <div className='flex items-center gap-1 sm:gap-2'>
              <Award className='w-3 h-3 sm:w-4 sm:h-4' />
              <span className='whitespace-nowrap'>Secure Platform</span>
            </div>
          </div>
        </div>
      </div>

      {/* Hero Section - Mobile-Optimized */}
      <section
        id='hero'
        className='max-w-7xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-12 sm:pb-16'
      >
        <div className='text-center mb-16'>
          {/* Social Proof Badge - Mobile-Optimized */}
          <div className='inline-flex items-center gap-2 bg-green-600/20 border border-green-400/30 rounded-full px-3 sm:px-4 py-2 mb-6 touch-manipulation'>
            <div className='flex -space-x-1 sm:-space-x-2'>
              <div className='w-5 h-5 sm:w-6 sm:h-6 bg-blue-500 rounded-full border-2 border-white'></div>
              <div className='w-5 h-5 sm:w-6 sm:h-6 bg-red-500 rounded-full border-2 border-white'></div>
              <div className='w-5 h-5 sm:w-6 sm:h-6 bg-purple-500 rounded-full border-2 border-white'></div>
            </div>
            <span className='text-green-400 text-xs sm:text-sm font-medium'>
              Trusted by 1,047+ professional traders
            </span>
          </div>

          {/* Main Headline - Mobile-First */}
          <h1 className='text-3xl sm:text-4xl md:text-6xl lg:text-7xl xl:text-8xl font-bold mb-6 leading-[0.9] tracking-tight px-4 sm:px-0'>
            <span className='bg-gradient-to-r from-white via-yellow-100 to-yellow-300 bg-clip-text text-transparent animate-gradient'>
              More Than Alerts.
            </span>
            <br />
            <span className='bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 bg-clip-text text-transparent animate-gradient'>
              More Than Education.
            </span>
          </h1>

          {/* Subheadline */}
          <p className='text-lg sm:text-xl md:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto leading-relaxed px-4 sm:px-0'>
            Join the most accurate trade alert service in the world - with real
            results, verified track record, and expert coaching.
          </p>

          {/* Stats Row - Mobile-First Grid */}
          <div className='grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-12 max-w-4xl mx-auto'>
            <div className='flex flex-col items-center bg-gradient-to-b from-yellow-500/10 to-yellow-600/5 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-yellow-400/20 hover:border-yellow-400/40 transition-all duration-300 hover:transform hover:-translate-y-1 touch-manipulation'>
              <div className='text-2xl sm:text-3xl font-bold text-yellow-400'>
                78%
              </div>
              <div className='text-xs sm:text-sm text-gray-300 text-center'>
                Win Rate
              </div>
            </div>
            <div className='flex flex-col items-center bg-gradient-to-b from-green-500/10 to-green-600/5 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-green-400/20 hover:border-green-400/40 transition-all duration-300 hover:transform hover:-translate-y-1 touch-manipulation'>
              <div className='text-2xl sm:text-3xl font-bold text-green-400'>
                $250K+
              </div>
              <div className='text-xs sm:text-sm text-gray-300 text-center'>
                Member Profits
              </div>
            </div>
            <div className='flex flex-col items-center bg-gradient-to-b from-blue-500/10 to-blue-600/5 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-blue-400/20 hover:border-blue-400/40 transition-all duration-300 hover:transform hover:-translate-y-1 touch-manipulation'>
              <div className='text-2xl sm:text-3xl font-bold text-blue-400'>
                1,047
              </div>
              <div className='text-xs sm:text-sm text-gray-300 text-center'>
                Active Members
              </div>
            </div>
            <div className='flex flex-col items-center bg-gradient-to-b from-purple-500/10 to-purple-600/5 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-purple-400/20 hover:border-purple-400/40 transition-all duration-300 hover:transform hover:-translate-y-1 touch-manipulation'>
              <div className='text-2xl sm:text-3xl font-bold text-purple-400'>
                2 Years
              </div>
              <div className='text-xs sm:text-sm text-gray-300 text-center'>
                Track Record
              </div>
            </div>
          </div>

          {/* CTA Section */}
          <div className='flex flex-col items-center gap-4 mb-8'>
            <SmartEntryButton />
            <div className='flex items-center gap-2 text-green-400 text-sm'>
              <Check className='w-4 h-4' />
              <span>Premium access • Instant setup</span>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
