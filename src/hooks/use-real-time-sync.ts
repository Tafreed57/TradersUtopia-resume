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
  pollInterval = 5000, // 5 seconds
}: UseRealTimeSyncProps) {
  const [serverData, setServerData] = useState<ServerData | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastModifiedRef = useRef<string>('');

  const fetchServerData = useCallback(async () => {
    if (!serverId || !enabled) return;

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
          console.log('📡 Server data updated, syncing locally');
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
        // Rate limited - increase polling interval temporarily
        console.log('📡 Rate limited, backing off...');
        setTimeout(() => {
          fetchServerData();
        }, 10000); // Wait 10 seconds before retry
      } else {
        console.error('📡 Real-time sync error:', error);
      }
    } finally {
      setIsPolling(false);
    }
  }, [serverId, enabled]);

  // Start polling when component mounts
  useEffect(() => {
    if (!enabled || !serverId) return;

    // Initial fetch
    fetchServerData();

    // Set up polling interval
    intervalRef.current = setInterval(fetchServerData, pollInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fetchServerData, pollInterval, enabled, serverId]);

  // Force sync function for manual updates
  const forceSync = useCallback(() => {
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
      intervalRef.current = setInterval(fetchServerData, pollInterval);
    }
  }, [fetchServerData, pollInterval, enabled]);

  return {
    serverData,
    isPolling,
    lastSyncTime,
    forceSync,
    pauseSync,
    resumeSync,
  };
}
