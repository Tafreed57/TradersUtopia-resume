import { ChatHeader } from '@/components/chat/chat-header';
import { ChatInput } from '@/components/chat/chat-input';
import { ChatMessages } from '@/components/chat/chat-messages';
import { MediaRoom } from '@/components/media-room';
import {
  getChannel,
  getCurrentProfile,
  getGeneralServer,
  getMember,
} from '@/lib/query';
import { cn } from '@/lib/utils';
import { auth } from '@clerk/nextjs/server';
import { ChannelType } from '@prisma/client';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';

interface ChannelIdPageProps {
  params: {
    serverId: string;
    channelId: string;
  };
}

// Loading component for better UX
function ChannelLoadingState() {
  return (
    <div className='bg-gradient-to-br from-gray-900/95 via-gray-800/90 to-gray-900/95 backdrop-blur-xl flex flex-col h-full'>
      <div className='h-16 sm:h-18 border-b border-gray-700/50 bg-gradient-to-r from-gray-800/90 via-gray-700/80 to-gray-800/90 backdrop-blur-xl flex items-center justify-center'>
        <div className='flex items-center gap-3'>
          <Loader2 className='h-5 w-5 animate-spin text-blue-400' />
          <span className='text-gray-300 font-medium'>Loading channel...</span>
        </div>
      </div>
      <div className='flex-1 flex items-center justify-center'>
        <div className='text-center'>
          <div className='w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-600/20 border border-blue-400/30 backdrop-blur-sm flex items-center justify-center mx-auto mb-4'>
            <Loader2 className='h-6 w-6 animate-spin text-blue-400' />
          </div>
          <p className='text-gray-400'>Preparing your channel experience...</p>
        </div>
      </div>
    </div>
  );
}

export default async function ChannelIdPage({ params }: ChannelIdPageProps) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return auth().redirectToSignIn();
  }

  const channel = await getChannel(params.channelId);
  const member = await getMember(params.serverId, profile.id);

  if (!channel || !member) {
    return redirect('/');
  }

  return (
    <Suspense fallback={<ChannelLoadingState />}>
      <div
        className={cn(
          'bg-gradient-to-br from-gray-900/95 via-gray-800/90 to-gray-900/95 backdrop-blur-xl flex flex-col h-full relative overflow-visible',
          (channel.type === ChannelType.VIDEO ||
            channel.type === ChannelType.AUDIO) &&
            'overflow-visible'
        )}
      >
        {/* Enhanced Background Pattern */}
        <div className='absolute inset-0 opacity-5 pointer-events-none'>
          <div className='absolute inset-0 bg-gradient-to-br from-blue-900/20 via-transparent to-purple-900/20' />
          <div className='absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_25%_25%,_rgba(59,130,246,0.1)_0%,_transparent_50%)]' />
          <div className='absolute bottom-0 right-0 w-full h-full bg-[radial-gradient(circle_at_75%_75%,_rgba(147,51,234,0.1)_0%,_transparent_50%)]' />

          {/* Animated background elements */}
          <div className='absolute top-1/4 left-1/3 w-64 h-64 bg-blue-500/3 rounded-full blur-3xl animate-pulse' />
          <div className='absolute bottom-1/3 right-1/4 w-48 h-48 bg-purple-500/3 rounded-full blur-2xl animate-pulse delay-1000' />
        </div>

        {await ChatHeader({
          name: channel?.name,
          serverId: channel?.serverId,
          type: 'channel',
        })}

        {channel.type === ChannelType.TEXT && (
          <>
            <div className='flex-1 relative z-10 overflow-visible'>
              <ChatMessages
                chatId={channel.id}
                member={member}
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
            <div className='relative z-10 bg-gradient-to-br from-gray-900/95 via-gray-800/90 to-gray-900/95 backdrop-blur-xl border-t border-gray-700/30 overflow-visible'>
              <ChatInput
                name={channel.name}
                type='channel'
                apiUrl='/api/messages'
                query={{
                  channelId: channel.id,
                  serverId: channel.serverId,
                }}
                member={member}
              />
            </div>
          </>
        )}

        {channel.type === ChannelType.AUDIO && (
          <div className='flex-1 relative z-10 overflow-visible'>
            <MediaRoom
              chatId={channel.id}
              serverId={params.serverId}
              video={false}
              audio={true}
            />
          </div>
        )}

        {channel.type === ChannelType.VIDEO && (
          <div className='flex-1 relative z-10 overflow-visible'>
            <MediaRoom
              chatId={channel.id}
              serverId={params.serverId}
              video={true}
              audio={true}
            />
          </div>
        )}
      </div>
    </Suspense>
  );
}
