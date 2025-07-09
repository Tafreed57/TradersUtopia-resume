'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { secureAxiosGet } from '@/lib/csrf-client';

interface UseRealTimeSyncProps {
  serverId: string;
  enabled?: boolean;
  pollInterval?: number;
}

interface ServerData {
  sections: any[];
  channels: any[];
  lastModified: string;
}

export function useRealTimeSync({
  serverId,
  enabled = true,
  pollInterval = 30000, // ✅ FIX: Increased from 5s to 30s to prevent infinite loops
}: UseRealTimeSyncProps) {
  const [serverData, setServerData] = useState<ServerData | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastModifiedRef = useRef<string>('');

  const fetchServerData = useCallback(async () => {
    if (!serverId || !enabled) return; // ✅ FIX: Removed isPolling dependency to break circular loop

    // Use a local variable to prevent race conditions
    const isCurrentlyPolling = isPolling;
    if (isCurrentlyPolling) return;

    try {
      setIsPolling(true);

      const response = await secureAxiosGet(
        `/api/servers/${serverId}/mobile-data`,
        {
          headers: {
            'If-Modified-Since': lastModifiedRef.current,
          },
        }
      );

      if (response.data && response.data.lastModified) {
        const newLastModified = response.data.lastModified;

        // Only update if data has actually changed
        if (newLastModified !== lastModifiedRef.current) {
          setServerData(response.data);
          lastModifiedRef.current = newLastModified;
          setLastSyncTime(new Date());
        }
      }
    } catch (error: any) {
      // Handle different error types gracefully
      if (error?.response?.status === 304) {
        // 304 Not Modified - this is normal, no action needed
      } else if (error?.response?.status === 429) {
        // Rate limited - increase polling interval significantly
        setTimeout(() => {
          if (enabled) fetchServerData();
        }, 60000); // ✅ FIX: Wait 60 seconds instead of 10
      } else {
        console.error('📡 Real-time sync error:', error);
      }
    } finally {
      setIsPolling(false);
    }
  }, [serverId, enabled]); // ✅ FIX: Removed isPolling dependency to break circular loop

  // Start polling when component mounts
  useEffect(() => {
    if (!enabled || !serverId) return;

    // ✅ FIX: Delay initial fetch to prevent immediate polling
    const initialTimer = setTimeout(() => {
      fetchServerData();
    }, 2000);

    // Set up polling interval with much longer delay
    intervalRef.current = setInterval(() => {
      // Only poll if page is visible
      if (!document.hidden && document.visibilityState === 'visible') {
        fetchServerData();
      }
    }, pollInterval);

    return () => {
      clearTimeout(initialTimer);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fetchServerData, pollInterval, enabled, serverId]);

  // Force sync function for manual updates
  const forceSync = useCallback(() => {
    // ✅ FIX: Use functional approach to avoid dependency on isPolling
    fetchServerData();
  }, [fetchServerData]);

  // Pause/resume sync
  const pauseSync = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const resumeSync = useCallback(() => {
    if (!intervalRef.current && enabled) {
      intervalRef.current = setInterval(() => {
        if (!document.hidden && document.visibilityState === 'visible') {
          fetchServerData();
        }
      }, pollInterval);
    }
  }, [fetchServerData, pollInterval, enabled]); // ✅ FIX: Removed isPolling dependency

  return {
    serverData,
    isPolling,
    lastSyncTime,
    forceSync,
    pauseSync,
    resumeSync,
  };
}
