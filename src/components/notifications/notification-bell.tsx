'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuPortal,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
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

    console.log('🔔 [FRONTEND] Starting notification fetch...');
    setIsLoading(true);
    try {
      const response = await fetch('/api/notifications', {
        cache: 'no-store', // ✅ FORCE: Prevent caching issues
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      console.log('🔔 [FRONTEND] Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('🔔 [FRONTEND] Received notifications data:', data);
        console.log(
          '🔔 [FRONTEND] Notifications count:',
          data.notifications?.length || 0
        );
        console.log('🔔 [FRONTEND] Unread count:', data.unreadCount || 0);

        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
        setLastChecked(new Date());
      } else if (response.status === 429) {
        // Rate limited - wait longer before next attempt
        console.log(
          '🔔 [FRONTEND] Notification fetch rate limited, backing off...'
        );
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

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'SECURITY':
        return '🔒';
      case 'PAYMENT':
        return '💳';
      case 'MESSAGE':
        return '💬';
      case 'MENTION':
        return '👤';
      case 'SERVER_UPDATE':
        return '📢';
      case 'SYSTEM':
        return '⚙️';
      default:
        return '📔';
    }
  };

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
    console.log('🔗 [NOTIFICATION] Clicked notification:', notification.title);
    console.log('🔗 [NOTIFICATION] ActionUrl:', notification.actionUrl);

    if (!notification.read) {
      markAsRead(notification.id);
    }

    if (notification.actionUrl) {
      // ✅ FIXED: Validate URL format and check if server/channel exists
      const urlMatch = notification.actionUrl.match(
        /\/servers\/([^\/]+)(?:\/channels\/([^\/]+))?/
      );

      if (urlMatch) {
        const serverId = urlMatch[1];
        const channelId = urlMatch[2];

        console.log(
          '🔗 [NOTIFICATION] Parsed URL - Server:',
          serverId,
          'Channel:',
          channelId
        );

        // Check if this is a test/fake URL and clean it up
        if (
          serverId === 'test123' ||
          serverId === 'direct-test' ||
          serverId === 'test456' ||
          channelId === 'test' ||
          channelId === 'test456' ||
          channelId === 'test789'
        ) {
          console.log(
            '🔗 [NOTIFICATION] Detected invalid test URL, finding correct channel...'
          );

          // Try to extract channel info from the notification title
          const titleMatch = notification.title.match(/#([a-zA-Z0-9-_]+)/);
          const channelName = titleMatch ? titleMatch[1] : null;

          if (channelName) {
            console.log(
              '🔗 [NOTIFICATION] Found channel name in title:',
              channelName
            );
            // Redirect to the correct channel in the main server
            router.push(
              `/servers/cmco7gxye0002zuystrej89un/channels/${getChannelIdByName(channelName)}`
            );
          } else {
            console.log(
              '🔗 [NOTIFICATION] No channel name found, going to main server'
            );
            router.push('/servers/cmco7gxye0002zuystrej89un');
          }
        } else {
          // Valid URL format, use it directly
          console.log('🔗 [NOTIFICATION] Using valid URL...');
          router.push(notification.actionUrl);
        }
      } else {
        console.log(
          '🔗 [NOTIFICATION] Invalid URL format, going to main server'
        );
        router.push('/servers/cmco7gxye0002zuystrej89un');
      }
    } else {
      console.log(
        '🔗 [NOTIFICATION] No actionUrl, redirecting to main server...'
      );
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
    }
  }, [isLoaded, fetchNotifications]);

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
              className='relative h-10 w-10 sm:h-12 sm:w-12 p-0 touch-manipulation'
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
                        // Keep dropdown open and show all notifications functionality
                        console.log(
                          '📋 [NOTIFICATIONS] View All clicked - implementing full notifications page...'
                        );
                        // For now, just mark all as read as a useful action
                        markAllAsRead();
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
            className='relative h-10 w-10 sm:h-12 sm:w-12 p-0 touch-manipulation'
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
                      // Keep dropdown open and show all notifications functionality
                      console.log(
                        '📋 [NOTIFICATIONS] View All clicked - implementing full notifications page...'
                      );
                      // For now, just mark all as read as a useful action
                      markAllAsRead();
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
