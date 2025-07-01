import qs from 'query-string';
import { useInfiniteQuery } from '@tanstack/react-query';

interface UseChatQueryProps {
  queryKey: string;
  apiUrl: string;
  paramKey: 'channelId' | 'conversationId';
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
      refetchInterval: 5000, // Poll every 5 seconds for updates
      staleTime: 1000, // Consider data stale after 1 second
    });

  return {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
  };
}
