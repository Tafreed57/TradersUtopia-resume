'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { showToast } from '@/lib/notifications-client';
import {
  Bell,
  Smartphone,
  Monitor,
  CheckCircle,
  X,
  AlertCircle,
  Settings,
  ExternalLink,
} from 'lucide-react';

// Mobile-compatible browser detection
const isMobile = () => {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
};

const isSafari = () => {
  if (typeof window === 'undefined') return false;
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
};

const isIOSPWA = () => {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches && isMobile();
};

export function PushNotificationPrompt() {
  const { user } = useUser();
  const [isVisible, setIsVisible] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushPermission, setPushPermission] =
    useState<NotificationPermission>('default');
  const [isEnabling, setIsEnabling] = useState(false);
  const [hasSubscription, setHasSubscription] = useState(false);
  const [browserInfo, setBrowserInfo] = useState<{
    isMobile: boolean;
    isSafari: boolean;
    isIOSPWA: boolean;
    supportsServiceWorker: boolean;
    supportsPushManager: boolean;
  }>({
    isMobile: false,
    isSafari: false,
    isIOSPWA: false,
    supportsServiceWorker: false,
    supportsPushManager: false,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Detect browser capabilities
    const browserCapabilities = {
      isMobile: isMobile(),
      isSafari: isSafari(),
      isIOSPWA: isIOSPWA(),
      supportsServiceWorker: 'serviceWorker' in navigator,
      supportsPushManager: 'PushManager' in window,
    };

    setBrowserInfo(browserCapabilities);

    // Enhanced push notification support detection
    const supported =
      browserCapabilities.supportsServiceWorker &&
      browserCapabilities.supportsPushManager &&
      'Notification' in window;

    setPushSupported(supported);

    if (supported && 'Notification' in window) {
      setPushPermission(Notification.permission);
    }

    // Check if user already has a push subscription
    checkExistingSubscription();

    // Only show prompt if all conditions are met
    const shouldShow =
      !!user &&
      supported &&
      Notification.permission === 'default' &&
      !hasSubscription &&
      !localStorage.getItem('push-prompt-dismissed');

    setIsVisible(shouldShow);
  }, [user, hasSubscription]);

  const checkExistingSubscription = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        setHasSubscription(!!subscription);
      }
    } catch (error) {
      console.log('Failed to check existing subscription:', error);
    }
  };

  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  };

  const enablePushNotifications = async () => {
    if (!pushSupported) {
      if (browserInfo.isSafari && browserInfo.isMobile) {
        showToast.error(
          'Safari Mobile Limitation',
          'Push notifications in Safari on mobile require adding to home screen first. Tap the share button and select "Add to Home Screen".'
        );
      } else {
        showToast.error(
          'Not supported',
          'Push notifications are not supported in this browser. Try Chrome, Firefox, or Safari.'
        );
      }
      return;
    }

    // Enhanced VAPID key retrieval with fallback
    let vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

    // Fallback: try to get from API if environment variable is not available
    if (!vapidPublicKey) {
      try {
        const response = await fetch('/api/vapid-public-key');
        if (response.ok) {
          const data = await response.json();
          vapidPublicKey = data.publicKey;
        }
      } catch (error) {
        console.error('Failed to get VAPID key from API:', error);
      }
    }

    if (!vapidPublicKey) {
      showToast.error(
        'Configuration error',
        'Push notifications are not properly configured. Please contact support.'
      );
      return;
    }

    setIsEnabling(true);

    try {
      // Request permission with enhanced error handling
      let permission: NotificationPermission;

      if (browserInfo.isSafari && browserInfo.isMobile) {
        // Safari on mobile needs special handling
        if (Notification.permission === 'denied') {
          showToast.error(
            'Permission denied',
            'Please enable notifications in Safari settings: Settings > Safari > Notifications'
          );
          return;
        }
      }

      try {
        permission = await Notification.requestPermission();
      } catch (error) {
        // Fallback for older browsers
        permission = await new Promise(resolve => {
          Notification.requestPermission(resolve);
        });
      }

      setPushPermission(permission);

      if (permission === 'granted') {
        // Register service worker with enhanced error handling
        let registration;
        try {
          registration = await navigator.serviceWorker.register('/sw.js');
          await navigator.serviceWorker.ready;
        } catch (error) {
          console.error('Service worker registration failed:', error);
          showToast.error(
            'Service Worker Error',
            'Failed to register service worker. Please try again.'
          );
          return;
        }

        // Subscribe to push notifications
        try {
          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
          });

          // Send subscription to backend
          const response = await fetch('/api/notifications/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscription }),
          });

          if (response.ok) {
            setHasSubscription(true);
            setIsVisible(false);
            showToast.success(
              '🎉 Push notifications enabled!',
              browserInfo.isMobile
                ? "You'll now receive notifications on your mobile device!"
                : "You'll now receive notifications even when the app is closed"
            );
          } else {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to save subscription');
          }
        } catch (subscriptionError) {
          console.error('Push subscription failed:', subscriptionError);
          showToast.error(
            'Subscription failed',
            'Could not enable push notifications. Please try again later.'
          );
        }
      } else if (permission === 'denied') {
        showToast.error(
          'Permission denied',
          browserInfo.isMobile
            ? 'Please enable notifications in your browser settings'
            : 'Push notifications require permission to work properly'
        );
        dismissPrompt();
      } else {
        showToast.error(
          'Permission required',
          'Push notifications need permission to work'
        );
      }
    } catch (error) {
      console.error('Failed to enable push notifications:', error);
      showToast.error(
        'Setup failed',
        'Could not enable push notifications. Please try again later.'
      );
    } finally {
      setIsEnabling(false);
    }
  };

  const dismissPrompt = () => {
    setIsVisible(false);
    // Remember dismissal for 7 days
    const dismissUntil = Date.now() + 7 * 24 * 60 * 60 * 1000;
    localStorage.setItem('push-prompt-dismissed', dismissUntil.toString());
  };

  const openSettings = () => {
    dismissPrompt();
    // Navigate to notification settings
    window.location.href = '/dashboard?tab=settings';
  };

  const openBrowserSettings = () => {
    if (browserInfo.isSafari && browserInfo.isMobile) {
      showToast.info(
        'Safari Settings',
        'Go to Settings > Safari > Notifications to enable push notifications'
      );
    } else {
      showToast.info(
        'Browser Settings',
        'Please check your browser notification settings'
      );
    }
  };

  if (!isVisible) return null;

  // Show different UI based on browser support
  if (!pushSupported) {
    return (
      <Card className='fixed bottom-4 right-4 z-50 w-80 max-w-[calc(100vw-2rem)] border-orange-500/30 bg-gradient-to-br from-orange-900/40 to-red-900/40 backdrop-blur-md shadow-2xl pwa-safe-bottom'>
        <CardContent className='p-4'>
          <div className='flex items-start gap-3'>
            <div className='w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center flex-shrink-0'>
              <AlertCircle className='h-5 w-5 text-orange-400' />
            </div>

            <div className='flex-1 min-w-0'>
              <div className='flex items-center justify-between mb-2'>
                <h3 className='text-sm font-semibold text-white'>
                  {browserInfo.isSafari && browserInfo.isMobile
                    ? 'Safari Mobile Setup'
                    : 'Browser Not Supported'}
                </h3>
                <Button
                  variant='ghost'
                  size='sm'
                  className='h-6 w-6 p-0 text-gray-400 hover:text-white'
                  onClick={dismissPrompt}
                >
                  <X className='h-3 w-3' />
                </Button>
              </div>

              <p className='text-xs text-gray-300 mb-3'>
                {browserInfo.isSafari && browserInfo.isMobile
                  ? 'For push notifications in Safari on mobile, please add this site to your home screen first.'
                  : 'Push notifications are not supported in this browser. Try Chrome, Firefox, or Safari.'}
              </p>

              <div className='flex gap-2'>
                {browserInfo.isSafari && browserInfo.isMobile ? (
                  <Button
                    size='sm'
                    onClick={openBrowserSettings}
                    className='flex-1 bg-orange-600 hover:bg-orange-700 text-white text-xs h-8'
                  >
                    <ExternalLink className='h-3 w-3 mr-1' />
                    <span>Setup Guide</span>
                  </Button>
                ) : (
                  <Button
                    size='sm'
                    onClick={dismissPrompt}
                    className='flex-1 bg-orange-600 hover:bg-orange-700 text-white text-xs h-8'
                  >
                    <span>Dismiss</span>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className='fixed bottom-4 right-4 z-50 w-80 max-w-[calc(100vw-2rem)] border-blue-500/30 bg-gradient-to-br from-blue-900/40 to-indigo-900/40 backdrop-blur-md shadow-2xl pwa-safe-bottom'>
      <CardContent className='p-4'>
        <div className='flex items-start gap-3'>
          <div className='w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center flex-shrink-0'>
            <Bell className='h-5 w-5 text-blue-400' />
          </div>

          <div className='flex-1 min-w-0'>
            <div className='flex items-center justify-between mb-2'>
              <h3 className='text-sm font-semibold text-white'>
                Stay Connected
              </h3>
              <Button
                variant='ghost'
                size='sm'
                className='h-6 w-6 p-0 text-gray-400 hover:text-white'
                onClick={dismissPrompt}
              >
                <X className='h-3 w-3' />
              </Button>
            </div>

            <p className='text-xs text-gray-300 mb-3'>
              Get instant notifications for messages, mentions, and important
              updates - even when TradersUtopia is closed.
            </p>

            <div className='flex items-center gap-2 mb-3'>
              <div className='flex items-center gap-1'>
                <Smartphone className='h-3 w-3 text-green-400' />
                <span className='text-xs text-green-400'>
                  {browserInfo.isMobile ? 'Mobile Ready' : 'Mobile'}
                </span>
              </div>
              <div className='flex items-center gap-1'>
                <Monitor className='h-3 w-3 text-green-400' />
                <span className='text-xs text-green-400'>Desktop</span>
              </div>
              <Badge
                variant='outline'
                className='text-xs border-blue-400/30 text-blue-300'
              >
                {browserInfo.isSafari ? 'Safari' : 'PWA Ready'}
              </Badge>
            </div>

            <div className='flex gap-2'>
              <Button
                size='sm'
                onClick={enablePushNotifications}
                disabled={isEnabling}
                className='flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs h-8'
              >
                {isEnabling ? (
                  <div className='flex items-center gap-1'>
                    <div className='w-3 h-3 border border-white/20 border-t-white rounded-full animate-spin' />
                    <span>Enabling...</span>
                  </div>
                ) : (
                  <div className='flex items-center gap-1'>
                    <CheckCircle className='h-3 w-3' />
                    <span>Enable</span>
                  </div>
                )}
              </Button>

              <Button
                variant='outline'
                size='sm'
                onClick={openSettings}
                className='border-gray-600/50 text-gray-300 hover:bg-gray-700/50 text-xs h-8'
              >
                <Settings className='h-3 w-3' />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
