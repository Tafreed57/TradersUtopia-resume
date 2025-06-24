"use client";

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { showToast } from '@/lib/notifications-client';
import { 
  Bell, 
  BellRing, 
  Settings, 
  MessageSquare, 
  Shield, 
  CreditCard, 
  Users,
  Gauge,
  X,
  ChevronDown,
  ChevronUp,
  Mail,
  Smartphone,
  Monitor
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
  email: NotificationPreferences;
  push: NotificationPreferences;
}

export function NotificationSettings() {
  const { user } = useUser();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');
  
  const [settings, setSettings] = useState<NotificationSettings>({
    email: {
      system: true,
      security: true,
      payment: true,
      messages: true,
      mentions: true,
      serverUpdates: false,
    },
    push: {
      system: true,
      security: true,
      payment: true,
      messages: true,
      mentions: true,
      serverUpdates: false,
    }
  });

  // Check if push notifications are supported
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setPushSupported('serviceWorker' in navigator && 'PushManager' in window);
      setPushPermission(Notification.permission);
    }
  }, []);

  // Load user preferences
  useEffect(() => {
    if (user) {
      loadPreferences();
    }
  }, [user]);

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
        body: JSON.stringify({ preferences: settings })
      });

      if (response.ok) {
        showToast.success('Settings saved', 'Your notification preferences have been updated');
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

  const togglePreference = (category: 'email' | 'push', key: keyof NotificationPreferences) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: !prev[category][key]
      }
    }));
  };

  // Utility function to convert base64 VAPID key to Uint8Array
  const urlBase64ToUint8Array = (base64String: string) => {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
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
    try {
      if (!pushSupported) {
        showToast.error('Not supported', 'Push notifications are not supported in this browser');
        return;
      }

      // Check if VAPID key is available
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        console.error('VAPID public key not configured');
        showToast.error('Configuration error', 'Push notifications are not properly configured');
        return;
      }

      const permission = await Notification.requestPermission();
      setPushPermission(permission);

      if (permission === 'granted') {
        // Register service worker and subscribe to push notifications
        const registration = await navigator.serviceWorker.register('/sw.js');
        
        // Wait for service worker to be ready
        await navigator.serviceWorker.ready;
        
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
        });

        // Send subscription to backend
        const response = await fetch('/api/notifications/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription })
        });

        if (response.ok) {
          showToast.success('Push notifications enabled', 'You will now receive push notifications');
        } else {
          const errorData = await response.json();
          console.error('Push subscription API error:', errorData);
          throw new Error(errorData.message || 'Failed to save push subscription');
        }
      } else {
        showToast.error('Permission denied', 'Push notifications require permission');
      }
    } catch (error) {
      console.error('Failed to enable push notifications:', error);
      showToast.error('Error', 'Failed to enable push notifications');
    }
  };

  const testEmailNotification = async () => {
    try {
      setIsSaving(true);
      const response = await fetch('/api/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        showToast.success('Test email sent!', 'Check your inbox for the test notification email');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to send test email');
      }
    } catch (error) {
      console.error('Failed to send test email:', error);
      showToast.error('Error', 'Failed to send test email');
    } finally {
      setIsSaving(false);
    }
  };

  const notificationTypes = [
    {
      key: 'system' as const,
      title: 'System Notifications',
      description: 'Updates about your account and platform changes',
      icon: Gauge,
      color: 'bg-blue-500'
    },
    {
      key: 'security' as const,
      title: 'Security Alerts',
      description: '2FA, login attempts, and security changes',
      icon: Shield,
      color: 'bg-red-500'
    },
    {
      key: 'payment' as const,
      title: 'Payment & Billing',
      description: 'Subscription updates, payments, and billing alerts',
      icon: CreditCard,
      color: 'bg-green-500'
    },
    {
      key: 'messages' as const,
      title: 'Direct Messages',
      description: 'New messages and conversation updates',
      icon: MessageSquare,
      color: 'bg-purple-500'
    },
    {
      key: 'mentions' as const,
      title: 'Mentions & Replies',
      description: 'When someone mentions or replies to you',
      icon: Users,
      color: 'bg-orange-500'
    },
    {
      key: 'serverUpdates' as const,
      title: 'Server Updates',
      description: 'Server announcements and community updates',
      icon: BellRing,
      color: 'bg-indigo-500'
    },
  ];

  if (!isExpanded) {
    return (
      <Button 
        variant="outline" 
        size="sm"
        onClick={() => setIsExpanded(true)}
        className="flex items-center gap-2"
      >
        <Settings className="h-3 w-3" />
        View Settings
        <ChevronDown className="h-3 w-3" />
      </Button>
    );
  }

  return (
    <div className="w-full">
      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              <CardTitle className="text-base">Notification Settings</CardTitle>
            </div>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setIsExpanded(false)}
              className="h-6 w-6 p-0"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
          <CardDescription>
            Configure which types of notifications you want to receive. 
            <br />
            <span className="text-xs text-muted-foreground">
              🔔 Notifications appear in the bell icon in the top-right header
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : (
            <>
              {/* Email Notifications Section */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    <h3 className="font-medium">Email Notifications</h3>
                    <Badge variant="outline" className="text-xs">
                      {Object.values(settings.email).filter(Boolean).length} enabled
                    </Badge>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={testEmailNotification}
                    disabled={isSaving}
                    className="text-xs px-2 py-1 h-7"
                  >
                    Test Email
                  </Button>
                </div>
                <div className="space-y-3">
                  {notificationTypes.map((type) => {
                    const IconComponent = type.icon;
                    return (
                      <div key={`email-${type.key}`} className="flex items-center justify-between p-3 rounded-lg border bg-card/30">
                        <div className="flex items-center gap-3">
                          <div className={`p-1.5 rounded-lg ${type.color} bg-opacity-10`}>
                            <IconComponent className="h-3 w-3" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium text-sm">{type.title}</h4>
                            <p className="text-xs text-muted-foreground">
                              {type.description}
                            </p>
                          </div>
                        </div>
                        <Switch
                          checked={settings.email[type.key]}
                          onCheckedChange={() => togglePreference('email', type.key)}
                          size="sm"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <Separator />

              {/* Push Notifications Section */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  {pushSupported ? <Smartphone className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
                  <h3 className="font-medium">Push Notifications</h3>
                  <Badge variant="outline" className="text-xs">
                    {pushPermission === 'granted' ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
                
                {pushPermission !== 'granted' && (
                  <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                          Push notifications disabled
                        </p>
                        <p className="text-xs text-yellow-700 dark:text-yellow-300">
                          Enable to receive desktop and mobile notifications
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={enablePushNotifications}
                        className="bg-yellow-600 hover:bg-yellow-700 text-white"
                      >
                        Enable
                      </Button>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  {notificationTypes.map((type) => {
                    const IconComponent = type.icon;
                    const isDisabled = pushPermission !== 'granted';
                    return (
                      <div key={`push-${type.key}`} className={`flex items-center justify-between p-3 rounded-lg border bg-card/30 ${isDisabled ? 'opacity-50' : ''}`}>
                        <div className="flex items-center gap-3">
                          <div className={`p-1.5 rounded-lg ${type.color} bg-opacity-10`}>
                            <IconComponent className="h-3 w-3" />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium text-sm">{type.title}</h4>
                            <p className="text-xs text-muted-foreground">
                              {type.description}
                            </p>
                          </div>
                        </div>
                        <Switch
                          checked={settings.push[type.key]}
                          onCheckedChange={() => togglePreference('push', type.key)}
                          disabled={isDisabled}
                          size="sm"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <Separator />

              {/* Save Button */}
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  <p>
                    Email: {Object.values(settings.email).filter(Boolean).length} of {notificationTypes.length} enabled
                  </p>
                  <p>
                    Push: {Object.values(settings.push).filter(Boolean).length} of {notificationTypes.length} enabled
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline"
                    size="sm" 
                    onClick={() => setIsExpanded(false)}
                  >
                    <ChevronUp className="h-3 w-3 mr-1" />
                    Collapse
                  </Button>
                  <Button 
                    size="sm"
                    onClick={savePreferences}
                    disabled={isSaving}
                  >
                    {isSaving ? 'Saving...' : 'Save Settings'}
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 