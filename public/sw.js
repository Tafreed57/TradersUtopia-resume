// Service Worker for Push Notifications - Enhanced Mobile Support v5 (No Caching)
// Removed all caching functionality to ensure fresh data on every request

// Mobile-specific optimizations
const isMobile = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

const isIOSPWA = () => {
  return window.matchMedia && window.matchMedia('(display-mode: standalone)').matches && 
         /iPad|iPhone|iPod/.test(navigator.userAgent);
};

// Enhanced vibration patterns for mobile
function getVibrationPattern(type) {
  // Only vibrate on mobile devices
  if (!isMobile()) return [];
  
  const patterns = {
    'MENTION': [200, 100, 200, 100, 200], // Strong pattern for mentions
    'SECURITY': [100, 50, 100, 50, 100, 50, 100], // Alert pattern for security
    'MESSAGE': [200, 100, 200], // Standard pattern for messages
    'PAYMENT': [300, 200, 300], // Longer pattern for payments
    'SYSTEM': [150], // Single vibration for system notifications
  };
  return patterns[type] || patterns['MESSAGE'];
}

// Enhanced install event (no caching - always fresh data)
self.addEventListener('install', (event) => {
  console.log('📱 [SW] Installing service worker for mobile (no caching)...');
  
  // Force activation without waiting for old service worker to close
  self.skipWaiting();
});

// Enhanced activate event (no cache cleanup needed)
self.addEventListener('activate', (event) => {
  console.log('✅ [SW] Activating service worker (no caching)...');
  
  event.waitUntil(
    Promise.all([
      // Clean up any existing caches from previous versions
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            console.log(`🗑️ [SW] Deleting old cache: ${cacheName}`);
            return caches.delete(cacheName);
          })
        );
      }),
      // Take control of all clients immediately
      self.clients.claim(),
    ])
  );
});

