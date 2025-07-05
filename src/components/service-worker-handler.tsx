'use client';

import { useEffect } from 'react';

export function ServiceWorkerHandler() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      // Register service worker
      navigator.serviceWorker
        .register('/sw.js')
        .then(registration => {
          console.log(
            '✅ [PWA] Service Worker registered:',
            registration.scope
          );
        })
        .catch(error => {
          console.error('❌ [PWA] Service Worker registration failed:', error);
        });

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
  }, []);

  return null;
}
