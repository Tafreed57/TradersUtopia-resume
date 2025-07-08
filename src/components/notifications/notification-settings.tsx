'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { showToast } from '@/lib/notifications-client';
import {
  Bell,
  BellRing,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Gauge,
  MessageSquare,
  Monitor,
  Settings,
  Shield,
  Smartphone,
  Users,
  X,
} from 'lucide-react';

interface NotificationPreferences {
  system: boolean;
  security: boolean;
  payment: boolean;
  messages: boolean;
  mentions: boolean;
  serverUpdates: boolean;
}

interface NotificationSettings {
  push: NotificationPreferences;
}

export function NotificationSettings() {
  const { user } = useUser();
  const [isExpanded, setIsExpanded] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushPermission, setPushPermission] =
    useState<NotificationPermission>('default');
  const [isClient, setIsClient] = useState(false);
  const [hasValidPushSubscription, setHasValidPushSubscription] =
    useState(false);

  const [settings, setSettings] = useState<NotificationSettings>({
    push: {
      system: true,
      security: true,
      payment: true,
      messages: true,
      mentions: true,
      serverUpdates: false,
    },
  });

  // Check if we're on the client side
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Check if push notifications are supported with proper error handling
  useEffect(() => {
    if (!isClient) return;

    try {
      if (typeof window !== 'undefined') {
        // Safely check for service worker and push manager support
        let serviceWorkerSupported = false;
        let pushManagerSupported = false;
        let notificationPermission: NotificationPermission = 'default';

        try {
          serviceWorkerSupported = 'serviceWorker' in navigator;
        } catch (e) {
          console.warn('Service Worker check failed:', e);
        }

        try {
          pushManagerSupported = 'PushManager' in window;
        } catch (e) {
          console.warn('PushManager check failed:', e);
        }

        try {
          if (typeof Notification !== 'undefined' && Notification.permission) {
            notificationPermission = Notification.permission;
          }
        } catch (e) {
          console.warn('Notification permission check failed:', e);
        }

        setPushSupported(serviceWorkerSupported && pushManagerSupported);
        setPushPermission(notificationPermission);
      }
    } catch (error) {
      console.warn(
        'Browser API check failed, disabling push notifications:',
        error
      );
      setPushSupported(false);
      setPushPermission('denied');
    }
  }, [isClient]);

  // Load user preferences
  useEffect(() => {
    if (user && isClient) {
      loadPreferences();
      checkPushSubscriptionStatus();
    }
  }, [user, isClient]);

  const loadPreferences = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/user/notification-preferences');
      if (response.ok) {
        const data = await response.json();
        if (data.preferences) {
          setSettings(data.preferences);
        }
      }
    } catch (error) {
      console.error('Failed to load notification preferences:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const savePreferences = async () => {
    try {
      setIsSaving(true);
      const response = await fetch('/api/user/notification-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences: settings }),
      });

      if (response.ok) {
        showToast.success(
          'Settings saved',
          'Your notification preferences have been updated'
        );
      } else {
        throw new Error('Failed to save preferences');
      }
    } catch (error) {
      console.error('Failed to save notification preferences:', error);
      showToast.error('Error', 'Failed to save notification preferences');
    } finally {
      setIsSaving(false);
    }
  };

  const togglePreference = (
    category: 'push',
    key: keyof NotificationPreferences
  ) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: !prev[category][key],
      },
    }));
  };

  // Utility function to convert base64 VAPID key to Uint8Array with error handling
  const urlBase64ToUint8Array = (base64String: string) => {
    try {
      const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
      const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

      if (typeof window === 'undefined' || typeof window.atob !== 'function') {
        throw new Error('atob is not available');
      }

      const rawData = window.atob(base64);
      const outputArray = new Uint8Array(rawData.length);

      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
      }
      return outputArray;
    } catch (error) {
      console.error('Failed to convert VAPID key:', error);
      throw new Error('Invalid VAPID key format');
    }
  };

  const enablePushNotifications = async () => {
    try {
      if (!pushSupported) {
        showToast.error(
          'Not supported',
          'Push notifications are not supported in this browser'
        );
        return;
      }

      // Check if VAPID key is available
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        console.error('VAPID public key not configured');
        showToast.error(
          'Configuration error',
          'Push notifications are not properly configured'
        );
        return;
      }

      let permission: NotificationPermission = 'default';

      try {
        if (
          typeof Notification !== 'undefined' &&
          Notification.requestPermission
        ) {
          permission = await Notification.requestPermission();
        } else {
          throw new Error('Notification API not available');
        }
      } catch (error) {
        console.error('Failed to request notification permission:', error);
        showToast.error('Error', 'Failed to request notification permission');
        return;
      }

      setPushPermission(permission);

      if (permission === 'granted') {
        try {
          // Register service worker and subscribe to push notifications
          if (!navigator.serviceWorker) {
            throw new Error('Service Worker not available');
          }

          const registration = await navigator.serviceWorker.register('/sw.js');

          // Wait for service worker to be ready
          await navigator.serviceWorker.ready;

          if (!registration.pushManager) {
            throw new Error('Push Manager not available');
          }

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
            setHasValidPushSubscription(true);
            showToast.success(
              'Push notifications enabled',
              'You will now receive push notifications'
            );
          } else {
            const errorData = await response.json();
            console.error('Push subscription API error:', errorData);
            throw new Error(
              errorData.message || 'Failed to save push subscription'
            );
          }
        } catch (error) {
          console.error('Service Worker/Push subscription error:', error);
          showToast.error(
            'Error',
            'Failed to enable push notifications. This feature may not be available on your device.'
          );
        }
      } else {
        showToast.error(
          'Permission denied',
          'Push notifications require permission'
        );
      }
    } catch (error) {
      console.error('Failed to enable push notifications:', error);
      showToast.error('Error', 'Failed to enable push notifications');
    }
  };

  const checkPushSubscriptionStatus = async () => {
    try {
      const response = await fetch('/api/notifications/push/status');
      if (response.ok) {
        const data = await response.json();
        setHasValidPushSubscription(data.hasValidSubscription || false);
      }
    } catch (error) {
      console.error('Failed to check push subscription status:', error);
      setHasValidPushSubscription(false);
    }
  };

  const resetPushNotifications = async () => {
    try {
      // First, unsubscribe from the service worker
      if (navigator.serviceWorker) {
        const registration = await navigator.serviceWorker.ready;
        if (registration.pushManager) {
          const subscription = await registration.pushManager.getSubscription();
          if (subscription) {
            await subscription.unsubscribe();
          }
        }
      }

      // Clear from database
      const response = await fetch('/api/notifications/push/reset', {
        method: 'POST',
      });

      if (response.ok) {
        setHasValidPushSubscription(false);
        showToast.success(
          'Reset complete',
          'Push notifications have been reset. You can now enable them again.'
        );
      } else {
        throw new Error('Failed to reset push notifications');
      }
    } catch (error) {
      console.error('Failed to reset push notifications:', error);
      showToast.error('Error', 'Failed to reset push notifications');
    }
  };

  const notificationTypes = [
    {
      key: 'system' as const,
      title: 'System Notifications',
      description: 'Updates about your account and platform changes',
      icon: Gauge,
      color: 'bg-blue-500',
    },
    {
      key: 'security' as const,
      title: 'Security Alerts',
      description: '2FA, login attempts, and security changes',
      icon: Shield,
      color: 'bg-red-500',
    },
    {
      key: 'payment' as const,
      title: 'Payment & Billing',
      description: 'Subscription updates, payments, and billing alerts',
      icon: CreditCard,
      color: 'bg-green-500',
    },
    {
      key: 'messages' as const,
      title: 'Channel Messages',
      description: 'New channel messages and updates',
      icon: MessageSquare,
      color: 'bg-purple-500',
    },
    {
      key: 'mentions' as const,
      title: 'Mentions & Replies',
      description: 'When someone mentions or replies to you',
      icon: Users,
      color: 'bg-orange-500',
    },
    {
      key: 'serverUpdates' as const,
      title: 'Server Updates',
      description: 'Server announcements and community updates',
      icon: BellRing,
      color: 'bg-indigo-500',
    },
  ];

  // Don't render until we're on the client to prevent hydration mismatches
  if (!isClient) {
    return (
      <div className='w-full'>
        <Card className='border-gray-600/30 bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-md'>
          <CardContent className='flex items-center justify-center py-6'>
            <div className='flex items-center gap-2'>
              <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-400'></div>
              <span>Loading notification settings...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isExpanded) {
    return (
      <Button
        variant='outline'
        size='sm'
        onClick={() => setIsExpanded(true)}
        className='flex items-center gap-2 border-yellow-400/30 text-yellow-300 hover:bg-yellow-500/20 hover:border-yellow-400/50 transition-all duration-300'
      >
        <Settings className='h-4 w-4' />
        View Settings
        <ChevronDown className='h-4 w-4' />
      </Button>
    );
  }

  return (
    <div className='w-full'>
      <Card className='border-gray-600/30 bg-gradient-to-br from-gray-800/40 to-gray-900/40 backdrop-blur-md'>
        <CardHeader className='pb-4'>
          <div className='flex items-center justify-between'>
            <div className='flex items-center gap-3'>
              <div className='w-8 h-8 bg-yellow-500/20 rounded-xl flex items-center justify-center'>
                <Bell className='h-5 w-5 text-yellow-400' />
              </div>
              <CardTitle className='text-xl text-white'>
                Notification Preferences
              </CardTitle>
            </div>
            <Button
              variant='ghost'
              size='sm'
              onClick={() => setIsExpanded(false)}
              className='h-8 w-8 p-0 text-gray-400 hover:text-white'
            >
              <X className='h-4 w-4' />
            </Button>
          </div>
          <CardDescription className='text-gray-300 ml-11'>
            Customize how and when you receive notifications across different
            channels.
            <br />
            <span className='text-xs text-gray-400 mt-1 block'>
              🔔 In-app notifications appear in the bell icon in the header
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-8 px-6 pb-6'>
          {isLoading ? (
            <div className='flex items-center justify-center py-12'>
              <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400'></div>
            </div>
          ) : (
            <>
              {/* Push Notifications Section */}
              <div>
                <div className='flex items-center gap-3 mb-6'>
                  <div className='w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center'>
                    {pushSupported ? (
                      <Smartphone className='h-5 w-5 text-green-400' />
                    ) : (
                      <Monitor className='h-5 w-5 text-green-400' />
                    )}
                  </div>
                  <div>
                    <h3 className='font-semibold text-lg text-white'>
                      Push Notifications
                    </h3>
                    <Badge
                      variant='outline'
                      className={`text-xs mt-1 ${pushPermission === 'granted' && hasValidPushSubscription ? 'border-green-400/30 text-green-300' : 'border-gray-400/30 text-gray-400'}`}
                    >
                      {pushPermission === 'granted' && hasValidPushSubscription
                        ? 'Enabled'
                        : 'Disabled'}
                    </Badge>
                  </div>
                </div>

                {pushPermission !== 'granted' && (
                  <div className='mb-6 p-4 bg-yellow-500/10 border border-yellow-400/30 rounded-xl backdrop-blur-sm'>
                    <div className='flex items-center justify-between'>
                      <div>
                        <p className='text-sm font-medium text-yellow-300'>
                          Push notifications disabled
                        </p>
                        <p className='text-xs text-yellow-400/80 mt-1'>
                          Enable to receive desktop and mobile notifications
                        </p>
                      </div>
                      <Button
                        size='sm'
                        onClick={enablePushNotifications}
                        className='bg-yellow-600 hover:bg-yellow-700 text-white shadow-lg'
                      >
                        Enable
                      </Button>
                    </div>
                  </div>
                )}

                {pushPermission === 'granted' && !hasValidPushSubscription && (
                  <div className='mb-6 p-4 bg-orange-500/10 border border-orange-400/30 rounded-xl backdrop-blur-sm'>
                    <div className='flex items-center justify-between'>
                      <div>
                        <p className='text-sm font-medium text-orange-300'>
                          Push notifications need setup
                        </p>
                        <p className='text-xs text-orange-400/80 mt-1'>
                          Permission granted but subscription not active
                        </p>
                      </div>
                      <Button
                        size='sm'
                        onClick={enablePushNotifications}
                        className='bg-orange-600 hover:bg-orange-700 text-white shadow-lg'
                      >
                        Re-enable
                      </Button>
                    </div>
                  </div>
                )}

                {pushPermission === 'granted' && hasValidPushSubscription && (
                  <div className='mb-6 p-4 bg-green-500/10 border border-green-400/30 rounded-xl backdrop-blur-sm'>
                    <div className='flex items-center justify-between'>
                      <div>
                        <p className='text-sm font-medium text-green-300'>
                          Push notifications active
                        </p>
                        <p className='text-xs text-green-400/80 mt-1'>
                          You'll receive desktop and mobile notifications
                        </p>
                      </div>
                      <Button
                        size='sm'
                        onClick={resetPushNotifications}
                        variant='outline'
                        className='border-green-400/30 text-green-300 hover:bg-green-500/20'
                      >
                        Reset
                      </Button>
                    </div>
                  </div>
                )}

                <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                  {notificationTypes.map(type => {
                    const IconComponent = type.icon;
                    const isDisabled =
                      pushPermission !== 'granted' || !hasValidPushSubscription;
                    return (
                      <div
                        key={`push-${type.key}`}
                        className={`flex items-center justify-between p-4 rounded-xl border border-gray-600/30 bg-gray-800/30 hover:bg-gray-800/50 transition-all duration-300 ${isDisabled ? 'opacity-50' : ''}`}
                      >
                        <div className='flex items-center gap-3'>
                          <div
                            className={`p-2 rounded-lg ${type.color} bg-opacity-10`}
                          >
                            <IconComponent className='h-4 w-4' />
                          </div>
                          <div className='flex-1'>
                            <h4 className='font-medium text-sm text-white'>
                              {type.title}
                            </h4>
                            <p className='text-xs text-gray-400 mt-0.5'>
                              {type.description}
                            </p>
                          </div>
                        </div>
                        <Switch
                          checked={settings.push[type.key]}
                          onCheckedChange={() =>
                            togglePreference('push', type.key)
                          }
                          disabled={isDisabled}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <Separator className='bg-gray-600/30' />

              {/* Save Button - Mobile Optimized */}
              <div className='bg-gray-800/30 rounded-xl p-4 sm:p-6 border border-gray-600/30'>
                <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
                  <div className='text-sm text-gray-300 space-y-2'>
                    <p className='flex items-center gap-2'>
                      <span className='w-2 h-2 bg-green-400 rounded-full'></span>
                      Push:{' '}
                      {Object.values(settings.push).filter(Boolean).length} of{' '}
                      {notificationTypes.length} enabled
                    </p>
                  </div>
                  <div className='flex flex-col-reverse sm:flex-row gap-3 w-full sm:w-auto'>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => setIsExpanded(false)}
                      className='border-gray-600/50 text-gray-300 hover:bg-gray-700/50 h-10 sm:h-8 touch-manipulation w-full sm:w-auto'
                    >
                      <ChevronUp className='h-4 w-4 mr-2' />
                      Collapse
                    </Button>
                    <Button
                      size='sm'
                      onClick={savePreferences}
                      disabled={isSaving}
                      className='bg-gradient-to-r from-yellow-600 to-yellow-700 hover:from-yellow-700 hover:to-yellow-800 text-white shadow-lg h-10 sm:h-8 touch-manipulation font-semibold w-full sm:w-auto min-w-[120px]'
                    >
                      {isSaving ? (
                        <div className='flex items-center gap-2'>
                          <div className='w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin'></div>
                          Saving...
                        </div>
                      ) : (
                        'Save Settings'
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
