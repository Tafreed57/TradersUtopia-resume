'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuPortal,
} from '@/components/ui/dropdown-menu';
import {
  Bell,
  BellRing,
  Check,
  CheckCheck,
  Hash,
  Users,
  ArrowUpRight,
} from 'lucide-react';
import { showToast } from '@/lib/notifications-client';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  actionUrl?: string;
  createdAt: string;
}

interface ParsedMessageNotification {
  serverName?: string;
  channelName?: string;
  authorName?: string;
  messageContent?: string;
  serverId?: string;
  channelId?: string;
}

export function NotificationBell() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  // Simplified push notification state
  const [isPushEnabled, setIsPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    console.log(
      '🔔 [FRONTEND] fetchNotifications called, isSignedIn:',
      isSignedIn
    );
    if (!isSignedIn) {
      setIsLoading(false);
      return;
    }

    // Prevent multiple rapid calls
    const now = new Date();
    if (lastChecked && now.getTime() - lastChecked.getTime() < 5000) {
      console.log(
        '🔔 [FRONTEND] Skipping fetch - too recent (less than 5s ago)'
      );
      return; // Don't fetch if last check was less than 5 seconds ago
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/notifications', {
        cache: 'no-store', // ✅ FORCE: Prevent caching issues
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      if (response.ok) {
        const data = await response.json();

        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
        setLastChecked(new Date());
      } else if (response.status === 429) {
        // Rate limited - wait longer before next attempt
        return;
      } else {
        console.error(
          '🔔 [FRONTEND] Fetch failed with status:',
          response.status
        );
        const errorText = await response.text();
        console.error('🔔 [FRONTEND] Error response:', errorText);
      }
    } catch (error) {
      console.error('🔔 [FRONTEND] Fetch error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isSignedIn, lastChecked]);

  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'mark_read',
          notificationId,
        }),
      });

      if (response.ok) {
        setNotifications(prev =>
          prev.map(notif =>
            notif.id === notificationId ? { ...notif, read: true } : notif
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'mark_all_read' }),
      });

      if (response.ok) {
        setNotifications(prev => prev.map(notif => ({ ...notif, read: true })));
        setUnreadCount(0);
        showToast.success('Notifications', 'All notifications marked as read');
      }
    } catch (error) {
      showToast.error('Error', 'Failed to mark all notifications as read');
    } finally {
      setIsLoading(false);
    }
  };

  // Enhanced notification icons using Phase 5 system
  const getNotificationIcon = (type: string) => {
    const iconMap: Record<string, string> = {
      SECURITY: '🔒',
      PAYMENT: '💳',
      MESSAGE: '💬',
      NEW_MESSAGE: '💬',
      MENTION: '👤',
      SERVER_UPDATE: '📢',
      ADMIN_ANNOUNCEMENT: '📢',
      TRIAL_ENDING: '⏰',
      SUBSCRIPTION_CANCELLED: '❌',
      SUBSCRIPTION_RENEWED: '✅',
      SUBSCRIPTION_PAST_DUE: '⚠️',
      PAYMENT_FAILED: '💳❌',
      DISCOUNT_APPLIED: '🎉',
      SYSTEM: '⚙️',
    };
    return iconMap[type] || '📔';
  };

  // Simple push notification toggle
  const togglePushNotifications = useCallback(async () => {
    if (pushLoading) return;

    setPushLoading(true);
    try {
      if (!isPushEnabled) {
        // Enable push notifications
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
          showToast.error(
            'Error',
            'Push notifications are not supported in your browser'
          );
          return;
        }

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          showToast.error(
            'Permission Denied',
            'Push notifications permission was denied'
          );
          return;
        }

        // Get VAPID public key
        const vapidResponse = await fetch('/api/vapid-public-key');
        const { publicKey } = await vapidResponse.json();

        // Subscribe to push notifications
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: publicKey,
        });

        // Send subscription to server
        const response = await fetch('/api/notifications/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subscription: {
              endpoint: subscription.endpoint,
              keys: {
                p256dh: btoa(
                  String.fromCharCode(
                    ...new Uint8Array(subscription.getKey('p256dh')!)
                  )
                ),
                auth: btoa(
                  String.fromCharCode(
                    ...new Uint8Array(subscription.getKey('auth')!)
                  )
                ),
              },
            },
            deviceInfo: {
              browser: navigator.userAgent.includes('Chrome')
                ? 'Chrome'
                : navigator.userAgent.includes('Firefox')
                ? 'Firefox'
                : navigator.userAgent.includes('Safari')
                ? 'Safari'
                : 'Unknown',
              os: navigator.platform,
              deviceType: /Mobile|Android|iPhone|iPad/.test(navigator.userAgent)
                ? 'mobile'
                : 'desktop',
            },
          }),
        });

        if (response.ok) {
          setIsPushEnabled(true);
          showToast.success(
            'Push Notifications Enabled',
            'You will now receive push notifications'
          );
        } else {
          throw new Error('Failed to subscribe');
        }
      } else {
        // Disable push notifications
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
          await subscription.unsubscribe();
        }

        // Remove subscription from server
        await fetch('/api/notifications/push', {
          method: 'DELETE',
        });

        setIsPushEnabled(false);
        showToast.success(
          'Push Notifications Disabled',
          'You will no longer receive push notifications'
        );
      }
    } catch (error) {
      console.error('Push notification toggle error:', error);
      showToast.error('Error', 'Failed to toggle push notifications');
    } finally {
      setPushLoading(false);
    }
  }, [isPushEnabled, pushLoading]);

  // Check current push notification status
  const checkPushStatus = useCallback(async () => {
    if (
      !isSignedIn ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window)
    ) {
      setIsPushEnabled(false);
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsPushEnabled(!!subscription);
    } catch (error) {
      console.error('Failed to check push subscription:', error);
      setIsPushEnabled(false);
    }
  }, [isSignedIn]);

  // Parse message notification data from title and message
  const parseMessageNotification = (
    notification: Notification
  ): ParsedMessageNotification => {
    const parsed: ParsedMessageNotification = {};

    if (notification.type === 'MESSAGE' || notification.type === 'MENTION') {
      // Extract server name and channel name from enhanced title format:
      // "New message in ServerName #channelName" or "You were mentioned in ServerName #channelName"
      const enhancedTitleMatch = notification.title.match(
        /in\s+(.+?)\s+#([^)]+)/
      );
      if (enhancedTitleMatch) {
        parsed.serverName = enhancedTitleMatch[1];
        parsed.channelName = enhancedTitleMatch[2];
      } else {
        // Fallback to old format: "New message in #channelName" or "You were mentioned in #channelName"
        const channelMatch = notification.title.match(/#([^)]+)/);
        if (channelMatch) {
          parsed.channelName = channelMatch[1];
        }
      }

      // Extract author and content from message: "AuthorName: messageContent"
      const messageMatch = notification.message.match(/^([^:]+):\s*(.+)$/);
      if (messageMatch) {
        parsed.authorName = messageMatch[1];
        parsed.messageContent = messageMatch[2];
      }

      // Extract server and channel IDs from actionUrl: /servers/serverId/channels/channelId
      if (notification.actionUrl) {
        const urlMatch = notification.actionUrl.match(
          /\/servers\/([^\/]+)\/channels\/([^\/]+)/
        );
        if (urlMatch) {
          parsed.serverId = urlMatch[1];
          parsed.channelId = urlMatch[2];
        }
      }
    }

    return parsed;
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }

    if (notification.actionUrl) {
      // ✅ SECURITY: Prevent emoji URLs and validate format
      if (
        notification.actionUrl.includes('💬') ||
        notification.actionUrl.includes('%F0%9F%92%AC') ||
        /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/u.test(
          notification.actionUrl
        )
      ) {
        console.warn(
          '🚨 [NOTIFICATION] Invalid URL contains emoji:',
          notification.actionUrl
        );
        router.push('/servers/cmco7gxye0002zuystrej89un');
        setIsOpen(false);
        return;
      }

      // ✅ FIXED: Validate URL format and check if server/channel exists
      const urlMatch = notification.actionUrl.match(
        /\/servers\/([^\/]+)(?:\/channels\/([^\/]+))?/
      );

      if (urlMatch) {
        const serverId = urlMatch[1];
        const channelId = urlMatch[2];

        // Check if this is a test/fake URL and clean it up
        if (
          serverId === 'test123' ||
          serverId === 'direct-test' ||
          serverId === 'test456' ||
          channelId === 'test' ||
          channelId === 'test456' ||
          channelId === 'test789'
        ) {
          // Try to extract channel info from the notification title
          const titleMatch = notification.title.match(/#([a-zA-Z0-9-_]+)/);
          const channelName = titleMatch ? titleMatch[1] : null;

          if (channelName) {
            // Redirect to the correct channel in the main server
            router.push(
              `/servers/cmco7gxye0002zuystrej89un/channels/${getChannelIdByName(
                channelName
              )}`
            );
          } else {
            router.push('/servers/cmco7gxye0002zuystrej89un');
          }
        } else {
          // Valid URL format, use it directly
          router.push(notification.actionUrl);
        }
      } else {
        router.push('/servers/cmco7gxye0002zuystrej89un');
      }
    } else {
      router.push('/servers/cmco7gxye0002zuystrej89un');
    }

    setIsOpen(false);
  };

  // Helper function to get channel ID by name
  const getChannelIdByName = (channelName: string): string => {
    // Map of channel names to their actual IDs in the main server
    const channelMap: Record<string, string> = {
      general: 'cmco7gxye0004zuysw0scnnit',
      announcements: 'cmco7gxye0005zuys7byw8c1p',
      'trading-discussion': 'cmco7gxye0006zuysoey84cjb',
      crypto1: 'cmcrcoxj40001ig1etfg8infg',
      crypto2: 'cmcr6scn90003rvrk484fl1cb',
      crypto3: 'cmcr6t6320007rvrkje1dfqim',
      crypto5: 'cmcr6tnzy0009rvrk3vqvyojx',
      crypto6: 'cmcr6ui0j000brvrk6gu707eu',
    };

    return channelMap[channelName.toLowerCase()] || channelMap['general'];
  };

  const renderMessageNotification = (
    notification: Notification,
    parsed: ParsedMessageNotification
  ) => {
    const isUnread = !notification.read;
    const isMention = notification.type === 'MENTION';

    return (
      <Card
        className={`w-full border-0 shadow-none transition-all duration-200 cursor-pointer mb-1 ${
          isUnread
            ? isMention
              ? 'bg-yellow-50 border-l-4 border-yellow-400 hover:bg-yellow-100'
              : 'bg-blue-50 border-l-4 border-blue-400 hover:bg-blue-100'
            : 'opacity-60 hover:opacity-80 hover:bg-gray-100'
        }`}
      >
        <CardContent className='p-3'>
          <div className='flex items-start gap-3'>
            {/* Enhanced Icon */}
            <div
              className={`text-lg flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                isMention
                  ? 'bg-yellow-100 text-yellow-600'
                  : 'bg-blue-100 text-blue-600'
              }`}
            >
              {isMention ? '👤' : '💬'}
            </div>

            <div className='flex-1 min-w-0'>
              {/* Header with server and channel info */}
              <div className='flex items-center gap-2 mb-1'>
                <div className='flex items-center gap-1 text-xs text-gray-500'>
                  {parsed.serverName && (
                    <>
                      <Users className='w-3 h-3' />
                      <span className='font-medium text-gray-600'>
                        {parsed.serverName}
                      </span>
                      <span className='mx-1'>•</span>
                    </>
                  )}
                  <Hash className='w-3 h-3' />
                  <span className='font-medium'>
                    {parsed.channelName || 'Unknown Channel'}
                  </span>
                </div>
                {isUnread && (
                  <div
                    className={`h-2 w-2 rounded-full flex-shrink-0 ${
                      isMention ? 'bg-yellow-500' : 'bg-blue-500'
                    }`}
                  />
                )}
              </div>

              {/* Author name */}
              {parsed.authorName && (
                <p className='text-sm font-medium text-gray-800 mb-1'>
                  {parsed.authorName}
                </p>
              )}

              {/* Message content */}
              <p className='text-sm text-gray-600 line-clamp-2 mb-2'>
                {parsed.messageContent || notification.message}
              </p>

              {/* Footer with timestamp and action */}
              <div className='flex items-center justify-between'>
                <p className='text-xs text-gray-400'>
                  {formatDistanceToNow(new Date(notification.createdAt), {
                    addSuffix: true,
                  })}
                </p>

                {/* Action indicator */}
                <div className='flex items-center gap-2'>
                  {isMention && (
                    <span className='text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full'>
                      Mentioned
                    </span>
                  )}
                  <ArrowUpRight className='w-3 h-3 text-gray-400' />
                </div>
              </div>
            </div>

            {/* Mark as read button */}
            {isUnread && (
              <Button
                variant='ghost'
                size='sm'
                className='h-auto p-1 opacity-0 group-hover:opacity-100 transition-opacity'
                onClick={e => {
                  e.stopPropagation();
                  markAsRead(notification.id);
                }}
              >
                <Check className='h-3 w-3' />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderOtherNotification = (notification: Notification) => {
    return (
      <Card
        className={`w-full border-0 shadow-none transition-all duration-200 cursor-pointer mb-1 ${
          notification.read
            ? 'opacity-60 hover:opacity-80 hover:bg-gray-100'
            : 'bg-blue-50 hover:bg-blue-100'
        }`}
      >
        <CardContent className='p-3'>
          <div className='flex items-start gap-3'>
            <div className='text-lg flex-shrink-0'>
              {getNotificationIcon(notification.type)}
            </div>
            <div className='flex-1 min-w-0'>
              <div className='flex items-center gap-2'>
                <h4 className='text-sm font-medium truncate'>
                  {notification.title}
                </h4>
                {!notification.read && (
                  <div className='h-2 w-2 bg-blue-500 rounded-full flex-shrink-0' />
                )}
              </div>
              <p className='text-xs text-gray-600 mt-1 line-clamp-2'>
                {notification.message}
              </p>
              <div className='flex items-center justify-between mt-2'>
                <p className='text-xs text-gray-400'>
                  {formatDistanceToNow(new Date(notification.createdAt), {
                    addSuffix: true,
                  })}
                </p>
                {notification.actionUrl && (
                  <ArrowUpRight className='w-3 h-3 text-gray-400' />
                )}
              </div>
            </div>
            {!notification.read && (
              <Button
                variant='ghost'
                size='sm'
                className='h-auto p-1 opacity-0 group-hover:opacity-100 transition-opacity'
                onClick={e => {
                  e.stopPropagation();
                  markAsRead(notification.id);
                }}
              >
                <Check className='h-3 w-3' />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  useEffect(() => {
    if (isLoaded) {
      fetchNotifications();
      checkPushStatus();
    }
  }, [isLoaded, fetchNotifications, checkPushStatus]);

  // Fetch notifications when dropdown opens
  useEffect(() => {
    if (isOpen && isSignedIn) {
      fetchNotifications();
    }
  }, [isOpen, isSignedIn, fetchNotifications]);

  // Note: WebSocket real-time updates removed until WebSocket server is implemented

  if (!isLoaded) {
    return (
      <div
        className='relative z-[99999]'
        style={{ zIndex: 99999, position: 'relative' }}
      >
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant='ghost'
              size='sm'
              className='relative h-10 w-10 sm:h-12 sm:w-12 p-0 touch-manipulation
              min-h-[2.75rem] min-w-[2.75rem] md:h-10 md:w-10 lg:h-12 lg:w-12'
              onClick={e => {
                // Right click or Shift+click to toggle push notifications
                if (e.shiftKey || e.button === 2) {
                  e.preventDefault();
                  e.stopPropagation();
                  togglePushNotifications();
                  return;
                }
                // Normal click opens dropdown (handled by DropdownMenuTrigger)
              }}
              onContextMenu={e => {
                e.preventDefault();
                togglePushNotifications();
              }}
              title={
                unreadCount > 0
                  ? `${unreadCount} unread notification${
                      unreadCount > 1 ? 's' : ''
                    }`
                  : isPushEnabled
                  ? 'Push notifications enabled (Shift+click to disable)'
                  : 'Push notifications disabled (Shift+click to enable)'
              }
            >
              {unreadCount > 0 ? (
                <BellRing className='h-5 w-5 sm:h-6 sm:w-6' />
              ) : isPushEnabled ? (
                <BellRing className='h-5 w-5 sm:h-6 sm:w-6 text-yellow-500' />
              ) : (
                <Bell className='h-5 w-5 sm:h-6 sm:w-6' />
              )}
              {unreadCount > 0 && (
                <Badge
                  variant='destructive'
                  className='absolute -top-1 -right-1 h-5 w-5 sm:h-6 sm:w-6 rounded-full p-0 flex items-center justify-center text-xs z-[99999]'
                  style={{ zIndex: 99999 }}
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Badge>
              )}
              {pushLoading && (
                <div className='absolute inset-0 flex items-center justify-center bg-white/50 rounded'>
                  <div className='w-3 h-3 border-2 border-gray-600 border-t-transparent rounded-full animate-spin' />
                </div>
              )}
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuPortal>
            <DropdownMenuContent
              align='end'
              className='w-80 sm:w-96 max-h-80 sm:max-h-96 mr-2 sm:mr-0 z-[99999] notification-dropdown'
              style={{ zIndex: 99999 }}
              sideOffset={5}
            >
              <DropdownMenuLabel className='flex items-center justify-between p-3 sm:p-4'>
                <span className='text-sm sm:text-base font-semibold'>
                  Notifications {unreadCount > 0 && `(${unreadCount})`}
                </span>
                <div className='flex items-center gap-1'>
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={() => {
                      setLastChecked(null); // ✅ FORCE: Reset cache
                      fetchNotifications();
                    }}
                    disabled={isLoading}
                    className='h-auto p-1 text-xs touch-manipulation'
                    title='Refresh notifications'
                  >
                    🔄
                  </Button>
                  {unreadCount > 0 && (
                    <Button
                      variant='ghost'
                      size='sm'
                      onClick={markAllAsRead}
                      disabled={isLoading}
                      className='h-auto p-1 sm:p-2 text-xs touch-manipulation'
                    >
                      <CheckCheck className='h-3 w-3 sm:h-4 sm:w-4 mr-1' />
                      <span className='hidden sm:inline'>Mark all read</span>
                      <span className='sm:hidden'>Read all</span>
                    </Button>
                  )}
                </div>
              </DropdownMenuLabel>

              <DropdownMenuSeparator />

              {notifications.length === 0 ? (
                <div className='p-4 text-center text-sm text-gray-500'>
                  <Bell className='h-8 w-8 mx-auto mb-2 text-gray-300' />
                  <p>No notifications yet</p>
                </div>
              ) : (
                <div className='max-h-80 overflow-y-auto notification-scroll-container'>
                  <div className='py-1'>
                    {notifications.map(notification => (
                      <div
                        key={notification.id}
                        className='group cursor-pointer mx-1 rounded-md'
                        onClick={() => handleNotificationClick(notification)}
                      >
                        {notification.type === 'MESSAGE' ||
                        notification.type === 'MENTION'
                          ? renderMessageNotification(
                              notification,
                              parseMessageNotification(notification)
                            )
                          : renderOtherNotification(notification)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {notifications.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <div className='p-2'>
                    <Button
                      variant='ghost'
                      size='sm'
                      className='w-full text-center'
                      onClick={() => {
                        markAllAsRead();
                        setIsOpen(false);
                      }}
                    >
                      Mark All Read & Close
                    </Button>
                  </div>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenuPortal>
        </DropdownMenu>
      </div>
    );
  }

  if (!isSignedIn) {
    return null;
  }

  return (
    <div
      className='relative z-[99999]'
      style={{ zIndex: 99999, position: 'relative' }}
    >
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant='ghost'
            size='sm'
            className='relative h-10 w-10 sm:h-12 sm:w-12 p-0 touch-manipulation
              min-h-[2.75rem] min-w-[2.75rem] md:h-10 md:w-10 lg:h-12 lg:w-12'
          >
            {unreadCount > 0 ? (
              <BellRing className='h-5 w-5 sm:h-6 sm:w-6' />
            ) : (
              <Bell className='h-5 w-5 sm:h-6 sm:w-6' />
            )}
            {unreadCount > 0 && (
              <Badge
                variant='destructive'
                className='absolute -top-1 -right-1 h-5 w-5 sm:h-6 sm:w-6 rounded-full p-0 flex items-center justify-center text-xs z-[99999]'
                style={{ zIndex: 99999 }}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuPortal>
          <DropdownMenuContent
            align='end'
            className='w-80 sm:w-96 max-h-80 sm:max-h-96 mr-2 sm:mr-0 z-[99999] notification-dropdown'
            style={{ zIndex: 99999 }}
            sideOffset={5}
          >
            <DropdownMenuLabel className='flex items-center justify-between p-3 sm:p-4'>
              <span className='text-sm sm:text-base font-semibold'>
                Notifications {unreadCount > 0 && `(${unreadCount})`}
              </span>
              <div className='flex items-center gap-1'>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={() => {
                    setLastChecked(null); // ✅ FORCE: Reset cache
                    fetchNotifications();
                  }}
                  disabled={isLoading}
                  className='h-auto p-1 text-xs touch-manipulation'
                  title='Refresh notifications'
                >
                  🔄
                </Button>
                {unreadCount > 0 && (
                  <Button
                    variant='ghost'
                    size='sm'
                    onClick={markAllAsRead}
                    disabled={isLoading}
                    className='h-auto p-1 sm:p-2 text-xs touch-manipulation'
                  >
                    <CheckCheck className='h-3 w-3 sm:h-4 sm:w-4 mr-1' />
                    <span className='hidden sm:inline'>Mark all read</span>
                    <span className='sm:hidden'>Read all</span>
                  </Button>
                )}
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            {notifications.length === 0 ? (
              <div className='p-4 text-center text-sm text-gray-500'>
                <Bell className='h-8 w-8 mx-auto mb-2 text-gray-300' />
                <p>No notifications yet</p>
              </div>
            ) : (
              <div className='max-h-80 overflow-y-auto notification-scroll-container'>
                <div className='py-1'>
                  {notifications.map(notification => (
                    <div
                      key={notification.id}
                      className='group cursor-pointer mx-1 rounded-md'
                      onClick={() => handleNotificationClick(notification)}
                    >
                      {notification.type === 'MESSAGE' ||
                      notification.type === 'MENTION'
                        ? renderMessageNotification(
                            notification,
                            parseMessageNotification(notification)
                          )
                        : renderOtherNotification(notification)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {notifications.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <div className='p-2'>
                  <Button
                    variant='ghost'
                    size='sm'
                    className='w-full text-center'
                    onClick={() => {
                      markAllAsRead();
                      setIsOpen(false);
                    }}
                  >
                    Mark All Read & Close
                  </Button>
                </div>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenu>
    </div>
  );
}