// Fetch event - Always bypass cache and fetch fresh data from network
self.addEventListener('fetch', (event) => {
  // Always fetch from network for fresh data
  event.respondWith(
    fetch(event.request.clone(), {
      cache: 'no-store', // Never use cache
      headers: {
        ...event.request.headers,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    }).catch((error) => {
      console.error('❌ [SW] Network request failed:', error);
      // If network fails, try the original request without modified headers
      return fetch(event.request);
    })
  );
});

// Enhanced push event with mobile-specific handling
self.addEventListener('push', (event) => {
  console.log('📱 [SW] Push notification received', {
    isMobile: isMobile(),
    hasData: !!event.data,
    timestamp: new Date().toISOString()
  });

  if (!event.data) {
    console.warn('⚠️ [SW] Push event received without data');
    return;
  }

  try {
    const data = event.data.json();
    console.log('📱 [SW] Push data:', data);
    
    // Enhanced notification options with mobile optimization
    const options = {
      body: data.body || data.message || 'You have a new notification',
      icon: data.icon || '/logo.png',
      badge: data.badge || '/logo.png',
      image: data.image || '/logo.png',
      data: data.data || {},
      actions: data.actions || [
        {
          action: 'open',
          title: 'View',
          icon: '/logo.png',
        },
        {
          action: 'dismiss',
          title: 'Dismiss',
        }
      ],
      requireInteraction: data.requireInteraction || data.data?.type === 'SECURITY',
      silent: data.silent || false,
      tag: data.tag || `notification-${Date.now()}`,
      renotify: data.renotify !== false,
      vibrate: getVibrationPattern(data.data?.type || data.type),
      timestamp: data.data?.timestamp || Date.now(),
      dir: 'auto',
      lang: 'en',
      // Mobile-specific enhancements
      ...(isMobile() && {
        requireInteraction: true, // Keep notifications visible on mobile
        persistentAction: true,
      }),
    };

    // Show notification with enhanced error handling
    event.waitUntil(
      self.registration.showNotification(data.title || 'TradersUtopia', options)
        .then(() => {
          console.log(`✅ [SW] Notification displayed: ${data.title}`);
        })
        .catch((error) => {
          console.error('❌ [SW] Failed to show notification:', error);
          
          // Enhanced fallback for mobile
          const fallbackOptions = {
            body: data.body || 'You have a new notification',
            icon: '/logo.svg',
            badge: '/logo.svg',
            tag: 'fallback-notification',
            requireInteraction: isMobile(), // Always require interaction on mobile
            vibrate: isMobile() ? [200] : [],
          };
          
          return self.registration.showNotification('TradersUtopia', fallbackOptions);
        })
    );

  } catch (error) {
    console.error('❌ [SW] Error parsing push data:', error);
    
    // Mobile-optimized fallback notification
    const fallbackOptions = {
      body: 'You have a new notification',
      icon: '/logo.svg',
      badge: '/logo.svg',
      tag: 'generic-notification',
      requireInteraction: isMobile(),
      vibrate: isMobile() ? [200, 100, 200] : [],
      actions: [
        {
          action: 'open',
          title: 'View',
        }
      ]
    };
    
    event.waitUntil(
      self.registration.showNotification('TradersUtopia', fallbackOptions)
    );
  }
});

// Enhanced notification click event with mobile-specific handling
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
    let urlToOpen = data.url || '/dashboard';
    
    // ✅ SECURITY: Prevent emoji URLs
    if (urlToOpen.includes('💬') || urlToOpen.includes('%F0%9F%92%AC') || /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/u.test(urlToOpen)) {
      console.warn('🚨 [SW] Invalid URL contains emoji:', urlToOpen);
      urlToOpen = '/dashboard';
    }
    
    event.waitUntil(
      clients.matchAll({ 
        type: 'window', 
        includeUncontrolled: true 
      }).then((clientList) => {
        console.log(`🔍 [SW] Found ${clientList.length} clients`);
        
        // Enhanced client detection for mobile
        for (const client of clientList) {
          if (client.url.includes(self.location.origin)) {
            console.log('🎯 [SW] Focusing existing client');
            return client.focus().then(() => {
              // Enhanced navigation for mobile
              if ('navigate' in client && data.url) {
                console.log(`🧭 [SW] Navigating to: ${data.url}`);
                return client.navigate(data.url);
              } else {
                // Enhanced messaging for mobile
                console.log('📨 [SW] Sending navigation message');
                client.postMessage({
                  type: 'NAVIGATE',
                  url: data.url || '/dashboard',
                  timestamp: Date.now(),
                });
              }
            });
          }
        }
        
        // Open new window with mobile-specific handling
        if (clients.openWindow) {
          console.log(`🪟 [SW] Opening new window: ${urlToOpen}`);
          return clients.openWindow(urlToOpen).catch((error) => {
            console.error('❌ [SW] Failed to open window:', error);
            // Fallback: try to open dashboard
            return clients.openWindow('/dashboard');
          });
        } else {
          console.warn('⚠️ [SW] openWindow not available');
        }
      }).catch((error) => {
        console.error('❌ [SW] Error handling notification click:', error);
      })
    );
  }
});

// Enhanced message event for mobile communication
self.addEventListener('message', (event) => {
  console.log('📨 [SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  // Mobile-specific message handling
  if (event.data && event.data.type === 'MOBILE_READY') {
    console.log('📱 [SW] Mobile client ready');
    event.ports[0].postMessage({
      type: 'SW_READY',
      isMobile: isMobile(),
    });
  }
});

// Enhanced error handling
self.addEventListener('error', (event) => {
  console.error('❌ [SW] Service worker error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('❌ [SW] Unhandled promise rejection:', event.reason);
});

// Enhanced background sync for mobile
self.addEventListener('sync', (event) => {
  console.log('🔄 [SW] Background sync triggered:', event.tag);
  
  if (event.tag === 'notification-retry') {
    event.waitUntil(
      // Retry failed notification operations
      Promise.resolve()
    );
  }
});

console.log('✅ [SW] Service worker script loaded successfully'); 