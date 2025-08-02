'use client';

import { SignedIn, SignedOut, UserButton, useUser } from '@clerk/nextjs';
import { Button } from './ui/button';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export function AuthHeader() {
  const { isLoaded } = useUser();
  const [isMounted, setIsMounted] = useState(false);

  // ✅ FIX: Prevent hydration mismatch by waiting for client-side mount
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // ✅ FIX: Show loading state during hydration to prevent mismatch
  if (!isMounted || !isLoaded) {
    return (
      <div className='flex items-center gap-3 h-full'>
        <div className='h-10 w-20 bg-white/10 rounded animate-pulse'></div>
        <div className='h-10 w-10 bg-white/10 rounded-full animate-pulse'></div>
      </div>
    );
  }

  return (
    <div className='flex items-center gap-3 h-full'>
      <SignedOut>
        <Link href='/sign-in'>
          <Button
            variant='outline'
            className='h-10 bg-transparent border-white/20 text-white hover:bg-white/10 hover:border-white/30 transition-all duration-200'
          >
            Sign In
          </Button>
        </Link>
        <Link href='/sign-up'>
          <Button className='h-10 bg-indigo-600 hover:bg-indigo-700 text-white transition-all duration-200'>
            Register
          </Button>
        </Link>
      </SignedOut>
      <SignedIn>
        <div className='flex items-center gap-2 h-full'>
          <span className='text-white/80 text-sm'>Welcome back!</span>
          <UserButton
            appearance={{
              elements: {
                avatarBox:
                  'w-10 h-10 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-200',
                userButtonPopoverCard:
                  'bg-black-800 border border-gray-600 shadow-2xl',
                userButtonPopoverActionButton:
                  'text-black-300 hover:bg-gray-700 hover:text-white',
                userButtonPopoverActionButtonText: 'text-black-300',
                userButtonPopoverFooter: 'hidden',
              },
            }}
          />
        </div>
      </SignedIn>
    </div>
  );
}
