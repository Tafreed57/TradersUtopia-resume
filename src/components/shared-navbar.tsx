'use client';

import { Button } from '@/components/ui/button';

import Link from 'next/link';
import NextImage from 'next/image';
import { SignedIn, UserButton, useUser, SignedOut } from '@clerk/nextjs';
import { AuthHeader } from '@/components/auth-header';
import { SubscriptionProtectedLink } from '@/components/subscription-protected-link';
import { GlobalMobileMenu } from '@/components/global-mobile-menu';
import { useScrollPosition } from '@/hooks/use-scroll-position';
import { useEffect, useState } from 'react';
import {
  Home,
  Crown,
  Play,
  DollarSign,
  Target,
  Video,
  TrendingUp,
  MessageSquare,
  Loader2,
} from 'lucide-react';

interface SharedNavbarProps {
  currentPage?:
    | 'home'
    | 'free-videos'
    | 'pricing'
    | 'dashboard'
    | 'track-record';
}

export function SharedNavbar({ currentPage }: SharedNavbarProps) {
  const { isLoaded } = useUser();
  const [isMounted, setIsMounted] = useState(false);
  const { isScrolled } = useScrollPosition();
  const [isNavigatingToDashboard, setIsNavigatingToDashboard] = useState(false);

  // ✅ FIX: Prevent hydration mismatch by waiting for client-side mount
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // ✅ FIX: Use simple local loading state to avoid hydration errors
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);

  return (
    <>
      {/* Spacer div to prevent layout shift when navbar becomes fixed */}
      {isScrolled && (
        <div className='h-[88px] sm:h-[96px]' aria-hidden='true' />
      )}

      <div
        className={`w-full transition-all duration-300 ease-in-out ${
          isScrolled
            ? 'fixed top-0 left-0 right-0 z-50 px-4 sm:px-6 py-2 safe-top pt-6 md:pt-2'
            : 'px-4 sm:px-6 pt-4 sm:pt-6'
        }`}
      >
        <header
          className={`flex items-center p-3 sm:p-4 lg:p-6 max-w-7xl mx-auto backdrop-blur-xl border min-h-[72px] transition-all duration-300 ease-in-out touch-manipulation ${
            isScrolled
              ? 'bg-gray-900/95 border-gray-600/50 rounded-lg sm:rounded-xl shadow-2xl shadow-black/50 transform scale-[0.98] min-h-[4rem] md:min-h-[72px]'
              : 'bg-gradient-to-r from-gray-800/60 via-gray-800/40 to-gray-900/60 border-gray-700/30 rounded-xl sm:rounded-2xl shadow-2xl transform scale-100'
          }`}
        >
          {/* Left Side - Logo and Auth */}
          <div className='flex items-center gap-2 sm:gap-4 h-full min-w-0'>
            {/* Enhanced Logo */}
            <div className='flex items-center gap-2 sm:gap-3 h-full'>
              <div className='w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg flex-shrink-0'>
                <NextImage
                  src='/logo.png'
                  alt='TradersUtopia'
                  width={20}
                  height={20}
                  className='sm:w-6 sm:h-6 lg:w-7 lg:h-7'
                />
              </div>
              <div className='flex flex-col justify-center min-w-0'>
                <div className='flex items-center gap-2 sm:gap-3'>
                  <span className='text-white text-xs sm:text-sm lg:text-xl font-bold leading-tight whitespace-nowrap'>
                    TradersUtopia
                  </span>
                  {isMounted && isLoaded && (
                    <SignedIn>
                      <span className='text-blue-400 text-xs font-medium whitespace-nowrap'>
                        Welcome back!
                      </span>
                    </SignedIn>
                  )}
                </div>
                <p className='text-gray-400 text-xs leading-tight whitespace-nowrap'>
                  Premium Trading Signals
                </p>
              </div>
            </div>

            {/* Authentication Section */}
            <div className='hidden lg:flex lg:items-center lg:h-full'>
              <AuthHeader />
            </div>
          </div>

          {/* Center Navigation Links */}
          <nav className='hidden md:flex items-center gap-2 sm:gap-3 h-full flex-1 justify-center'>
            {currentPage === 'home' ? (
              // Homepage Section Anchor Links
              <>
                <SubscriptionProtectedLink
                  href='/dashboard'
                  variant='ghost'
                  className={`h-10 px-3 sm:px-4 text-white hover:bg-white/10 bg-gray-700/30 backdrop-blur-sm border border-gray-600/30 transition-all duration-200 hover:border-yellow-400/30 hover:scale-105 active:scale-95 ${
                    isNavigatingToDashboard
                      ? 'border-yellow-400/50 bg-yellow-400/10 opacity-75'
                      : ''
                  }`}
                  onClick={() => {
                    setIsNavigatingToDashboard(true);
                    setIsLoadingDashboard(true);
                    // Reset after a delay in case navigation fails
                    setTimeout(() => {
                      setIsNavigatingToDashboard(false);
                      setIsLoadingDashboard(false);
                    }, 5000);
                  }}
                >
                  {isNavigatingToDashboard ? (
                    <Loader2 className='w-4 h-4 mr-2 animate-spin' />
                  ) : (
                    <Crown className='w-4 h-4 mr-2' />
                  )}
                  <span className='hidden lg:inline'>
                    {isNavigatingToDashboard ? 'Loading...' : 'Dashboard'}
                  </span>
                  <span className='lg:hidden'>
                    {isNavigatingToDashboard ? 'Loading...' : 'App'}
                  </span>
                </SubscriptionProtectedLink>

                <a href='#features'>
                  <Button
                    variant='ghost'
                    className='h-10 px-3 sm:px-4 text-white hover:bg-white/10 bg-gray-700/30 backdrop-blur-sm border border-gray-600/30 transition-all duration-200 hover:border-yellow-400/30'
                  >
                    <Target className='w-4 h-4 mr-2' />
                    <span className='hidden lg:inline'>Features</span>
                  </Button>
                </a>

                <a href='#free-videos'>
                  <Button
                    variant='ghost'
                    className='h-10 px-3 sm:px-4 text-white hover:bg-white/10 bg-gray-700/30 backdrop-blur-sm border border-gray-600/30 transition-all duration-200 hover:border-yellow-400/30'
                  >
                    <Video className='w-4 h-4 mr-2' />
                    <span className='hidden lg:inline'>Free Videos</span>
                    <span className='lg:hidden'>Videos</span>
                  </Button>
                </a>

                <a href='#results'>
                  <Button
                    variant='ghost'
                    className='h-10 px-3 sm:px-4 text-white hover:bg-white/10 bg-gray-700/30 backdrop-blur-sm border border-gray-600/30 transition-all duration-200 hover:border-yellow-400/30'
                  >
                    <TrendingUp className='w-4 h-4 mr-2' />
                    <span className='hidden lg:inline'>Results</span>
                  </Button>
                </a>

                <a href='#testimonials'>
                  <Button
                    variant='ghost'
                    className='h-10 px-3 sm:px-4 text-white hover:bg-white/10 bg-gray-700/30 backdrop-blur-sm border border-gray-600/30 transition-all duration-200 hover:border-yellow-400/30'
                  >
                    <MessageSquare className='w-4 h-4 mr-2' />
                    <span className='hidden lg:inline'>Reviews</span>
                  </Button>
                </a>

                <a href='#pricing'>
                  <Button
                    variant='ghost'
                    className='h-10 px-3 sm:px-4 text-white hover:bg-white/10 bg-gray-700/30 backdrop-blur-sm border border-gray-600/30 transition-all duration-200 hover:border-yellow-400/30'
                  >
                    <DollarSign className='w-4 h-4 mr-2' />
                    <span className='hidden lg:inline'>Pricing</span>
                  </Button>
                </a>
              </>
            ) : (
              // Regular Page Links
              <>
                <Link href='/'>
                  <Button
                    variant='ghost'
                    className='h-10 px-3 sm:px-4 text-white hover:bg-white/10 bg-gray-700/30 backdrop-blur-sm border border-gray-600/30 transition-all duration-200'
                  >
                    <Home className='w-4 h-4 mr-2' />
                    <span className='hidden lg:inline'>Home</span>
                  </Button>
                </Link>

                <Link href='/free-videos'>
                  <Button
                    variant='ghost'
                    className={`h-10 px-3 sm:px-4 text-white hover:bg-white/10 bg-gray-700/30 backdrop-blur-sm border border-gray-600/30 transition-all duration-200 ${
                      currentPage === 'free-videos'
                        ? 'border-yellow-400/50 text-yellow-400 bg-yellow-400/10'
                        : ''
                    }`}
                  >
                    <Play className='w-4 h-4 mr-2' />
                    <span className='hidden lg:inline'>Free Videos</span>
                    <span className='lg:hidden'>Videos</span>
                  </Button>
                </Link>

                <Link href='/pricing'>
                  <Button
                    variant='ghost'
                    className={`h-10 px-3 sm:px-4 text-white hover:bg-white/10 bg-gray-700/30 backdrop-blur-sm border border-gray-600/30 transition-all duration-200 ${
                      currentPage === 'pricing'
                        ? 'border-yellow-400/50 text-yellow-400 bg-yellow-400/10'
                        : ''
                    }`}
                  >
                    <DollarSign className='w-4 h-4 mr-2' />
                    <span className='hidden lg:inline'>Pricing</span>
                  </Button>
                </Link>

                <SubscriptionProtectedLink
                  href='/dashboard'
                  variant='ghost'
                  className={`h-10 px-3 sm:px-4 text-white hover:bg-white/10 bg-gray-700/30 backdrop-blur-sm border border-gray-600/30 transition-all duration-200 ${
                    currentPage === 'dashboard'
                      ? 'border-yellow-400/50 text-yellow-400 bg-yellow-400/10'
                      : ''
                  }`}
                >
                  <Crown className='w-4 h-4 mr-2' />
                  <span className='hidden lg:inline'>Dashboard</span>
                  <span className='lg:hidden'>App</span>
                </SubscriptionProtectedLink>

                <Link href='/track-record'>
                  <Button
                    variant='ghost'
                    className={`h-10 px-3 sm:px-4 text-white hover:bg-white/10 bg-gray-700/30 backdrop-blur-sm border border-gray-600/30 transition-all duration-200 ${
                      currentPage === 'track-record'
                        ? 'border-yellow-400/50 text-yellow-400 bg-yellow-400/10'
                        : ''
                    }`}
                  >
                    <TrendingUp className='w-4 h-4 mr-2' />
                    <span className='hidden lg:inline'>Track Record</span>
                    <span className='lg:hidden'>Track</span>
                  </Button>
                </Link>
              </>
            )}
          </nav>

          {/* Spacer for mobile */}
          <div className='flex-1 md:hidden'></div>

          {/* Right Side Actions */}
          <div className='flex items-center gap-1 sm:gap-2 h-full flex-shrink-0'>
            {/* Mobile Auth - ✅ FIX: Add hydration protection */}
            {isMounted && isLoaded ? (
              <>
                <SignedIn>
                  <div className='md:hidden flex items-center mr-3'>
                    <UserButton
                      appearance={{
                        elements: {
                          avatarBox: 'w-8 h-8 sm:w-10 sm:h-10',
                        },
                      }}
                    />
                  </div>
                </SignedIn>

                {/* Sign In/Register buttons for signed out users on mobile */}
                <div className='md:hidden flex items-center gap-1.5 mr-3 ml-0.5'>
                  <SignedOut>
                    <Link href='/sign-in'>
                      <Button
                        variant='ghost'
                        size='sm'
                        className='text-white hover:bg-white/10 bg-gray-700/30 backdrop-blur-sm border border-gray-600/30 transition-all duration-200 text-xs px-2.5 py-1.5 h-8 min-w-[48px]'
                      >
                        Sign In
                      </Button>
                    </Link>
                    <Link href='/sign-up'>
                      <Button
                        size='sm'
                        className='bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-black font-semibold transition-all duration-200 text-xs px-2.5 py-1.5 h-8 min-w-[48px]'
                      >
                        Register
                      </Button>
                    </Link>
                  </SignedOut>
                </div>
              </>
            ) : (
              <div className='md:hidden flex items-center gap-1.5 mr-3 ml-0.5'>
                <div className='w-12 h-8 bg-white/10 rounded animate-pulse'></div>
                <div className='w-12 h-8 bg-white/10 rounded animate-pulse'></div>
              </div>
            )}

            {/* Mobile Menu */}
            <div className='md:hidden flex items-center'>
              <GlobalMobileMenu currentPage={currentPage} />
            </div>
          </div>
        </header>
      </div>
    </>
  );
}
