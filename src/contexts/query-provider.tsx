'use client';

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export const QueryProvider = ({ children }: { children: React.ReactNode }) => {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // ✅ FIX: More conservative defaults to prevent infinite loops
            staleTime: 30000, // 30 seconds
            refetchInterval: false, // Disable automatic refetching by default
            refetchOnWindowFocus: false, // Disable refetch on window focus
            refetchOnMount: false, // Disable refetch on mount
            refetchOnReconnect: true, // Keep this for genuine reconnections
            retry: 1, // Reduce retry attempts
            retryDelay: 5000, // Longer delay between retries
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};
