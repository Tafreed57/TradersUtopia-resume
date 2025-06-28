"use client";

import { useSearchParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useLoading } from '@/contexts/loading-provider';

export function AutoRouteAfterSignIn() {
  const searchParams = useSearchParams();
  const { isLoaded, isSignedIn, user } = useUser();
  const router = useRouter();
  const [hasStartedRouting, setHasStartedRouting] = useState(false);
  const { startLoading, stopLoading } = useLoading();

  useEffect(() => {
    if (!isLoaded || hasStartedRouting) return;

    const autoRoute = searchParams?.get('auto_route');
    
    if (isSignedIn && autoRoute === 'true') {
      setHasStartedRouting(true);
      
      // Start loading immediately when auto-routing begins
      startLoading('Setting up your dashboard...');
      
      // Small delay to ensure everything is loaded
      setTimeout(async () => {
        try {
          // First ensure the default server is created
          const serverResponse = await fetch('/api/servers/ensure-default', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          if (serverResponse.ok) {
            // Navigate to dashboard
            router.push('/dashboard');
          } else {
            console.error('Failed to ensure default server');
            stopLoading();
          }
        } catch (error) {
          console.error('Error during auto-routing:', error);
          stopLoading();
        }
      }, 1000);
    }
  }, [isLoaded, isSignedIn, searchParams, router, hasStartedRouting, startLoading, stopLoading]);

  // Don't render anything - loading is handled by LoadingProvider
  return null;
} 