'use client';

import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ActionTooltip } from '@/components/ui/action-tooltip';
import { useStore } from '@/store/store';
import { useExtendedUser } from '@/hooks/use-extended-user';

export function TimerAdminButton() {
  const { isLoaded, isAdmin, isLoading } = useExtendedUser({
    enableLogging: false,
    checkOnMount: true,
  });
  const { onOpen } = useStore();

  const handleOpenTimerSettings = () => {
    onOpen('timerSettings');
  };

  // Don't render if not loaded, still loading, or not admin
  if (!isLoaded || isLoading || !isAdmin) {
    return null;
  }

  return (
    <ActionTooltip label='Configure Timer Settings' align='center' side='top'>
      <Button
        onClick={handleOpenTimerSettings}
        variant='ghost'
        size='sm'
        className='
          h-8 w-8 p-0 
          bg-gray-700/50 hover:bg-gray-600/70 
          border border-gray-600/30 hover:border-yellow-400/50
          text-gray-300 hover:text-yellow-400
          transition-all duration-200
          backdrop-blur-sm
          touch-manipulation
          ml-2
        '
      >
        <Settings className='w-4 h-4' />
      </Button>
    </ActionTooltip>
  );
}
