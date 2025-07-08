// Service Worker for Push Notifications - Enhanced for better mobile/desktop support
const CACHE_NAME = 'tradersutopia-notifications-v3';

// Helper function for vibration patterns
function getVibrationPattern(type) {
  const patterns = {
    'MENTION': [200, 100, 200, 100, 200], // Strong pattern for mentions
    'SECURITY': [100, 50, 100, 50, 100, 50, 100], // Alert pattern for security
    'MESSAGE': [200, 100, 200], // Standard pattern for messages
    'PAYMENT': [300, 200, 300], // Longer pattern for payments
    'SYSTEM': [150], // Single vibration for system notifications
  };
  return patterns[type] || patterns['MESSAGE'];
}

// Install event
self.addEventListener('install', (event) => {
  console.log('🔧 [SW] Service Worker installing...');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('✅ [SW] Service Worker activated');
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => cacheName !== CACHE_NAME)
            .map((cacheName) => caches.delete(cacheName))
        );
      })
    ])
  );
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
    
    // Enhanced notification options with better mobile/desktop support
    const options = {
      body: data.body || data.message || 'You have a new notification',
      icon: data.icon || '/logo.svg',
      badge: data.badge || '/logo.svg',
      image: data.image,
      data: data.data || {},
      actions: data.actions || [
        {
          action: 'open',
          title: 'View',
          icon: '/logo.svg',
        },
        {
          action: 'dismiss',
          title: 'Dismiss',
        }
      ],
      requireInteraction: data.requireInteraction || data.data?.type === 'SECURITY',
      silent: data.silent || false,
      tag: data.tag || `notification-${Date.now()}`,
      renotify: data.renotify !== false, // Default to true for better visibility
      vibrate: getVibrationPattern(data.data?.type || data.type),
      timestamp: data.data?.timestamp || Date.now(),
      // Enhanced for different notification types
      dir: 'auto', // Text direction
      lang: 'en', // Language
    };

    // Show the notification with error handling
    event.waitUntil(
      self.registration.showNotification(data.title || 'TradersUtopia', options)
        .then(() => {
          console.log(`✅ [SW] Notification displayed: ${data.title}`);
        })
        .catch((error) => {
          console.error('❌ [SW] Failed to show notification:', error);
          // Fallback: try with minimal options
          return self.registration.showNotification('TradersUtopia', {
            body: 'You have a new notification',
            icon: '/logo.svg',
            tag: 'fallback-notification'
          });
        })
    );

  } catch (error) {
    console.error('❌ [SW] Error parsing push data:', error);
    
    // Show a generic notification as fallback
    event.waitUntil(
      self.registration.showNotification('TradersUtopia', {
        body: 'You have a new notification',
        icon: '/logo.svg',
        badge: '/logo.svg',
        tag: 'generic-notification',
        actions: [
          {
            action: 'open',
            title: 'View',
          }
        ]
      })
    );
  }
});

// Enhanced notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 [SW] Notification clicked');
  
  const notification = event.notification;
  const data = notification.data || {};
  
  // Close the notification
  notification.close();

  // Handle different action clicks
  if (event.action === 'dismiss') {
    console.log('❌ [SW] Notification dismissed');
    return;
  }

  if (event.action === 'open' || !event.action) {
    const urlToOpen = data.url || '/dashboard';
    
    event.waitUntil(
      clients.matchAll({ 
        type: 'window', 
        includeUncontrolled: true 
      }).then((clientList) => {
        // Check if there's already a window open with the app
        for (const client of clientList) {
          if (client.url.includes(self.location.origin)) {
            // Focus existing window and navigate to the notification URL
            return client.focus().then(() => {
              if ('navigate' in client && data.url) {
                return client.navigate(data.url);
              } else {
                // Fallback: post message to client to handle navigation
                client.postMessage({
                  type: 'NAVIGATE',
                  url: data.url || '/dashboard'
                });
              }
            });
          }
        }
        
        // Open new window if none exists
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      }).catch((error) => {
        console.error('❌ [SW] Error handling notification click:', error);
      })
    );
  }
});

// Notification close event
self.addEventListener('notificationclose', (event) => {
  console.log('❌ [SW] Notification closed');
  
  const data = event.notification.data || {};
  
  // Track notification dismissals for analytics
  if (data.trackDismissal) {
    // Optional: Send analytics about notification dismissal
    fetch('/api/analytics/notification-dismissed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        notificationId: data.notificationId,
        type: data.type,
        dismissedAt: Date.now()
      })
    }).catch((error) => {
      console.log('📊 [SW] Analytics tracking failed:', error);
    });
  }
});

// Background sync for offline notification delivery
self.addEventListener('sync', (event) => {
  console.log('🔄 [SW] Background sync triggered');
  
  if (event.tag === 'notification-sync') {
    event.waitUntil(
      fetch('/api/notifications/sync', {
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

// Enhanced message event handling
self.addEventListener('message', (event) => {
  console.log('💬 [SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }

  if (event.data && event.data.type === 'CLOSE_NOTIFICATION') {
    // Close specific notification by tag
    self.registration.getNotifications({ tag: event.data.tag }).then(notifications => {
      notifications.forEach(notification => notification.close());
    });
  }
});

// Enhanced error handling
self.addEventListener('error', (event) => {
  console.error('❌ [SW] Service Worker error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('❌ [SW] Unhandled promise rejection:', event.reason);
  event.preventDefault();
}); 