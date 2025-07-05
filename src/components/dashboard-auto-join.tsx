'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
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

export function DashboardAutoJoin({
  hasServers,
  userId,
}: DashboardAutoJoinProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [hasAttempted, setHasAttempted] = useState(false);
  const [showRefreshButton, setShowRefreshButton] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [currentPathname, setCurrentPathname] = useState('');

  // Ensure we're on the client side
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Update current pathname when client-side and pathname is available
  useEffect(() => {
    if (isClient && pathname) {
      setCurrentPathname(pathname);
    }
  }, [isClient, pathname]);

  // Add debug function to window for troubleshooting
  useEffect(() => {
    window.clearAutoJoinFlag = (targetUserId?: string) => {
      const userIdToUse = targetUserId || userId;
      if (userIdToUse) {
        const storageKey = `auto-join-attempted-${userIdToUse}`;
        localStorage.removeItem(storageKey);
        console.log(`🧹 Cleared auto-join flag for user: ${userIdToUse}`);
        console.log('You can now refresh the page to trigger auto-join again.');
      } else {
        console.log('❌ No userId provided');
      }
    };
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

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Clear the auto-join flag so it can run again
      if (userId) {
        localStorage.removeItem(`auto-join-attempted-${userId}`);
      }

      // Refresh the page to retry
      window.location.reload();
    } catch (error) {
      console.error('Error refreshing:', error);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const autoJoinServer = async () => {
      // Exit early if user already has servers
      if (hasServers) {
        console.log('✅ User already has servers, skipping auto-join');
        return;
      }

      // Skip auto-join if user is already on dashboard (refreshing page)
      if (currentPathname === '/dashboard') {
        console.log(
          '🚫 User is on dashboard, skipping auto-join (likely a page refresh)'
        );
        return;
      }

      // Check if we've already attempted auto-join for this user
      const storageKey = `auto-join-attempted-${userId}`;
      const alreadyAttempted = localStorage.getItem(storageKey);

      if (alreadyAttempted) {
        console.log('ℹ️ Auto-join already attempted for this user, skipping');
        console.log('💡 To reset: Run clearAutoJoinFlag() in browser console');
        return;
      }

      // Prevent multiple simultaneous attempts
      if (hasAttempted) {
        console.log('⏳ Auto-join already in progress, skipping');
        return;
      }

      setHasAttempted(true);

      try {
        console.log('🚀 Auto-joining new user to default server...');
        console.log('👤 User ID:', userId);
        console.log('📊 Has servers:', hasServers);

        // Mark that we've attempted auto-join for this user
        localStorage.setItem(storageKey, 'true');

        const response = await makeSecureRequest(
          '/api/servers/ensure-default',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        if (!mounted) return;

        const result = await response.json();

        if (result.success && result.server) {
          console.log('✅ Successfully joined server:', result.server.name);
          console.log(`🎉 Joined ${result.serversJoined || 1} servers total`);

          // ✅ IMPROVED: Force page refresh to show servers immediately
          setTimeout(() => {
            window.location.reload();
          }, 500);
        } else {
          console.error('❌ Failed to join default server:', result);
          // Remove the attempted flag if it failed so they can try again
          localStorage.removeItem(storageKey);
          setHasAttempted(false);
        }
      } catch (error) {
        console.error('❌ Error auto-joining server:', error);
        // Remove the attempted flag if it failed so they can try again
        if (userId) {
          localStorage.removeItem(`auto-join-attempted-${userId}`);
        }
        setHasAttempted(false);
      }
    };

    // Only run auto-join if user has no servers and hasn't attempted before
    if (!hasServers && !hasAttempted && userId && isClient) {
      console.log('⚡ Auto-join conditions met, starting in 500ms...');
      // ✅ IMPROVED: Reduced delay from 1500ms to 500ms
      const timeoutId = setTimeout(autoJoinServer, 500);

      return () => {
        mounted = false;
        clearTimeout(timeoutId);
      };
    } else {
      if (hasServers) {
        console.log('ℹ️ User has servers, auto-join not needed');
      }
      if (!userId) {
        console.log('⚠️ No userId provided to auto-join component');
      }
    }

    return () => {
      mounted = false;
    };
  }, [hasServers, hasAttempted, userId, router, currentPathname, isClient]);

  // Render refresh button if servers haven't loaded
  if (showRefreshButton && !hasServers) {
    return (
      <div className='fixed bottom-4 right-4 z-50'>
        <div className='bg-gray-800/90 backdrop-blur-sm border border-gray-600/50 rounded-lg p-4 shadow-xl'>
          <p className='text-sm text-gray-300 mb-2'>
            Servers taking longer than expected?
          </p>
          <Button
            onClick={handleRefresh}
            disabled={isRefreshing}
            size='sm'
            className='w-full bg-blue-600 hover:bg-blue-700'
          >
            {isRefreshing ? (
              <RefreshCw className='w-4 h-4 mr-2 animate-spin' />
            ) : (
              <RefreshCw className='w-4 h-4 mr-2' />
            )}
            {isRefreshing ? 'Refreshing...' : 'Refresh Page'}
          </Button>
        </div>
      </div>
    );
  }

  // This component doesn't render anything normally
  return null;
}
