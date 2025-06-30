'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, BellRing, Check, CheckCheck } from 'lucide-react';
import { showToast } from '@/lib/notifications-client';
import { formatDistanceToNow } from 'date-fns';
import { useSocket } from '@/contexts/socket-provider';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  actionUrl?: string;
  createdAt: string;
}

export function NotificationBell() {
  const { user } = useUser();
  const { socket } = useSocket();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [lastFetched, setLastFetched] = useState<number>(0);

  const fetchNotifications = useCallback(
    async (force = false) => {
      if (!user) return;

      // Implement basic caching - don't fetch if we fetched less than 30 seconds ago (unless forced)
      const now = Date.now();
      if (!force && now - lastFetched < 30000) {
        return;
      }

      try {
        const response = await fetch('/api/notifications');
        if (response.ok) {
          const data = await response.json();
          setNotifications(data.notifications);
          setUnreadCount(data.count);
          setLastFetched(now);
        }
      } catch (error) {
        console.error('Failed to fetch notifications:', error);
      }
    },
    [user?.id]
  ); // ✅ FIX: Remove lastFetched from deps to prevent infinite recreations

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

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }

    if (notification.actionUrl) {
      window.location.href = notification.actionUrl;
    }

    setIsOpen(false);
  };

  useEffect(() => {
    if (user) {
      fetchNotifications(true); // Force initial fetch

      // ✅ FIX: Create a stable polling function to prevent memory leaks
      const pollNotifications = () => {
        if (user) {
          // Double-check user is still available
          fetchNotifications(false);
        }
      };

      // Poll for new notifications every 2 minutes (reduced frequency)
      const interval = setInterval(pollNotifications, 120000);

      return () => {
        clearInterval(interval);
        if (process.env.NODE_ENV === 'development') {
          console.log('🧹 [NOTIFICATIONS] Cleaned up polling interval');
        }
      };
    }
  }, [user?.id]); // ✅ FIX: Only depend on user.id to prevent frequent re-creation

  // WebSocket event listeners for real-time notifications
  useEffect(() => {
    if (socket && user) {
      const handleNewNotification = (notification: Notification) => {
        setNotifications(prev => [notification, ...prev]);
        setUnreadCount(prev => prev + 1);

        // Show toast for new notification
        showToast.info(notification.title, notification.message);
      };

      const handleNotificationRead = (notificationId: string) => {
        setNotifications(prev =>
          prev.map(notif =>
            notif.id === notificationId ? { ...notif, read: true } : notif
          )
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      };

      const handleNotificationUpdate = () => {
        // Refresh notifications when server indicates updates
        fetchNotifications(true);
      };

      if (process.env.NODE_ENV === 'development') {
        console.log('🔌 [NOTIFICATIONS] Setting up WebSocket listeners');
      }
      socket.on('notification:new', handleNewNotification);
      socket.on('notification:read', handleNotificationRead);
      socket.on('notification:update', handleNotificationUpdate);

      return () => {
        if (process.env.NODE_ENV === 'development') {
          console.log('🧹 [NOTIFICATIONS] Cleaning up WebSocket listeners');
        }
        socket.off('notification:new', handleNewNotification);
        socket.off('notification:read', handleNotificationRead);
        socket.off('notification:update', handleNotificationUpdate);
      };
    }
  }, [socket?.id, user?.id]); // ✅ FIX: Use stable identifiers instead of object references

  useEffect(() => {
    if (isOpen) {
      fetchNotifications(true); // Force fetch when dropdown opens
    }
  }, [isOpen, fetchNotifications]); // ✅ FIX: Add fetchNotifications to dependencies for correctness

  if (!user) return null;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant='ghost'
          size='sm' className='relative h-10 w-10 sm:h-12 sm:w-12 p-0 touch-manipulation'
        >
          {unreadCount > 0 ? (
            <BellRing className='h-5 w-5 sm:h-6 sm:w-6' />
          ) : (
            <Bell className='h-5 w-5 sm:h-6 sm:w-6' />
          )}
          {unreadCount > 0 && (
            <Badge
              variant='destructive' className='absolute -top-1 -right-1 h-5 w-5 sm:h-6 sm:w-6 rounded-full p-0 flex items-center justify-center text-xs'
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align='end' className='w-72 sm:w-80 max-h-80 sm:max-h-96 mr-2 sm:mr-0'
        sideOffset={5}
      >
        <DropdownMenuLabel className='flex items-center justify-between p-3 sm:p-4'>
          <span className='text-sm sm:text-base font-semibold'>
            Notifications
          </span>
          {unreadCount > 0 && (
            <Button
              variant='ghost'
              size='sm'
              onClick={markAllAsRead}
              disabled={isLoading} className='h-auto p-1 sm:p-2 text-xs touch-manipulation'
            >
              <CheckCheck className='h-3 w-3 sm:h-4 sm:w-4 mr-1' />
              <span className='hidden sm:inline'>Mark all read</span>
              <span className='sm:hidden'>Read all</span>
            </Button>
          )}
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {notifications.length === 0 ? (
          <div className='p-4 text-center text-sm text-gray-500'>
            <Bell className='h-8 w-8 mx-auto mb-2 text-gray-300' />
            <p>No notifications yet</p>
          </div>
        ) : (
          <ScrollArea className='max-h-80'>
            {notifications.map(notification => (
              <DropdownMenuItem
                key={notification.id}
                className='p-0'
                onSelect={() => handleNotificationClick(notification)}
              >
                <Card
                  className={`w-full border-0 shadow-none ${
                    notification.read
                      ? 'opacity-60'
                      : 'bg-blue-50'
                  }`}
                >
                  <CardContent className='p-3'>
                    <div className='flex items-start gap-3'>
                      <div className='text-lg'>
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
                        <p className='text-xs text-gray-400 mt-1'>
                          {formatDistanceToNow(
                            new Date(notification.createdAt),
                            { addSuffix: true }
                          )}
                        </p>
                      </div>
                      {!notification.read && (
                        <Button
                          variant='ghost'
                          size='sm' className='h-auto p-1'
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
              </DropdownMenuItem>
            ))}
          </ScrollArea>
        )}

        {notifications.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className='text-center justify-center'>
              <Button variant='ghost' size='sm' className='w-full'>
                View All Notifications
              </Button>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
