'use client';

import { TrackRecordItem } from '@/components/track-record/track-record-item';
import { TrackRecordWelcome } from '@/components/track-record/track-record-welcome';
import { useChatScroll } from '@/hooks/use-chat-scroll';
import { useInfiniteQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Loader2, ServerCrash } from 'lucide-react';
import { ElementRef, Fragment, useRef, useMemo } from 'react';
import qs from 'query-string';

const DATE_FORMAT = 'd MMM yyyy, HH:mm';

interface TrackRecordMessage {
  id: string;
  content: string;
  adminId: string;
  fileUrl?: string;
  deleted: boolean;
  createdAt: string;
  updatedAt: string;
  admin: {
    id: string;
    name: string;
    imageUrl?: string;
  };
}

export function TrackRecordMessages() {
  const queryKey = 'track-record-messages';
  const chatRef = useRef<ElementRef<'div'>>(null);
  const bottomRef = useRef<ElementRef<'div'>>(null);

  const fetchMessages = async ({ pageParam = undefined }) => {
    const url = qs.stringifyUrl({
      url: '/api/track-record/messages',
      query: {
        cursor: pageParam,
      },
    });

    const res = await fetch(url);
    return res.json();
  };

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status } =
    useInfiniteQuery({
      initialPageParam: undefined,
      queryKey: [queryKey],
      queryFn: fetchMessages,
      getNextPageParam: lastPage => lastPage?.nextCursor,
      refetchInterval: 60000, // ✅ FIX: Increased from 10s to 60s to prevent infinite loops
      staleTime: 30000, // ✅ FIX: Increased stale time significantly
      refetchOnWindowFocus: false, // ✅ FIX: Keep disabled
      refetchOnMount: false, // ✅ FIX: Disabled to prevent immediate refetch
      refetchOnReconnect: true,
    });

  const latestMessageId = useMemo(() => {
    return (
      data?.pages?.[0]?.items?.[data?.pages?.[0]?.items?.length - 1]?.id || ''
    );
  }, [data?.pages]);

  useChatScroll({
    chatRef,
    bottomRef,
    loadMore: fetchNextPage,
    shouldLoadMore: !isFetchingNextPage && !!hasNextPage,
    latestMessageId: latestMessageId,
  });

  if (status === 'pending') {
    return (
      <div className='flex-1 justify-center flex flex-col items-center p-6 sm:p-8'>
        <div className='flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-600/20 border border-purple-400/30 backdrop-blur-sm mb-4'>
          <Loader2 className='h-8 w-8 text-purple-400 animate-spin' />
        </div>
        <p className='text-sm sm:text-base text-gray-300 text-center font-medium'>
          Loading track record...
        </p>
        <p className='text-xs text-gray-500 text-center mt-1'>
          Fetching the latest trading updates
        </p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className='flex-1 justify-center flex flex-col items-center p-6 sm:p-8'>
        <div className='flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500/20 to-rose-600/20 border border-red-400/30 backdrop-blur-sm mb-4'>
          <ServerCrash className='h-8 w-8 text-red-400' />
        </div>
        <p className='text-sm sm:text-base text-gray-300 text-center font-medium'>
          Failed to load track record
        </p>
        <p className='text-xs text-gray-500 text-center mt-1'>
          There was an error loading the trading updates
        </p>
      </div>
    );
  }

  return (
    <div ref={chatRef} className='flex-1 flex flex-col py-4 overflow-y-auto'>
      {!hasNextPage && <div className='flex-1' />}
      {!hasNextPage && <TrackRecordWelcome />}
      {hasNextPage && (
        <div className='flex justify-center mb-4'>
          {isFetchingNextPage ? (
            <div className='flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-gray-800/50 to-gray-700/50 border border-gray-600/30 backdrop-blur-sm'>
              <Loader2 className='h-4 w-4 text-purple-400 animate-spin' />
              <span className='text-sm text-gray-300 font-medium'>
                Loading...
              </span>
            </div>
          ) : (
            <button
              onClick={() => fetchNextPage()}
              className='group px-4 py-2 rounded-xl bg-gradient-to-r from-gray-800/50 to-gray-700/50 border border-gray-600/30 backdrop-blur-sm hover:from-purple-600/20 hover:to-blue-600/20 hover:border-purple-400/50 transition-all duration-300 text-sm text-gray-300 hover:text-white font-medium hover:shadow-lg hover:shadow-purple-400/10'
            >
              Load previous updates
            </button>
          )}
        </div>
      )}
      <div className='flex flex-col-reverse mt-auto px-2'>
        {data?.pages?.map((group, index) => (
          <Fragment key={index}>
            {group.items.map((message: TrackRecordMessage) => (
              <TrackRecordItem
                key={message.id}
                id={message.id}
                content={message.content}
                admin={message.admin}
                fileUrl={message.fileUrl}
                deleted={message.deleted}
                timestamp={format(new Date(message.createdAt), DATE_FORMAT)}
                isUpdated={message.updatedAt !== message.createdAt}
              />
            ))}
          </Fragment>
        ))}
      </div>
      <div ref={bottomRef}></div>
    </div>
  );
}
