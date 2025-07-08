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
          console.log('🔧 [SW-HANDLER] Registering service worker...');

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
            console.log('🔧 [SW-HANDLER] Service worker installing...');
          } else if (registration.waiting) {
            console.log('⏳ [SW-HANDLER] Service worker waiting...');
            // Auto-update if there's a waiting service worker
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          } else if (registration.active) {
            console.log('✅ [SW-HANDLER] Service worker active and ready');
          }

          // Listen for service worker updates
          registration.addEventListener('updatefound', () => {
            console.log('🔄 [SW-HANDLER] Service worker update found');
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (
                  newWorker.state === 'installed' &&
                  navigator.serviceWorker.controller
                ) {
                  console.log(
                    '🆕 [SW-HANDLER] New service worker installed, reloading page...'
                  );
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
        console.log('💬 [SW-HANDLER] Message received:', event.data);

        if (event.data && event.data.type === 'NAVIGATE') {
          console.log('🔗 [SW-HANDLER] Navigating to:', event.data.url);
          window.location.href = event.data.url;
        }
      };

      navigator.serviceWorker.addEventListener('message', handleMessage);

      // Handle service worker controller changes
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('🔄 [SW-HANDLER] Service worker controller changed');
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

    const checkForUpdates = () => {
      swRegistration.update().catch(error => {
        console.log('🔄 [SW-HANDLER] Update check failed:', error);
      });
    };

    // Check for updates every 5 minutes
    const updateInterval = setInterval(checkForUpdates, 5 * 60 * 1000);

    return () => clearInterval(updateInterval);
  }, [swRegistration]);

  return null;
}
