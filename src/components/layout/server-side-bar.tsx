'use client';

import { useRouter } from 'next/navigation';
import { useExtendedUser } from '@/hooks/use-extended-user';
import { ServerHeader } from '@/components/layout/server-header';
import { Hash, Loader2 } from 'lucide-react';
import { ChannelType, Role } from '@prisma/client';
import { ServerSearch } from '@/components/server-search';
import { SectionContent } from '@/components/section-content';
import { DragDropProvider } from '@/contexts/drag-drop-provider';
import { ServerWithMembersWithUsers } from '@/types/server';
import { ResizableWrapper } from './resizable-wrapper';
import { useEffect, useState } from 'react';

interface ServerSideBarProps {
  serverId: string;
}

const iconMap = {
  [ChannelType.TEXT]: <Hash className='mr-2 h-4 w-4' />,
};

export function ServerSideBar({ serverId }: ServerSideBarProps) {
  const router = useRouter();
  const {
    isLoaded,
    isSignedIn,
    user,
    hasAccess,
    isLoading: userLoading,
    error: userError,
  } = useExtendedUser();
  const [server, setServer] = useState<ServerWithMembersWithUsers | null>(null);
  const [isLoadingServer, setIsLoadingServer] = useState(true);
  const [serverError, setServerError] = useState<string | null>(null);

  // Handle authentication redirects
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/');
      return;
    }
  }, [isLoaded, isSignedIn, router]);

  // Fetch server data when user is available
  useEffect(() => {
    const fetchServerData = async () => {
      if (!isLoaded || !isSignedIn || !user?.id || userLoading) {
        return;
      }

      if (!hasAccess) {
        router.push('/pricing');
        return;
      }

      try {
        setIsLoadingServer(true);
        setServerError(null);

        const response = await fetch(`/api/servers/${serverId}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache',
          },
        });

        if (!response.ok) {
          if (response.status === 404) {
            router.push('/');
            return;
          }
          throw new Error(`Failed to fetch server: ${response.status}`);
        }

        const serverData = await response.json();
        setServer(serverData);
      } catch (error) {
        console.error('Error fetching server:', error);
        setServerError(
          error instanceof Error ? error.message : 'Failed to load server'
        );
        router.push('/');
      } finally {
        setIsLoadingServer(false);
      }
    };

    fetchServerData();
  }, [
    isLoaded,
    isSignedIn,
    user?.id,
    userLoading,
    hasAccess,
    serverId,
    router,
  ]);

  // Show loading state
  if (!isLoaded || userLoading || isLoadingServer || !server) {
    return (
      <ResizableWrapper>
        <div className='flex items-center justify-center h-full'>
          <Loader2 className='h-6 w-6 animate-spin text-zinc-500' />
        </div>
      </ResizableWrapper>
    );
  }

  // Show error state
  if (userError || serverError) {
    return (
      <ResizableWrapper>
        <div className='flex items-center justify-center h-full p-4'>
          <div className='text-center text-zinc-500'>
            <p>Failed to load server</p>
            <p className='text-sm mt-1'>{userError || serverError}</p>
          </div>
        </div>
      </ResizableWrapper>
    );
  }

  // Early return if no access
  if (!hasAccess) {
    return null;
  }

  const role = server?.members?.find(
    member => member.user.id === user.id
  )?.role;

  const channelsWithoutSection = server.channels.filter(
    channel => !channel.sectionId
  );
  const sectionsWithChannels = server.sections || [];

  const searchData = [
    {
      label: 'Text Channels',
      type: 'channel' as const,
      data: server.channels?.map(channel => ({
        icon: iconMap[channel.type as keyof typeof iconMap],
        id: channel.id,
        name: channel.name,
      })),
    },
    {
      label: 'Sections',
      type: 'section' as const,
      data: sectionsWithChannels?.map(section => ({
        icon: <Hash className='mr-2 h-4 w-4' />,
        id: section.id,
        name: section.name,
      })),
    },
  ];

  return (
    <ResizableWrapper>
      <DragDropProvider>
        <div className='flex-shrink-0 bg-gradient-to-r from-gray-800/50 to-gray-700/50 backdrop-blur-sm border-b border-gray-600/30 relative z-50 overflow-visible'>
          <ServerHeader
            server={server as ServerWithMembersWithUsers}
            role={role as Role}
          />
        </div>

        <div className='flex-1 overflow-y-auto overflow-x-visible'>
          <div className='pt-3 mb-4 px-4 sticky top-0 bg-gradient-to-b from-gray-900/95 to-transparent backdrop-blur-sm z-40 pb-2 overflow-visible touch-manipulation'>
            <ServerSearch data={searchData} />
          </div>

          <div className='px-4 pb-6 overflow-visible'>
            <SectionContent
              server={server}
              role={role as Role}
              channelsWithoutSection={channelsWithoutSection}
              sectionsWithChannels={sectionsWithChannels}
            />
          </div>
        </div>
      </DragDropProvider>
    </ResizableWrapper>
  );
}
