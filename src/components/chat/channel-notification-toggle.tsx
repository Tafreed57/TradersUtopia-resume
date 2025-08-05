'use client';

import { Bell, BellOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useChannelNotifications } from '@/hooks/use-channel-notifications';
import { ActionTooltip } from '@/components/ui/action-tooltip';
import { PushNotificationPrompt } from '@/components/notifications/push-notification-prompt';
import { useState, useEffect } from 'react';

interface ChannelNotificationToggleProps {
  channelId: string;
  channelName: string;
}

// Mobile detection utility
const isMobile = () => {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
};

export function ChannelNotificationToggle({
  channelId,
  channelName,
}: ChannelNotificationToggleProps) {
  const { isEnabled, isLoading, isInitialLoading, toggleNotifications } =
    useChannelNotifications(channelId);

  const [showPushPrompt, setShowPushPrompt] = useState(false);
  const [deviceIsMobile, setDeviceIsMobile] = useState(false);

  useEffect(() => {
    setDeviceIsMobile(isMobile());
  }, []);

  // Handle notification toggle with permission check
  const handleToggleWithPermissionCheck = async () => {
    // If on mobile and trying to enable notifications, check permissions first
    if (deviceIsMobile && !isEnabled) {
      // Check if browser supports notifications
      if ('Notification' in window) {
        const permission = Notification.permission;

        if (permission === 'denied') {
          // Show prompt to help user enable permissions
          setShowPushPrompt(true);
          return;
        } else if (permission === 'default') {
          // Show prompt to request permissions
          setShowPushPrompt(true);
          return;
        }
      } else {
        // Browser doesn't support notifications, show prompt with guidance
        setShowPushPrompt(true);
        return;
      }
    }

    // If permissions are granted or we're disabling notifications, proceed
    await toggleNotifications();
  };

  // Handle when push prompt is dismissed or completed
  const handlePushPromptComplete = () => {
    setShowPushPrompt(false);
    // After the prompt is handled, check if permissions were granted
    // and if so, proceed with the toggle
    if ('Notification' in window && Notification.permission === 'granted') {
      toggleNotifications();
    }
  };

  if (isInitialLoading) {
    return (
      <div className='flex items-center justify-center w-8 h-8'>
        <Loader2 className='w-4 h-4 animate-spin text-zinc-500' />
      </div>
    );
  }

  return (
    <>
      <ActionTooltip
        label={`${
          isEnabled ? 'Disable' : 'Enable'
        } notifications for #${channelName}`}
        side='bottom'
      >
        <Button
          variant='ghost'
          size='sm'
          onClick={handleToggleWithPermissionCheck}
          disabled={isLoading}
          className='h-8 w-8 p-0 hover:bg-zinc-700 transition-colors duration-200'
        >
          {isLoading ? (
            <Loader2 className='w-4 h-4 animate-spin text-zinc-500' />
          ) : isEnabled ? (
            <Bell className='w-4 h-4 text-yellow-400 hover:text-yellow-300 transition-colors fill-current' />
          ) : (
            <BellOff className='w-4 h-4 text-zinc-500 hover:text-zinc-300 transition-colors' />
          )}
        </Button>
      </ActionTooltip>

      <ChannelPushPrompt
        isVisible={showPushPrompt}
        onComplete={handlePushPromptComplete}
      />
    </>
  );
}

// Custom PushNotificationPrompt wrapper for channel notifications
function ChannelPushPrompt({
  isVisible,
  onComplete,
}: {
  isVisible: boolean;
  onComplete: () => void;
}) {
  useEffect(() => {
    if (!isVisible) return;

    // Listen for permission changes
    const checkPermission = () => {
      if ('Notification' in window) {
        const permission = Notification.permission;
        if (permission === 'granted' || permission === 'denied') {
          // Permission was decided, complete the flow
          setTimeout(onComplete, 1000); // Small delay to show success
        }
      }
    };

    // Check immediately
    checkPermission();

    // Set up interval to check permission status
    const interval = setInterval(checkPermission, 1000);

    return () => clearInterval(interval);
  }, [isVisible, onComplete]);

  if (!isVisible) return null;

  return <PushNotificationPrompt />;
}
