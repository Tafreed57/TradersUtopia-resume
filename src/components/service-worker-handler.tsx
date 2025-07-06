'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect } from 'react';
import { toast } from 'sonner';

export function ServiceWorkerHandler() {
  const { isSignedIn } = useAuth();
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const handleServiceWorker = async () => {
        try {
          const registration = await navigator.serviceWorker.register('/sw.js');
          if (registration.installing) {
            // ... existing code ...
          } else if (registration.waiting) {
            // ... existing code ...
          } else if (registration.active) {
            // ... existing code ...
          }
        } catch (error) {
          // console.error('Service worker registration failed:', error);
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

      return () => {
        navigator.serviceWorker.removeEventListener('message', handleMessage);
      };
    }
  }, [isSignedIn]);

  return null;
}
