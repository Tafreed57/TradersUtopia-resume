'use client';

import { Bell, BellOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useChannelNotifications } from '@/hooks/use-channel-notifications';
import { ActionTooltip } from '@/components/ui/action-tooltip';

interface ChannelNotificationToggleProps {
  channelId: string;
  channelName: string;
}

export function ChannelNotificationToggle({
  channelId,
  channelName,
}: ChannelNotificationToggleProps) {
  const { isEnabled, isLoading, isInitialLoading, toggleNotifications } =
    useChannelNotifications(channelId);

  if (isInitialLoading) {
    return (
      <div className='flex items-center justify-center w-8 h-8'>
        <Loader2 className='w-4 h-4 animate-spin text-zinc-500' />
      </div>
    );
  }

  return (
    <ActionTooltip
      label={`${isEnabled ? 'Disable' : 'Enable'} notifications for #${channelName}`}
      side='bottom'
    >
      <Button
        variant='ghost'
        size='sm'
        onClick={toggleNotifications}
        disabled={isLoading}
        className='h-8 w-8 p-0 hover:bg-zinc-700 transition-colors duration-200'
      >
        {isLoading ? (
          <Loader2 className='w-4 h-4 animate-spin text-zinc-500' />
        ) : isEnabled ? (
          <Bell className='w-4 h-4 text-zinc-300 hover:text-white transition-colors' />
        ) : (
          <BellOff className='w-4 h-4 text-zinc-500 hover:text-zinc-300 transition-colors' />
        )}
      </Button>
    </ActionTooltip>
  );
}
