'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { useComprehensiveLoading } from './use-comprehensive-loading';

export function useNavigationLoading() {
  const router = useRouter();
  const { startLoading, stopLoading } = useComprehensiveLoading('global');

  const navigateWithLoading = useCallback(
    async (
      path: string,
      options?: {
        message?: string;
        replace?: boolean;
      }
    ) => {
      try {
        const message = options?.message || `Navigating to ${path}...`;
        startLoading(message);

        // Add slight delay to show loading state
        await new Promise(resolve => setTimeout(resolve, 200));

        if (options?.replace) {
          router.replace(path);
        } else {
          router.push(path);
        }
      } catch (error) {
        stopLoading();
        throw error;
      }
    },
    [router, startLoading, stopLoading]
  );

  const prefetchWithLoading = useCallback(
    (path: string) => {
      router.prefetch(path);
    },
    [router]
  );

  return {
    navigate: navigateWithLoading,
    prefetch: prefetchWithLoading,
    router, // Original router for direct access if needed
  };
}
