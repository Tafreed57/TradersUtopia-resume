'use client';

import { Button } from '@/components/ui/button';
import { ModeToggle } from '@/components/mode-toggler';
import Link from 'next/link';
import NextImage from 'next/image';
import { SignedIn, SignedOut, UserButton } from '@clerk/nextjs';
import { AuthHeader } from '@/components/auth-header';
import { SubscriptionProtectedLink } from '@/components/subscription-protected-link';
import { GlobalMobileMenu } from '@/components/global-mobile-menu';
import { Home, Crown, Play, DollarSign } from 'lucide-react';

interface SharedNavbarProps {
  currentPage?: 'home' | 'free-videos' | 'pricing' | 'dashboard';
}

export function SharedNavbar({ currentPage }: SharedNavbarProps) {
  return (
    <div className='w-full px-4 sm:px-6 pt-4 sm:pt-6'>
      <header className='flex items-center justify-between p-4 sm:p-6 max-w-7xl mx-auto bg-gradient-to-r from-gray-800/60 via-gray-800/40 to-gray-900/60 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-gray-700/30 shadow-2xl min-h-[72px]'>
        {/* Left Side - Logo and Auth */}
        <div className='flex items-center gap-3 sm:gap-6 h-full'>
          {/* Enhanced Logo */}
          <div className='flex items-center gap-2 sm:gap-4 h-full'>
            <div className='w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-lg sm:rounded-xl flex items-center justify-center shadow-lg flex-shrink-0'>
              <NextImage
                src='/logo.png'
                alt='TradersUtopia'
                width={24}
                height={24}
                className='sm:w-7 sm:h-7'
              />
            </div>
            <div className='hidden sm:flex sm:flex-col sm:justify-center'>
              <span className='text-white text-lg sm:text-xl font-bold leading-tight'>
                TradersUtopia
              </span>
              <p className='text-gray-400 text-xs sm:text-sm leading-tight'>
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
        <nav className='hidden md:flex items-center gap-2 sm:gap-3 h-full'>
          <Link href='/'>
            <Button
              variant='ghost'
              className={`h-10 px-3 sm:px-4 text-white hover:bg-white/10 bg-gray-700/30 backdrop-blur-sm border border-gray-600/30 transition-all duration-200 ${
                currentPage === 'home'
                  ? 'border-yellow-400/50 text-yellow-400 bg-yellow-400/10'
                  : ''
              }`}
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
        </nav>

        {/* Right Side Actions */}
        <div className='flex items-center gap-2 sm:gap-4 h-full'>
          {/* Mobile Auth */}
          <SignedIn>
            <div className='md:hidden flex items-center'>
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: 'w-10 h-10',
                  },
                }}
              />
            </div>
          </SignedIn>

          {/* Mobile Menu */}
          <div className='md:hidden flex items-center'>
            <GlobalMobileMenu />
          </div>

          {/* Desktop Mode Toggle */}
          <div className='hidden sm:flex sm:items-center sm:h-full'>
            <ModeToggle />
          </div>
        </div>
      </header>
    </div>
  );
}
