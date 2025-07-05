import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

type ChatPollingProps = {
  queryKey: string;
  pollingInterval?: number;
};

export const useChatPolling = ({
  queryKey,
  pollingInterval = 10000, // ✅ PERFORMANCE: Reduced from 3s to 10s for better performance
}: ChatPollingProps) => {
  const queryClient = useQueryClient();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // ✅ PERFORMANCE: Smart polling that adapts based on page visibility
    const setupPolling = () => {
      // Clear any existing interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      // Adjust polling based on page visibility
      const isVisible = !document.hidden;
      const adjustedInterval = isVisible
        ? pollingInterval
        : pollingInterval * 3; // Slower when hidden

      intervalRef.current = setInterval(() => {
        // Only poll if the page is still visible or it's been a while
        if (!document.hidden || Date.now() % (pollingInterval * 3) === 0) {
          queryClient.invalidateQueries({ queryKey: [queryKey] });
        }
      }, adjustedInterval);
    };

    // Initial setup
    setupPolling();

    // ✅ PERFORMANCE: Adjust polling when page visibility changes
    const handleVisibilityChange = () => {
      setupPolling(); // Restart with appropriate interval
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
    // Return any additional utilities if needed
    refetch: () => queryClient.invalidateQueries({ queryKey: [queryKey] }),
    // ✅ PERFORMANCE: Manual trigger for immediate updates
    forceRefresh: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      // Reset polling interval to give immediate feedback
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = setInterval(() => {
          queryClient.invalidateQueries({ queryKey: [queryKey] });
        }, pollingInterval);
      }
    },
  };
};
