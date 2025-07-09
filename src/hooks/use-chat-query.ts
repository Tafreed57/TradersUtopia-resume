import qs from 'query-string';
import { useInfiniteQuery } from '@tanstack/react-query';

interface UseChatQueryProps {
  queryKey: string;
  apiUrl: string;
  paramKey: 'channelId';
  paramValue: string;
}

export function useChatQuery({
  apiUrl,
  paramKey,
  paramValue,
  queryKey,
}: UseChatQueryProps) {
  const fetchMessages = async ({ pageParam = undefined }) => {
    const url = qs.stringifyUrl(
      {
        url: apiUrl,
        query: {
          [paramKey]: paramValue,
          cursor: pageParam,
        },
      },
      { skipNull: true }
    );
    const res = await fetch(url);
    return res.json();
  };

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status } =
    useInfiniteQuery({
      initialPageParam: undefined,
      queryKey: [queryKey],
      queryFn: fetchMessages,
      getNextPageParam: lastPage => lastPage?.nextCursor,
      refetchInterval: 30000, // ✅ FIX: Reduced from 2s to 30s to prevent infinite loops
      staleTime: 10000, // ✅ FIX: Increased from 500ms to 10s to prevent constant refetching
      refetchOnWindowFocus: false, // ✅ FIX: Disabled to prevent cascading refetches
      refetchOnReconnect: true, // ✅ UX: Keep this for genuine reconnections
    });

  return {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
  };
}
