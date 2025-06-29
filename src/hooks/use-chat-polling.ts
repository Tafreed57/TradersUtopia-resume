import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

type ChatPollingProps = {
  queryKey: string;
  pollingInterval?: number;
};

export const useChatPolling = ({
  queryKey,
  pollingInterval = 3000, // Poll every 3 seconds
}: ChatPollingProps) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    // Set up polling for real-time updates
    const interval = setInterval(() => {
      // Invalidate the query to trigger a refetch
      queryClient.invalidateQueries({ queryKey: [queryKey] });
    }, pollingInterval);

    return () => {
      clearInterval(interval);
    };
  }, [queryClient, queryKey, pollingInterval]);

  return {
    // Return any additional utilities if needed
    refetch: () => queryClient.invalidateQueries({ queryKey: [queryKey] }),
  };
};
