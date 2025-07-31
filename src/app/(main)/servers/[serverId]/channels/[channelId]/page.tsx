'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ChatHeader } from '@/components/chat/chat-header';
import { ChatInput } from '@/components/chat/chat-input';
import { ChatMessages } from '@/components/chat/chat-messages';
import { useExtendedUser } from '@/hooks/use-extended-user';
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

export default function ChannelIdPage({ params }: ChannelIdPageProps) {
  const router = useRouter();
  const { isLoaded, user, hasAccess, isAdmin, isLoading } = useExtendedUser();
  const [server, setServer] = useState<ServerWithMembersWithUsers | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  // Extract channel and member from server data
  const channel = server?.channels?.find(c => c.id === params.channelId);
  const member = server?.members?.[0]; // Current user's member data

  // Fetch server data with channel context from API
  useEffect(() => {
    const fetchData = async () => {
      if (!isLoaded || !user) return;

      try {
        setDataLoading(true);

        // Fetch server data with channel context
        const serverResponse = await fetch(
          `/api/servers/${params.serverId}/channels/${params.channelId}`
        );
        if (serverResponse.ok) {
          const serverData = await serverResponse.json();
          setServer(serverData);
        } else {
          router.push('/');
          return;
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        router.push('/');
      } finally {
        setDataLoading(false);
      }
    };

    fetchData();
  }, [isLoaded, user, params.serverId, params.channelId, router]);

  // Handle authentication and access control
  useEffect(() => {
    // Wait for both Clerk and our extended user data to finish loading
    if (!isLoaded || isLoading) return;

    // Redirect to sign-in if not authenticated
    if (!user) {
      router.push('/sign-in');
      return;
    }

    // Only check access control after we're sure user is authenticated and data is loaded
    // Additional safety check: ensure we're not in a loading state for access/admin data
    if (user && !isLoading) {
      // Redirect to pricing if signed in but no access (and not admin)
      if (!hasAccess && !isAdmin) {
        router.push('/pricing');
        return;
      }
    }
  }, [isLoaded, user, hasAccess, isAdmin, isLoading, router]);

  // Show loading state while checking auth
  if (!isLoaded || isLoading) {
    return <ChannelLoadingState />;
  }

  // Don't render if user doesn't have access and isn't admin
  if (!user || (!hasAccess && !isAdmin)) {
    return null;
  }

  // Show loading state while fetching server data
  if (dataLoading) {
    return <ChannelLoadingState />;
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

      <ChatHeader
        name={channel.name}
        serverId={channel.serverId}
        type='channel'
        channelId={channel.id}
        server={server}
        role={member.role as Role}
      />

      {/* ✅ SIMPLIFIED: Only handle TEXT channels */}
      <div className='flex-1 relative z-10 overflow-visible'>
        <ChatMessages
          chatId={channel.id}
          member={member as MemberWithUserAndRole}
          name={channel.name}
          type='channel'
          apiUrl={`/api/servers/${params.serverId}/channels/${params.channelId}/messages`}
          socketUrl={`/api/servers/${params.serverId}/channels/${params.channelId}/messages`}
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
        apiUrl={`/api/servers/${params.serverId}/channels/${params.channelId}/messages`}
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
