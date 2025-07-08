'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { showToast } from '@/lib/notifications-client';
import {
  Bell,
  BellOff,
  Smartphone,
  Monitor,
  CheckCircle,
  X,
  AlertCircle,
  Settings,
} from 'lucide-react';

export function PushNotificationPrompt() {
  const { user } = useUser();
  const [isVisible, setIsVisible] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushPermission, setPushPermission] =
    useState<NotificationPermission>('default');
  const [isEnabling, setIsEnabling] = useState(false);
  const [hasSubscription, setHasSubscription] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if push notifications are supported
    const supported = 'serviceWorker' in navigator && 'PushManager' in window;
    setPushSupported(supported);

    if (supported && 'Notification' in window) {
      setPushPermission(Notification.permission);
    }

    // Check if user already has a push subscription
    checkExistingSubscription();

    // Only show prompt if:
    // 1. User is signed in
    // 2. Push is supported
    // 3. Permission is default (not granted or denied)
    // 4. User doesn't already have a subscription
    // 5. User hasn't dismissed this prompt recently
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
      showToast.error(
        'Not supported',
        'Push notifications are not supported in this browser'
      );
      return;
    }

    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      showToast.error(
        'Configuration error',
        'Push notifications are not properly configured'
      );
      return;
    }

    setIsEnabling(true);

    try {
      // Request permission
      const permission = await Notification.requestPermission();
      setPushPermission(permission);

      if (permission === 'granted') {
        // Register service worker and subscribe
        const registration = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;

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
            "You'll now receive notifications even when the app is closed"
          );
        } else {
          throw new Error('Failed to save subscription');
        }
      } else {
        showToast.error(
          'Permission denied',
          'Push notifications require permission to work properly'
        );
        dismissPrompt();
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

  if (!isVisible || !pushSupported) return null;

  return (
    <Card className='fixed bottom-4 right-4 z-50 w-80 max-w-[calc(100vw-2rem)] border-blue-500/30 bg-gradient-to-br from-blue-900/40 to-indigo-900/40 backdrop-blur-md shadow-2xl'>
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
                <span className='text-xs text-green-400'>Mobile</span>
              </div>
              <div className='flex items-center gap-1'>
                <Monitor className='h-3 w-3 text-green-400' />
                <span className='text-xs text-green-400'>Desktop</span>
              </div>
              <Badge
                variant='outline'
                className='text-xs border-blue-400/30 text-blue-300'
              >
                Free
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
