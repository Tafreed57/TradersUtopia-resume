'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { Settings, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ActionTooltip } from '@/components/ui/action-tooltip';
import { useStore } from '@/store/store';

export function TimerAdminButton() {
  const { user, isLoaded } = useUser();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(true);
  const { onOpen } = useStore();

  // Check if user is admin
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!isLoaded || !user) {
        setIsAdmin(false);
        setIsCheckingAdmin(false);
        return;
      }

      try {
        // Check cache first
        const cacheKey = `admin_status_${user.id}`;
        const cached = sessionStorage.getItem(cacheKey);

        if (cached) {
          const { isAdmin: cachedAdmin, timestamp } = JSON.parse(cached);
          // Use cache if it's less than 5 minutes old
          if (Date.now() - timestamp < 5 * 60 * 1000) {
            setIsAdmin(cachedAdmin);
            setIsCheckingAdmin(false);
            return;
          }
        }

        const response = await fetch('/api/admin/check-status', {
          method: 'GET',
          cache: 'no-store',
        });

        if (response.ok) {
          const data = await response.json();
          setIsAdmin(data.isAdmin);

          // Cache the result
          sessionStorage.setItem(
            cacheKey,
            JSON.stringify({
              isAdmin: data.isAdmin,
              timestamp: Date.now(),
            })
          );
        } else {
          setIsAdmin(false);
        }
      } catch (error) {
        console.error('Error checking admin status:', error);
        setIsAdmin(false);
      } finally {
        setIsCheckingAdmin(false);
      }
    };

    checkAdminStatus();
  }, [isLoaded, user]);

  const handleOpenTimerSettings = () => {
    onOpen('timerSettings');
  };

  // Don't render if not loaded, not admin, or still checking
  if (!isLoaded || isCheckingAdmin || !isAdmin) {
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
