"use client";

import { useUser } from '@clerk/nextjs';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

interface TwoFactorGuardProps {
  children: React.ReactNode;
}

export function TwoFactorGuard({ children }: TwoFactorGuardProps) {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const [is2FAChecked, setIs2FAChecked] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);

  useEffect(() => {
    console.log('🔒 TwoFactorGuard running for pathname:', pathname, 'user loaded:', isLoaded, 'user exists:', !!user);
    
    if (!isLoaded || !user) {
      console.log('⏳ Waiting for user to load...');
      return;
    }

    const handleForceRecheck = () => {
      console.log('🔄 Forcing 2FA re-check...');
      setIs2FAChecked(false);
      setRequires2FA(false);
    };

    // Listen for custom event to force re-check
    window.addEventListener('force-2fa-recheck', handleForceRecheck);
    
    const cleanup = () => {
      window.removeEventListener('force-2fa-recheck', handleForceRecheck);
    };

    // Skip 2FA check for certain routes
    const skipRoutes = ['/2fa-verify', '/sign-in', '/sign-up', '/pricing'];
    const shouldSkip = skipRoutes.some(route => pathname.startsWith(route));
    
    console.log('🛤️ Current pathname:', pathname);
    console.log('🚫 Should skip 2FA check:', shouldSkip);
    
    if (shouldSkip) {
      console.log('✅ Skipping 2FA check for route:', pathname);
      setIs2FAChecked(true);
      setRequires2FA(false); // Make sure we don't require 2FA
      return;
    }

    const check2FAStatus = async () => {
      try {
        console.log('🔍 Checking 2FA status for authenticated user...');
        
        // Check if user has 2FA enabled
        const profileResponse = await fetch('/api/user/profile');
        if (!profileResponse.ok) {
          console.error('Failed to fetch profile');
          setIs2FAChecked(true);
          return;
        }

        const profile = await profileResponse.json();
        console.log('📋 Profile 2FA status:', profile.twoFactorEnabled);

        if (profile.twoFactorEnabled) {
          // Check if already verified in this session
          const cookieStore = document.cookie;
          const isVerified = cookieStore.includes('2fa-verified=true');
          console.log('🍪 2FA verification cookie present:', isVerified);
          console.log('🍪 All cookies:', document.cookie);

          if (!isVerified) {
            console.log('🚨 2FA required - redirecting to verification');
            setRequires2FA(true);
            const redirectUrl = `/2fa-verify?redirect=${encodeURIComponent(pathname)}`;
            router.push(redirectUrl);
            return;
          } else {
            console.log('✅ 2FA already verified for this session');
          }
        } else {
          console.log('ℹ️ User does not have 2FA enabled');
        }

        setIs2FAChecked(true);
      } catch (error) {
        console.error('❌ 2FA check error:', error);
        setIs2FAChecked(true);
      }
    };

    check2FAStatus();

    return cleanup;
  }, [isLoaded, user, pathname, router]);

  // Don't show loading/redirect messages on certain pages
  const skipRoutes = ['/2fa-verify', '/sign-in', '/sign-up', '/pricing'];
  const shouldSkipMessages = skipRoutes.some(route => pathname.startsWith(route));

  // Show loading state while checking (but not on skip routes)
  if (!isLoaded || (!is2FAChecked && !shouldSkipMessages)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  // Don't render children if 2FA verification is required (but not on skip routes)
  if (requires2FA && !shouldSkipMessages) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Redirecting to 2FA verification...</div>
      </div>
    );
  }

  return <>{children}</>;
} 