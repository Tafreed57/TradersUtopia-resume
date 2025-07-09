'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';

export function ServiceWorkerHandler() {
  const { isSignedIn } = useAuth();
  const [swRegistration, setSwRegistration] =
    useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const handleServiceWorker = async () => {
        try {
          // Register the service worker
          const registration = await navigator.serviceWorker.register(
            '/sw.js',
            {
              scope: '/', // Ensure proper scope
              updateViaCache: 'none', // Always check for updates
            }
          );

          setSwRegistration(registration);

          if (registration.installing) {
            // Service worker installing
          } else if (registration.waiting) {
            // Auto-update if there's a waiting service worker
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          } else if (registration.active) {
            // Service worker active and ready
          }

          // Listen for service worker updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (
                  newWorker.state === 'installed' &&
                  navigator.serviceWorker.controller
                ) {
                  window.location.reload();
                }
              });
            }
          });
        } catch (error) {
          console.error(
            '❌ [SW-HANDLER] Service worker registration failed:',
            error
          );
        }
      };

      handleServiceWorker();

      // Listen for service worker messages
      const handleMessage = (event: MessageEvent) => {
        if (event.data && event.data.type === 'NAVIGATE') {
          window.location.href = event.data.url;
        }
      };

      navigator.serviceWorker.addEventListener('message', handleMessage);

      // Handle service worker controller changes
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });

      return () => {
        navigator.serviceWorker.removeEventListener('message', handleMessage);
      };
    } else {
      console.warn(
        '⚠️ [SW-HANDLER] Service workers not supported in this browser'
      );
    }
  }, [isSignedIn]);

  // Auto-check for service worker updates every 5 minutes
  useEffect(() => {
    if (!swRegistration) return;

    // ✅ FIX: Add guard to prevent multiple interval creation
    let updateInterval: NodeJS.Timeout | null = null;

    const checkForUpdates = () => {
      if (!swRegistration) return; // Additional safety check
      swRegistration.update().catch(error => {
        // Update check failed - silently continue
      });
    };

    // Check for updates every 5 minutes
    updateInterval = setInterval(checkForUpdates, 5 * 60 * 1000);

    return () => {
      if (updateInterval) {
        clearInterval(updateInterval);
      }
    };
  }, [swRegistration]);

  return null;
}
