'use client';

import { useState, useEffect } from 'react';
import { ChatHeader } from '@/components/chat/chat-header';
import { ChatInput } from '@/components/chat/chat-input';
import { ChatMessages } from '@/components/chat/chat-messages';
import {
  useServerData,
  useCurrentMember,
} from '@/contexts/server-data-provider';
import { useExtendedUser } from '@/contexts/session-provider';
import { MemberWithUserAndRole } from '@/types/server';
import { Role } from '@prisma/client';
import { Loader2 } from 'lucide-react';

interface ChannelContentProps {
  channelId: string | null;
  serverId: string;
  onChannelClick?: (channelId: string) => void;
  activeChannelId?: string | null;
}

function ChannelLoadingState() {
  return (
    <div className='bg-gradient-to-br from-gray-900/95 via-gray-800/90 to-gray-900/95 backdrop-blur-xl flex flex-col h-full'>
      <div className='h-12 border-b border-gray-700/30 flex items-center px-4'>
        <div className='w-6 h-6 bg-gray-600/50 rounded animate-pulse mr-2' />
        <div className='w-32 h-4 bg-gray-600/50 rounded animate-pulse' />
      </div>
      <div className='flex-1 flex items-center justify-center'>
        <div className='w-8 h-8 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin' />
      </div>
    </div>
  );
}

function NoChannelState() {
  return (
    <div className='bg-gradient-to-br from-gray-900/95 via-gray-800/90 to-gray-900/95 backdrop-blur-xl flex flex-col h-full items-center justify-center'>
      <div className='text-center'>
        <div className='w-16 h-16 bg-gray-600/20 rounded-full flex items-center justify-center mb-4 mx-auto'>
          <span className='text-2xl text-gray-400'>#</span>
        </div>
        <h3 className='text-xl font-semibold text-gray-300 mb-2'>
          Welcome to the server!
        </h3>
        <p className='text-gray-400 text-sm'>
          Select a channel from the sidebar to start chatting.
        </p>
      </div>
    </div>
  );
}

function MessageLoadingState() {
  return (
    <div className='flex-1 flex items-center justify-center relative z-10'>
      <div className='text-center'>
        <Loader2 className='w-8 h-8 text-blue-400 rounded-full animate-spin mx-auto mb-4' />
        <p className='text-gray-400 text-sm'>Loading messages...</p>
      </div>
    </div>
  );
}

export function ChannelContent({
  channelId,
  serverId,
  onChannelClick,
  activeChannelId,
}: ChannelContentProps) {
  const {
    server,
    isLoading: serverLoading,
    error: serverError,
  } = useServerData();
  const member = useCurrentMember();
  const { isLoaded, user, hasAccess, isAdmin, isLoading } = useExtendedUser();
  const [shouldLoadMessages, setShouldLoadMessages] = useState(false);

  // Find the channel from server data
  const channel = server?.channels?.find(c => c.id === channelId);

  // Load messages after channel selection with a small delay for smooth UX
  useEffect(() => {
    setShouldLoadMessages(false);
    if (channelId && channel) {
      const timer = setTimeout(() => {
        setShouldLoadMessages(true);
      }, 100); // Small delay allows header to render first

      return () => clearTimeout(timer);
    }
  }, [channelId, channel]);

  // Show loading state while checking auth or loading server
  if (!isLoaded || isLoading || serverLoading) {
    return <ChannelLoadingState />;
  }

  // Don't render if user doesn't have access and isn't admin
  if (!user || (!hasAccess && !isAdmin)) {
    return null;
  }

  // Show error state for server errors
  if (serverError) {
    return (
      <div className='bg-gradient-to-br from-gray-900/95 via-gray-800/90 to-gray-900/95 backdrop-blur-xl flex flex-col h-full items-center justify-center'>
        <div className='text-center'>
          <p className='text-red-400 mb-2'>Failed to load server</p>
          <p className='text-gray-400 text-sm'>{serverError}</p>
        </div>
      </div>
    );
  }

  // No channel selected
  if (!channelId) {
    return <NoChannelState />;
  }

  // Handle channel not found
  if (server && !channel) {
    return (
      <div className='bg-gradient-to-br from-gray-900/95 via-gray-800/90 to-gray-900/95 backdrop-blur-xl flex flex-col h-full items-center justify-center'>
        <div className='text-center'>
          <p className='text-orange-400 mb-2'>Channel not found</p>
          <p className='text-gray-400 text-sm'>
            This channel may have been deleted or you don't have access to it.
          </p>
        </div>
      </div>
    );
  }

  // Don't render if required data isn't loaded
  if (!server || !channel || !member) {
    return <ChannelLoadingState />;
  }

  return (
    <div className='bg-gradient-to-br from-gray-900/95 via-gray-800/90 to-gray-900/95 backdrop-blur-xl flex flex-col h-full relative overflow-visible'>
      {/* Enhanced Background Pattern */}
      <div className='absolute inset-0 opacity-5 pointer-events-none'>
        <div className='absolute inset-0 bg-gradient-to-br from-blue-900/20 via-transparent to-purple-900/20' />
        <div className='absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_25%_25%,_rgba(59,130,246,0.1)_0%,_transparent_50%)]' />
        <div className='absolute bottom-0 right-0 w-full h-full bg-[radial-gradient(circle_at_75%_75%,_rgba(147,51,234,0.1)_0%,_transparent_50%)]' />

        {/* Animated background elements */}
        <div className='absolute top-1/4 left-1/3 w-64 h-64 bg-blue-500/3 rounded-full blur-3xl animate-pulse' />
        <div className='absolute bottom-1/3 right-1/4 w-48 h-48 bg-purple-500/3 rounded-full blur-2xl animate-pulse delay-1000' />
      </div>

      {/* Header renders instantly from cached server data */}
      <ChatHeader
        name={channel.name}
        serverId={channel.serverId}
        type='channel'
        channelId={channel.id}
        server={server}
        role={member.role as Role}
        onChannelClick={onChannelClick}
        activeChannelId={activeChannelId}
      />

      {/* Messages Section */}
      <div className='flex-1 relative z-10 overflow-visible'>
        {shouldLoadMessages ? (
          <ChatMessages
            chatId={channel.id}
            member={member as MemberWithUserAndRole}
            name={channel.name}
            type='channel'
            apiUrl={`/api/servers/${serverId}/channels/${channelId}/messages`}
            socketUrl={`/api/servers/${serverId}/channels/${channelId}/messages`}
            socketQuery={{
              channelId: channel.id,
              serverId: channel.serverId,
            }}
            paramKey='channelId'
            paramValue={channel.id}
          />
        ) : (
          <MessageLoadingState />
        )}
      </div>

      {/* Chat Input */}
      <ChatInput
        name={channel.name}
        type='channel'
        apiUrl={`/api/servers/${serverId}/channels/${channelId}/messages`}
        query={{
          channelId: channel.id,
          serverId: channel.serverId,
        }}
        member={member as MemberWithUserAndRole}
        isAdmin={isAdmin}
      />
    </div>
  );
}
