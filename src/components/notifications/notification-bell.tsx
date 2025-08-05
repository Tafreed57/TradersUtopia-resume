'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
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
  MessageSquare,
  UserCheck,
} from 'lucide-react';
import { showToast } from '@/lib/notifications-client';
import { formatDistanceToNow } from 'date-fns';

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
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!isSignedIn) {
      setIsLoading(false);
      return;
    }

    // Prevent multiple rapid calls
    const now = new Date();
    if (lastChecked && now.getTime() - lastChecked.getTime() < 5000) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/notifications', {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
        setLastChecked(new Date());
      } else if (response.status !== 429) {
        console.error('Failed to fetch notifications:', response.status);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
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

  // Get notification icon by type
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'MESSAGE':
      case 'NEW_MESSAGE':
        return <MessageSquare className='w-4 h-4' />;
      case 'MENTION':
        return <UserCheck className='w-4 h-4' />;
      case 'ADMIN_ANNOUNCEMENT':
      case 'SERVER_UPDATE':
        return '📢';
      case 'PAYMENT':
      case 'PAYMENT_FAILED':
        return '💳';
      case 'SUBSCRIPTION_CANCELLED':
        return '❌';
      case 'SUBSCRIPTION_RENEWED':
        return '✅';
      case 'SUBSCRIPTION_PAST_DUE':
        return '⚠️';
      case 'TRIAL_ENDING':
        return '⏰';
      case 'DISCOUNT_APPLIED':
        return '🎉';
      case 'SECURITY':
        return '🔒';
      case 'SYSTEM':
        return '⚙️';
      default:
        return '📔';
    }
  };

  // Parse message notification data from title and message
  const parseMessageNotification = (notification: Notification) => {
    const parsed = {
      serverName: undefined as string | undefined,
      channelName: undefined as string | undefined,
      authorName: undefined as string | undefined,
      messageContent: undefined as string | undefined,
    };

    if (notification.type === 'MESSAGE' || notification.type === 'MENTION') {
      // Extract server and channel from title: "New message in ServerName #channelName"
      const titleMatch = notification.title.match(/in\s+(.+?)\s+#([^)]+)/);
      if (titleMatch) {
        parsed.serverName = titleMatch[1];
        parsed.channelName = titleMatch[2];
      } else {
        // Fallback to channel only: "New message in #channelName"
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
    }

    return parsed;
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read if unread
    if (!notification.read) {
      markAsRead(notification.id);
    }

    // Navigate to actionUrl if available
    if (notification.actionUrl) {
      router.push(notification.actionUrl);
    }

    setIsOpen(false);
  };

  const renderMessageNotification = (
    notification: Notification,
    parsed: ReturnType<typeof parseMessageNotification>
  ) => {
    const isUnread = !notification.read;
    const isMention = notification.type === 'MENTION';

    return (
      <div
        className={`px-3 py-2 mx-1 rounded-lg transition-all duration-200 cursor-pointer border-l-4 ${
          isUnread
            ? isMention
              ? 'bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-400 hover:from-amber-100 hover:to-yellow-100'
              : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-400 hover:from-blue-100 hover:to-indigo-100'
            : 'bg-gray-50/50 border-gray-300 hover:bg-gray-100/70 opacity-75'
        }`}
      >
        <div className='flex items-start gap-2.5'>
          {/* Icon */}
          <div
            className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5 ${
              isUnread
                ? isMention
                  ? 'bg-amber-200 text-amber-700'
                  : 'bg-blue-200 text-blue-700'
                : 'bg-gray-200 text-gray-500'
            }`}
          >
            {getNotificationIcon(notification.type)}
          </div>

          <div className='flex-1 min-w-0'>
            {/* Header with server and channel info */}
            <div className='flex items-center gap-1.5 mb-1'>
              <div className='flex items-center gap-1 text-xs'>
                {parsed.serverName && (
                  <>
                    <Users className='w-3 h-3 text-gray-500' />
                    <span className='font-medium text-gray-700 truncate'>
                      {parsed.serverName}
                    </span>
                    <span className='text-gray-400'>•</span>
                  </>
                )}
                <Hash className='w-3 h-3 text-gray-500' />
                <span className='font-medium text-gray-700 truncate'>
                  {parsed.channelName || 'Unknown Channel'}
                </span>
              </div>
              {isUnread && (
                <div
                  className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${
                    isMention ? 'bg-amber-500' : 'bg-blue-500'
                  }`}
                />
              )}
              {isMention && (
                <span className='text-xs bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded font-medium'>
                  @mention
                </span>
              )}
            </div>

            {/* Author and message content in one line when possible */}
            <div className='space-y-1'>
              <p className='text-sm text-gray-800 line-clamp-2 leading-relaxed break-words'>
                {parsed.authorName && (
                  <span className='font-semibold text-gray-900'>
                    {parsed.authorName}:{' '}
                  </span>
                )}
                {parsed.messageContent || notification.message}
              </p>
            </div>

            {/* Footer with timestamp and action */}
            <div className='flex items-center justify-between mt-1.5'>
              <p className='text-xs text-gray-500'>
                {formatDistanceToNow(new Date(notification.createdAt), {
                  addSuffix: true,
                })}
              </p>

              {notification.actionUrl && (
                <ArrowUpRight className='w-3 h-3 text-gray-400' />
              )}
            </div>
          </div>

          {/* Mark as read button */}
          {isUnread && (
            <Button
              variant='ghost'
              size='sm'
              className='h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/60'
              onClick={e => {
                e.stopPropagation();
                markAsRead(notification.id);
              }}
            >
              <Check className='h-3 w-3' />
            </Button>
          )}
        </div>
      </div>
    );
  };

  const renderOtherNotification = (notification: Notification) => {
    const isUnread = !notification.read;

    // Get notification type colors
    const getNotificationColors = (type: string, unread: boolean) => {
      if (!unread) {
        return {
          bg: 'bg-gray-50/50 border-gray-300 hover:bg-gray-100/70 opacity-75',
          icon: 'bg-gray-200 text-gray-500',
          dot: 'bg-gray-400',
        };
      }

      switch (type) {
        case 'PAYMENT':
        case 'PAYMENT_FAILED':
          return {
            bg: 'bg-gradient-to-r from-emerald-50 to-teal-50 border-emerald-400 hover:from-emerald-100 hover:to-teal-100',
            icon: 'bg-emerald-200 text-emerald-700',
            dot: 'bg-emerald-500',
          };
        case 'SUBSCRIPTION_CANCELLED':
        case 'SUBSCRIPTION_PAST_DUE':
          return {
            bg: 'bg-gradient-to-r from-red-50 to-rose-50 border-red-400 hover:from-red-100 hover:to-rose-100',
            icon: 'bg-red-200 text-red-700',
            dot: 'bg-red-500',
          };
        case 'SUBSCRIPTION_RENEWED':
        case 'DISCOUNT_APPLIED':
          return {
            bg: 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-400 hover:from-green-100 hover:to-emerald-100',
            icon: 'bg-green-200 text-green-700',
            dot: 'bg-green-500',
          };
        case 'TRIAL_ENDING':
          return {
            bg: 'bg-gradient-to-r from-orange-50 to-amber-50 border-orange-400 hover:from-orange-100 hover:to-amber-100',
            icon: 'bg-orange-200 text-orange-700',
            dot: 'bg-orange-500',
          };
        case 'ADMIN_ANNOUNCEMENT':
        case 'SERVER_UPDATE':
          return {
            bg: 'bg-gradient-to-r from-purple-50 to-violet-50 border-purple-400 hover:from-purple-100 hover:to-violet-100',
            icon: 'bg-purple-200 text-purple-700',
            dot: 'bg-purple-500',
          };
        case 'SECURITY':
          return {
            bg: 'bg-gradient-to-r from-indigo-50 to-blue-50 border-indigo-400 hover:from-indigo-100 hover:to-blue-100',
            icon: 'bg-indigo-200 text-indigo-700',
            dot: 'bg-indigo-500',
          };
        default:
          return {
            bg: 'bg-gradient-to-r from-slate-50 to-gray-50 border-slate-400 hover:from-slate-100 hover:to-gray-100',
            icon: 'bg-slate-200 text-slate-700',
            dot: 'bg-slate-500',
          };
      }
    };

    const colors = getNotificationColors(notification.type, isUnread);

    return (
      <div
        className={`px-3 py-2 mx-1 rounded-lg transition-all duration-200 cursor-pointer border-l-4 ${colors.bg}`}
      >
        <div className='flex items-start gap-2.5'>
          <div
            className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5 ${colors.icon}`}
          >
            {getNotificationIcon(notification.type)}
          </div>

          <div className='flex-1 min-w-0'>
            <div className='flex items-center gap-1.5'>
              <h4 className='text-sm font-semibold text-gray-900 truncate'>
                {notification.title}
              </h4>
              {isUnread && (
                <div
                  className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${colors.dot}`}
                />
              )}
            </div>

            <p className='text-sm text-gray-700 mt-0.5 line-clamp-2 leading-relaxed break-words'>
              {notification.message}
            </p>

            <div className='flex items-center justify-between mt-1.5'>
              <p className='text-xs text-gray-500'>
                {formatDistanceToNow(new Date(notification.createdAt), {
                  addSuffix: true,
                })}
              </p>
              {notification.actionUrl && (
                <ArrowUpRight className='w-3 h-3 text-gray-400' />
              )}
            </div>
          </div>

          {isUnread && (
            <Button
              variant='ghost'
              size='sm'
              className='h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/60'
              onClick={e => {
                e.stopPropagation();
                markAsRead(notification.id);
              }}
            >
              <Check className='h-3 w-3' />
            </Button>
          )}
        </div>
      </div>
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

  if (!isLoaded || !isSignedIn) {
    return null;
  }

  return (
    <div className='relative'>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant='ghost'
            size='sm'
            className='relative h-10 w-10 sm:h-12 sm:w-12 p-0'
            title={
              unreadCount > 0
                ? `${unreadCount} unread notification${
                    unreadCount > 1 ? 's' : ''
                  }`
                : 'Notifications'
            }
          >
            {unreadCount > 0 ? (
              <BellRing className='h-5 w-5 sm:h-6 sm:w-6' />
            ) : (
              <Bell className='h-5 w-5 sm:h-6 sm:w-6' />
            )}
            {unreadCount > 0 && (
              <Badge
                variant='destructive'
                className='absolute -top-1 -right-1 h-5 w-5 sm:h-6 sm:w-6 rounded-full p-0 flex items-center justify-center text-xs'
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuPortal>
          <DropdownMenuContent
            align='end'
            className='w-80 sm:w-96 max-w-[90vw] max-h-[85vh] mr-6 sm:mr-4 overflow-hidden pb-2 translate-x-2'
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
                    setLastChecked(null);
                    fetchNotifications();
                  }}
                  disabled={isLoading}
                  className='h-auto p-1 text-xs'
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
                    className='h-auto p-1 sm:p-2 text-xs'
                  >
                    <CheckCheck className='h-3 w-3 sm:h-4 sm:w-4 mr-1' />
                    <span className='hidden sm:inline'>Mark all read</span>
                    <span className='sm:hidden'>Read all</span>
                  </Button>
                )}
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />

            {isLoading ? (
              <div className='p-4 text-center text-sm text-gray-500'>
                <div className='w-6 h-6 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto mb-2' />
                <p>Loading notifications...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className='p-4 text-center text-sm text-gray-500'>
                <Bell className='h-8 w-8 mx-auto mb-2 text-gray-300' />
                <p>No notifications yet</p>
              </div>
            ) : (
              <div className='max-h-64 overflow-y-auto overflow-x-hidden'>
                <div className='px-1 py-2 pb-3 space-y-1'>
                  {notifications.map(notification => (
                    <div
                      key={notification.id}
                      className='group'
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
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenu>
    </div>
  );
}
