'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { makeSecureRequest } from '@/lib/csrf-client';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

interface DashboardAutoJoinProps {
  hasServers: boolean;
  userId?: string;
}

// Debug function to clear auto-join flag (can be called from browser console)
declare global {
  interface Window {
    clearAutoJoinFlag: (userId?: string) => void;
  }
}

function DashboardAutoJoinClient({
  hasServers,
  userId,
}: DashboardAutoJoinProps) {
  const router = useRouter();
  const [hasAttempted, setHasAttempted] = useState(false);
  const [showRefreshButton, setShowRefreshButton] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentPath, setCurrentPath] = useState('');

  // Safely get pathname after hydration
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentPath(window.location.pathname);
    }
  }, []);

  // Add debug function to window for troubleshooting
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.clearAutoJoinFlag = (targetUserId?: string) => {
        const userIdToUse = targetUserId || userId;
        if (userIdToUse) {
          const storageKey = `auto-join-attempted-${userIdToUse}`;
          localStorage.removeItem(storageKey);
          console.log(`🧹 Cleared auto-join flag for user: ${userIdToUse}`);
          console.log(
            'You can now refresh the page to trigger auto-join again.'
          );
        } else {
          console.log('❌ No userId provided');
        }
      };
    }
  }, [userId]);

  // Show refresh button if user has no servers after a delay
  useEffect(() => {
    if (!hasServers && userId) {
      const timer = setTimeout(() => {
        setShowRefreshButton(true);
      }, 5000); // Show refresh button after 5 seconds if no servers

      return () => clearTimeout(timer);
    }
  }, [hasServers, userId]);

  // Auto-join logic
  useEffect(() => {
    if (!userId || hasServers || hasAttempted || currentPath !== '/dashboard') {
      return;
    }

    const attemptAutoJoin = async () => {
      try {
        const storageKey = `auto-join-attempted-${userId}`;
        const hasAttemptedBefore = localStorage.getItem(storageKey);

        if (hasAttemptedBefore) {
          console.log('⏭️ Auto-join already attempted for this user');
          return;
        }

        console.log(
          '🔄 [Auto-Join] Attempting to join admin-created servers...'
        );
        setHasAttempted(true);
        localStorage.setItem(storageKey, 'true');

        const response = await makeSecureRequest(
          '/api/servers/ensure-all-users',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        if (response.ok) {
          const result = await response.json();

          if (result.joinedServers && result.joinedServers.length > 0) {
            // Give a moment for the database to update
            setTimeout(() => {
              router.refresh();
            }, 1000);
          }
        } else {
          console.error('❌ [Auto-Join] Failed:', response.status);
        }
      } catch (error) {
        console.error('❌ [Auto-Join] Error:', error);
      }
    };

    attemptAutoJoin();
  }, [userId, hasServers, hasAttempted, currentPath, router]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      router.refresh();
    } finally {
      setTimeout(() => setIsRefreshing(false), 2000);
    }
  };

  if (hasServers || !showRefreshButton) {
    return null;
  }

  return (
    <div className='flex flex-col items-center justify-center p-8 text-center'>
      <div className='mb-4'>
        <h3 className='text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2'>
          No servers found
        </h3>
        <p className='text-gray-600 dark:text-gray-400'>
          If you expected to see servers, try refreshing the page.
        </p>
      </div>

      <Button
        onClick={handleRefresh}
        disabled={isRefreshing}
        className='flex items-center gap-2'
      >
        <RefreshCw
          className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}
        />
        {isRefreshing ? 'Refreshing...' : 'Refresh Page'}
      </Button>
    </div>
  );
}

export function DashboardAutoJoin(props: DashboardAutoJoinProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  return <DashboardAutoJoinClient {...props} />;
}
