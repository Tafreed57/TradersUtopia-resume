'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { SubscriptionProtectedLink } from '@/components/subscription-protected-link';
import {
  Menu,
  Home,
  DollarSign,
  LayoutDashboard,
  Building2,
  Play,
  LogIn,
  Target,
  Video,
  TrendingUp,
  MessageSquare,
  Loader2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSmartRouting } from '@/lib/smart-routing';
import { SignedIn, SignedOut, UserButton, useUser } from '@clerk/nextjs';
import NextImage from 'next/image';

interface GlobalMobileMenuProps {
  currentPage?:
    | 'home'
    | 'free-videos'
    | 'pricing'
    | 'dashboard'
    | 'track-record';
}

export function GlobalMobileMenu({ currentPage }: GlobalMobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isNavProcessing, setIsNavProcessing] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isNavigatingToDashboard, setIsNavigatingToDashboard] = useState(false);
  const router = useRouter();
  const { isLoaded } = useUser();

  // ✅ FIX: Prevent hydration mismatch by waiting for client-side mount
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Smart routing for trial button
  const {
    handleSmartNavigation: handleNavSmartRouting,
    isLoaded: isSmartRoutingLoaded,
  } = useSmartRouting({
    loadingCallback: setIsNavProcessing,
    onError: error => {
      console.error('Mobile menu smart routing error:', error);
    },
  });

  const handleNavigation = async (
    path: string,
    isServerLink = false,
    isScrollLink = false
  ) => {
    setIsOpen(false);

    if (isServerLink) {
      // Smart server navigation - get user's first server
      try {
        const response = await fetch('/api/servers/ensure-default', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.server?.id) {
            router.push(`/servers/${data.server.id}`);
            return;
          }
        }
      } catch (error) {
        console.error('Error getting default server:', error);
      }

      // Fallback to dashboard if server navigation fails
      router.push('/dashboard');
    } else if (isScrollLink) {
      // Handle scroll links (like /#free-videos)
      if (path.startsWith('/#')) {
        const sectionId = path.substring(2); // Remove /#
        // If we're already on homepage, just scroll to section
        if (window.location.pathname === '/') {
          const element = document.getElementById(sectionId);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
            return;
          }
        }
        // Otherwise navigate to homepage first, then scroll
        router.push('/');
        setTimeout(() => {
          const element = document.getElementById(sectionId);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
          }
        }, 100);
      } else {
        router.push(path);
      }
    } else {
      router.push(path);
    }
  };

  const handleStartTrialClick = async () => {
    if (isNavProcessing) return;
    setIsOpen(false);
    await handleNavSmartRouting();
  };

  const navigationItems: Array<{
    id: string;
    icon: any;
    label: string;
    path: string;
    isServerLink?: boolean;
    isScrollLink?: boolean;
  }> =
    currentPage === 'home'
      ? [
          // Homepage Section Links
          {
            id: 'dashboard',
            icon: LayoutDashboard,
            label: 'Dashboard',
            path: '/dashboard',
          },
          {
            id: 'features',
            icon: Target,
            label: 'Features',
            path: '/#features',
            isScrollLink: true,
          },
          {
            id: 'free-videos',
            icon: Video,
            label: 'Free Videos',
            path: '/#free-videos',
            isScrollLink: true,
          },
          {
            id: 'results',
            icon: TrendingUp,
            label: 'Results',
            path: '/#results',
            isScrollLink: true,
          },
          {
            id: 'testimonials',
            icon: MessageSquare,
            label: 'Reviews',
            path: '/#testimonials',
            isScrollLink: true,
          },
          {
            id: 'pricing',
            icon: DollarSign,
            label: 'Pricing',
            path: '/#pricing',
            isScrollLink: true,
          },
        ]
      : [
          // Regular Page Links
          { id: 'home', icon: Home, label: 'Home', path: '/' },
          {
            id: 'free-videos',
            icon: Play,
            label: 'Free Videos',
            path: '/free-videos',
          },
          {
            id: 'pricing',
            icon: DollarSign,
            label: 'Pricing',
            path: '/pricing',
          },
          {
            id: 'dashboard',
            icon: LayoutDashboard,
            label: 'Dashboard',
            path: '/dashboard',
          },
          {
            id: 'servers',
            icon: Building2,
            label: 'Servers',
            path: '/dashboard',
            isServerLink: true,
          },
        ];

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild className='md:hidden'>
        <Button
          variant='ghost'
          size='icon'
          className='h-10 w-10 text-white hover:bg-white/10 bg-gray-700/30 backdrop-blur-sm border border-gray-600/30 transition-all duration-200
            min-h-[2.75rem] min-w-[2.75rem] h-11 w-11 md:h-10 md:w-10
            touch-manipulation'
        >
          <Menu className='h-5 w-5' />
        </Button>
      </SheetTrigger>
      <SheetContent
        side='right'
        className='w-[280px] bg-gradient-to-b from-gray-900 via-gray-900/95 to-black border-l border-gray-700/50 backdrop-blur-xl
          safe-top
          pt-8 md:pt-6'
      >
        <div className='flex flex-col h-full pt-6'>
          {/* Logo */}
          <div className='flex items-center gap-3 mb-8 pb-4 border-b border-gray-700/50'>
            <div
              className='w-8 h-8 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-lg flex items-center justify-center shadow-lg
              min-w-[2rem] min-h-[2rem]'
            >
              <NextImage
                src='/logo.png'
                alt='TradersUtopia'
                width={16}
                height={16}
              />
            </div>
            <span className='text-white text-lg font-bold'>TradersUtopia</span>
          </div>

          {/* Navigation Links */}
          <nav className='flex flex-col gap-2 mb-8 flex-1'>
            {navigationItems.map(item => {
              const Icon = item.icon;

              // Special handling for Dashboard button with comprehensive loading
              if (item.id === 'dashboard') {
                return (
                  <SubscriptionProtectedLink
                    key={item.id}
                    href='/dashboard'
                    variant='ghost'
                    className={`w-full justify-start text-white hover:bg-white/10 hover:text-yellow-400 transition-all duration-200 py-3 px-4 ${
                      isNavigatingToDashboard
                        ? 'bg-yellow-400/10 text-yellow-400 opacity-75'
                        : ''
                    }
                    min-h-[2.75rem] touch-manipulation`}
                    onClick={() => {
                      setIsNavigatingToDashboard(true);
                      setIsOpen(false); // Close mobile menu
                      // Reset after a delay in case navigation fails
                      setTimeout(() => {
                        setIsNavigatingToDashboard(false);
                      }, 5000);
                    }}
                  >
                    {isNavigatingToDashboard ? (
                      <Loader2 className='w-4 h-4 mr-3 animate-spin' />
                    ) : (
                      <Icon className='w-4 h-4 mr-3' />
                    )}
                    {isNavigatingToDashboard ? 'Loading...' : item.label}
                  </SubscriptionProtectedLink>
                );
              }

              // Regular button for all other items
              return (
                <Button
                  key={item.id}
                  variant='ghost'
                  className='w-full justify-start text-white hover:bg-white/10 hover:text-yellow-400 transition-all duration-200 py-3 px-4
                    min-h-[2.75rem] touch-manipulation'
                  onClick={() =>
                    handleNavigation(
                      item.path,
                      item.isServerLink || false,
                      item.isScrollLink || false
                    )
                  }
                >
                  <Icon className='w-4 h-4 mr-3' />
                  {item.label}
                </Button>
              );
            })}
          </nav>

          {/* Auth Section - ✅ FIX: Add hydration protection */}
          <div className='border-t border-gray-700/50 pt-6 space-y-3'>
            {isMounted && isLoaded ? (
              <>
                <SignedOut>
                  <Button
                    variant='ghost'
                    className='w-full justify-start text-white hover:bg-white/10 transition-all duration-200
                      min-h-[2.75rem] touch-manipulation py-3 px-4'
                    onClick={() => handleNavigation('/sign-in')}
                  >
                    <LogIn className='w-4 h-4 mr-3' />
                    Sign In
                  </Button>
                  <Button
                    onClick={handleStartTrialClick}
                    disabled={!isSmartRoutingLoaded || isNavProcessing}
                    className='w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-black font-semibold disabled:opacity-70 disabled:cursor-not-allowed transition-all duration-200 shadow-lg
                      min-h-[2.75rem] touch-manipulation py-3 px-4'
                  >
                    {isNavProcessing ? (
                      <div className='flex items-center gap-2'>
                        <div className='w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin'></div>
                        <span>Loading...</span>
                      </div>
                    ) : (
                      'Get Access Now'
                    )}
                  </Button>
                </SignedOut>

                <SignedIn>
                  <div
                    className='flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700/30
                    min-h-[2.75rem] touch-manipulation'
                  >
                    <UserButton
                      afterSignOutUrl='/'
                      appearance={{
                        elements: {
                          avatarBox: 'w-8 h-8 min-w-[2rem] min-h-[2rem]',
                        },
                      }}
                    />
                    <span className='text-gray-300 text-sm'>Signed in</span>
                  </div>
                </SignedIn>
              </>
            ) : (
              <div className='space-y-3'>
                <div className='w-full h-10 bg-white/10 rounded animate-pulse min-h-[2.75rem]'></div>
                <div className='w-full h-10 bg-white/10 rounded animate-pulse min-h-[2.75rem]'></div>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
