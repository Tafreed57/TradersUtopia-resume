import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

type ChatPollingProps = {
  queryKey: string;
  pollingInterval?: number;
};

export const useChatPolling = ({
  queryKey,
  pollingInterval = 60000, // ✅ FIX: Increased from 10s to 60s to prevent infinite loops
}: ChatPollingProps) => {
  const queryClient = useQueryClient();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // ✅ FIX: Much more conservative polling to prevent infinite loops
    const setupPolling = () => {
      // Clear any existing interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      // Only poll if page is visible and not in development mode
      if (document.hidden || process.env.NODE_ENV === 'development') {
        return;
      }

      // Much more conservative polling
      intervalRef.current = setInterval(() => {
        // Additional check before invalidating
        if (!document.hidden && document.visibilityState === 'visible') {
          queryClient.invalidateQueries({ queryKey: [queryKey] });
        }
      }, pollingInterval);
    };

    // Initial setup with delay to prevent immediate polling
    setTimeout(setupPolling, 5000);

    // Only listen for visibility changes, not constant polling
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setTimeout(setupPolling, 2000); // Delay before restarting
      } else {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [queryClient, queryKey, pollingInterval]);

  return {
    refetch: () => {
      // Only refetch if not in a polling loop
      if (!intervalRef.current) {
        queryClient.invalidateQueries({ queryKey: [queryKey] });
      }
    },
    forceRefresh: () => {
      // Clear existing interval before forcing refresh
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      queryClient.invalidateQueries({ queryKey: [queryKey] });
    },
  };
};
