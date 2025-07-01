// Service Worker for Push Notifications
const CACHE_NAME = 'tradersutopia-notifications-v1';

// Install event
self.addEventListener('install', (event) => {
  console.log('🔧 [SW] Service Worker installing...');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('✅ [SW] Service Worker activated');
  event.waitUntil(self.clients.claim());
});

// Push event - handle incoming push notifications
self.addEventListener('push', (event) => {
  console.log('📱 [SW] Push notification received');

  if (!event.data) {
    console.warn('⚠️ [SW] Push event received without data');
    return;
  }

  try {
    const data = event.data.json();
    
    const options = {
      body: data.body || data.message,
      icon: data.icon || '/logo.svg',
      badge: data.badge || '/logo.svg',
      image: data.image,
      data: data.data || {},
      actions: data.actions || [],
      requireInteraction: data.requireInteraction || false,
      silent: data.silent || false,
      tag: data.tag || 'notification',
      renotify: data.renotify || false,
      vibrate: [200, 100, 200], // Vibration pattern for mobile
      timestamp: data.data?.timestamp || Date.now(),
    };

    // Show the notification
    event.waitUntil(
      self.registration.showNotification(data.title || 'TradersUtopia', options)
    );

    console.log(`✅ [SW] Notification displayed: ${data.title}`);

  } catch (error) {
    console.error('❌ [SW] Error parsing push data:', error);
    
    // Show a generic notification as fallback
    event.waitUntil(
      self.registration.showNotification('TradersUtopia', {
        body: 'You have a new notification',
        icon: '/logo.svg',
        badge: '/logo.svg',
        tag: 'generic-notification'
      })
    );
  }
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 [SW] Notification clicked');
  
  const notification = event.notification;
  const data = notification.data || {};
  
  // Close the notification
  notification.close();

  // Handle action clicks
  if (event.action) {
    console.log(`🎯 [SW] Action clicked: ${event.action}`);
    
    if (event.action === 'open') {
      const urlToOpen = data.url || '/';
      event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
          .then((clientList) => {
            // Check if there's already a window open
            for (const client of clientList) {
              if (client.url.includes(self.location.origin) && 'focus' in client) {
                // Focus existing window and navigate
                return client.focus().then(() => {
                  if ('navigate' in client) {
                    return client.navigate(urlToOpen);
                  }
                });
              }
            }
            
            // Open new window if none exists
            if (clients.openWindow) {
              return clients.openWindow(urlToOpen);
            }
          })
      );
    }
    return;
  }

  // Default click behavior - open the app
  const urlToOpen = data.url || '/dashboard';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if there's already a window open with the app
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            // Focus existing window and navigate to the notification URL
            return client.focus().then(() => {
              if ('navigate' in client && data.url) {
                return client.navigate(data.url);
              }
            });
          }
        }
        
        // Open new window if none exists
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
      .catch((error) => {
        console.error('❌ [SW] Error handling notification click:', error);
      })
  );
});

// Notification close event
self.addEventListener('notificationclose', (event) => {
  console.log('❌ [SW] Notification closed');
  
  // You can track notification dismissals here if needed
  const data = event.notification.data || {};
  
  // Optional: Send analytics about notification dismissal
  if (data.trackDismissal) {
    // fetch('/api/analytics/notification-dismissed', { ... });
  }
});

// Background sync (for future use)
self.addEventListener('sync', (event) => {
  console.log('🔄 [SW] Background sync triggered');
  
  if (event.tag === 'notification-sync') {
    event.waitUntil(
      // Sync any pending notifications
      self.fetch('/api/notifications/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      }).catch((error) => {
        console.error('❌ [SW] Sync failed:', error);
      })
    );
  }
});

// Message event - communication with main thread
self.addEventListener('message', (event) => {
  console.log('💬 [SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});

// Error handling
self.addEventListener('error', (event) => {
  console.error('❌ [SW] Service Worker error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('❌ [SW] Unhandled promise rejection:', event.reason);
  event.preventDefault();
}); 