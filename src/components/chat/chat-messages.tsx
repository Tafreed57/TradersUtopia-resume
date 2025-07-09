'use client';

import { ChatItem } from '@/components/chat/chat-item';
import { ChatWelcome } from '@/components/chat/chat-welcome';
import { useChatScroll } from '@/hooks/use-chat-scroll';
import { MessagesWithMemberWithProfile } from '@/types/server';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Member } from '@prisma/client';
import { format } from 'date-fns';
import { Loader2, ServerCrash } from 'lucide-react';
import { ElementRef, Fragment, useRef } from 'react';
import qs from 'query-string';
import { sourceChannelMap } from '@/types/database-types';

const DATE_FORMAT = 'd MMM yyyy, HH:mm';

interface ChatMessagesProps {
  name: string;
  member: Member;
  chatId: string;
  apiUrl: string;
  socketUrl: string;
  socketQuery: Record<string, string>;
  paramKey: 'channelId';
  paramValue: string;
  type: 'channel';
}

export function ChatMessages({
  name,
  member,
  chatId,
  apiUrl,
  socketUrl,
  socketQuery,
  paramKey,
  paramValue,
  type,
}: ChatMessagesProps) {
  const queryKey = `chat:${chatId}`;
  const addKey = `chat:${chatId}/messages`;
  const updateKey = `chat:${chatId}/messages:update`;
  const chatRef = useRef<ElementRef<'div'>>(null);
  const bottomRef = useRef<ElementRef<'div'>>(null);

  const isSourceChannel = Object.keys(sourceChannelMap).includes(name);

  const fetchMessages = async ({ pageParam = undefined }) => {
    const url = isSourceChannel
      ? qs.stringifyUrl({
          url: `/api/source-messages/${name}`,
          query: {
            cursor: pageParam,
          },
        })
      : qs.stringifyUrl(
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
      queryKey: [isSourceChannel ? `${queryKey}:source` : queryKey],
      queryFn: fetchMessages,
      getNextPageParam: lastPage => lastPage?.nextCursor,
      refetchInterval: isSourceChannel ? 60000 : 30000, // ✅ FIX: Reduced frequency significantly
      staleTime: 15000, // ✅ FIX: Increased stale time to prevent constant refetching
      refetchOnWindowFocus: false, // ✅ FIX: Disabled to prevent cascading refetches
      refetchOnReconnect: true,
    });

  const latestMessageId =
    data?.pages?.[0]?.items?.[data?.pages?.[0]?.items?.length - 1]?.id;

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
        <div className='flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-600/20 border border-blue-400/30 backdrop-blur-sm mb-4'>
          <Loader2 className='h-8 w-8 text-blue-400 animate-spin' />
        </div>
        <p className='text-sm sm:text-base text-gray-300 text-center font-medium'>
          Loading messages...
        </p>
        <p className='text-xs text-gray-500 text-center mt-1'>
          Please wait while we fetch your messages
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
          Failed to load messages
        </p>
        <p className='text-xs text-gray-500 text-center mt-1'>
          There was an error loading the channel messages
        </p>
      </div>
    );
  }

  return (
    <div ref={chatRef} className='flex-1 flex flex-col py-4 overflow-y-auto'>
      {!hasNextPage && <div className='flex-1' />}
      {!hasNextPage && <ChatWelcome type={type} name={name} />}
      {hasNextPage && (
        <div className='flex justify-center mb-4'>
          {isFetchingNextPage ? (
            <div className='flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-gray-800/50 to-gray-700/50 border border-gray-600/30 backdrop-blur-sm'>
              <Loader2 className='h-4 w-4 text-blue-400 animate-spin' />
              <span className='text-sm text-gray-300 font-medium'>
                Loading...
              </span>
            </div>
          ) : (
            <button
              onClick={() => fetchNextPage()}
              className='group px-4 py-2 rounded-xl bg-gradient-to-r from-gray-800/50 to-gray-700/50 border border-gray-600/30 backdrop-blur-sm hover:from-blue-600/20 hover:to-purple-600/20 hover:border-blue-400/50 transition-all duration-300 text-sm text-gray-300 hover:text-white font-medium hover:shadow-lg hover:shadow-blue-400/10'
            >
              Load previous messages
            </button>
          )}
        </div>
      )}
      <div className='flex flex-col-reverse mt-auto px-2'>
        {data?.pages?.map((group, index) => (
          <Fragment key={index}>
            {group.items.map((message: MessagesWithMemberWithProfile) => (
              <ChatItem
                key={message.id}
                id={message.id}
                currentMember={member}
                member={message.member}
                isUpdated={message.updatedAt !== message.createdAt}
                content={message.content}
                fileUrl={message.fileUrl}
                deleted={message.deleted}
                timestamp={format(new Date(message.createdAt), DATE_FORMAT)}
                socketUrl={socketUrl}
                socketQuery={socketQuery}
              />
            ))}
          </Fragment>
        ))}
      </div>
      <div ref={bottomRef}></div>
    </div>
  );
}
