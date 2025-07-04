'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { makeSecureRequest } from '@/lib/csrf-client';

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
  const [hasAttempted, setHasAttempted] = useState(false);

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

  useEffect(() => {
    let mounted = true;

    const autoJoinServer = async () => {
      // Exit early if user already has servers
      if (hasServers) {
        console.log('✅ User already has servers, skipping auto-join');
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

          // Get the first channel and redirect there
          const firstChannel = result.server.channels?.[0];

          if (firstChannel) {
            console.log('🎯 Redirecting to channel:', firstChannel.name);
            router.push(
              `/servers/${result.server.id}/channels/${firstChannel.id}`
            );
          } else {
            console.log('🎯 Redirecting to server:', result.server.id);
            router.push(`/servers/${result.server.id}`);
          }
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
    if (!hasServers && !hasAttempted && userId) {
      console.log('⚡ Auto-join conditions met, starting in 1.5 seconds...');
      // Small delay to ensure the component is mounted and data is stable
      const timeoutId = setTimeout(autoJoinServer, 1500);

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
  }, [hasServers, hasAttempted, userId, router]);

  // This component doesn't render anything
  return null;
}
