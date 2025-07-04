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
      refetchInterval: 2000, // ✅ PERFORMANCE: Faster polling for new messages (2s instead of 5s)
      staleTime: 500, // ✅ PERFORMANCE: More aggressive cache invalidation (500ms instead of 1s)
      refetchOnWindowFocus: true, // ✅ UX: Refetch when user returns to window
      refetchOnReconnect: true, // ✅ UX: Refetch when connection is restored
    });

  return {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
  };
}
