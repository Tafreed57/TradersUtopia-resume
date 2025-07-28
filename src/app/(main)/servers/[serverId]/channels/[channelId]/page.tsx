import { ChatHeader } from '@/components/chat/chat-header';
import { ChatInput } from '@/components/chat/chat-input';
import { ChatMessages } from '@/components/chat/chat-messages';
import {
  getChannel,
  getCurrentProfile,
  getMember,
  getServer,
  getAllServers,
} from '@/lib/query';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import {
  MemberWithUserAndRole,
  ServerWithMembersWithUsers,
} from '@/types/server';
import { Role } from '@prisma/client';

interface ChannelIdPageProps {
  params: {
    serverId: string;
    channelId: string;
  };
}

// ✅ SIMPLIFIED: Loading state for text channels only
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

export default async function ChannelIdPage({ params }: ChannelIdPageProps) {
  const user = await getCurrentProfile();
  if (!user) {
    return redirect('/sign-in');
  }

  const channel = await getChannel(params.channelId, user.id);
  const member = await getMember(params.serverId, user.id);

  if (!channel || !member) {
    return redirect('/');
  }

  // Fetch server data for mobile navigation
  const server = await getServer(params.serverId, user.id);
  const servers = await getAllServers(user.id);

  return (
    <Suspense fallback={<ChannelLoadingState />}>
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

        <ChatHeader
          name={channel?.name}
          serverId={channel?.serverId}
          type='channel'
          channelId={channel?.id}
          server={server as ServerWithMembersWithUsers}
          role={member?.role as Role}
          servers={servers?.map(server => ({
            id: server.id,
            name: server.name,
            imageUrl: server.imageUrl || '',
          }))}
        />

        {/* ✅ SIMPLIFIED: Only handle TEXT channels */}
        <div className='flex-1 relative z-10 overflow-visible'>
          <ChatMessages
            chatId={channel.id}
            member={member as MemberWithUserAndRole}
            name={channel.name}
            type='channel'
            apiUrl='/api/messages'
            socketUrl='/api/messages'
            socketQuery={{
              channelId: channel.id,
              serverId: channel.serverId,
            }}
            paramKey='channelId'
            paramValue={channel.id}
          />
        </div>
        <ChatInput
          name={channel.name}
          type='channel'
          apiUrl='/api/messages'
          query={{
            channelId: channel.id,
            serverId: channel.serverId,
          }}
          member={member as MemberWithUserAndRole}
        />
      </div>
    </Suspense>
  );
}
