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
    if (!isLoaded || !user) {
      return;
    }

    const handleForceRecheck = () => {
      setIs2FAChecked(false);
      setRequires2FA(false);
    };

    // Listen for custom event to force re-check
    window.addEventListener('force-2fa-recheck', handleForceRecheck);
    
    const cleanup = () => {
      window.removeEventListener('force-2fa-recheck', handleForceRecheck);
    };

    // Skip 2FA check for public routes and home page
    const skipRoutes = [
      '/', // Home page - public landing page
      '/2fa-verify', 
      '/sign-in', 
      '/sign-up', 
      '/pricing'
    ];
    const shouldSkip = skipRoutes.some(route => pathname === route || pathname.startsWith(route));
    
    if (shouldSkip) {
      setIs2FAChecked(true);
      setRequires2FA(false);
      return;
    }

    const check2FAStatus = async () => {
      try {
        // Add timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 5000)
        );

        // Check if user has 2FA enabled
        const profilePromise = fetch('/api/user/profile');
        const profileResponse = await Promise.race([profilePromise, timeoutPromise]) as Response;
        
        if (!profileResponse.ok) {
          setIs2FAChecked(true);
          return;
        }

        const profile = await profileResponse.json();

        if (profile.twoFactorEnabled) {
          // Check verification status using secure server-side API
          const statusPromise = fetch('/api/2fa/status');
          const statusResponse = await Promise.race([statusPromise, timeoutPromise]) as Response;
          
          if (!statusResponse.ok) {
            setIs2FAChecked(true);
            return;
          }

          const statusData = await statusResponse.json();

          if (!statusData.verified) {
            setRequires2FA(true);
            const redirectUrl = `/2fa-verify?redirect=${encodeURIComponent(pathname)}`;
            router.push(redirectUrl);
            return;
          }
        }

        setIs2FAChecked(true);
      } catch (error) {
        // On error, skip 2FA check to prevent blocking the user
        setIs2FAChecked(true);
        setRequires2FA(false);
      }
    };

    check2FAStatus();

    return cleanup;
  }, [isLoaded, user, pathname, router]);

  // Don't show loading/redirect messages on public routes
  const skipRoutes = [
    '/', // Home page
    '/2fa-verify', 
    '/sign-in', 
    '/sign-up', 
    '/pricing'
  ];
  const shouldSkipMessages = skipRoutes.some(route => pathname === route || pathname.startsWith(route));

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