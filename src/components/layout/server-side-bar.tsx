'use client';

import { useExtendedUser } from '@/contexts/session-provider';
import {
  useServerData,
  useCurrentMember,
} from '@/contexts/server-data-provider';
import { ServerHeader } from '@/components/layout/server-header';
import { Hash, Loader2 } from 'lucide-react';
import { ChannelType, Role } from '@prisma/client';
import { ServerSearch } from '@/components/server-search';
import { SectionContent } from '@/components/section-content';
import { DragDropProvider } from '@/contexts/drag-drop-provider';
import { ServerWithMembersWithUsers } from '@/types/server';
import { ResizableWrapper } from './resizable-wrapper';

interface ServerSideBarProps {
  serverId: string;
  onChannelClick?: (channelId: string) => void;
  activeChannelId?: string | null;
}

const iconMap = {
  [ChannelType.TEXT]: <Hash className='mr-2 h-4 w-4' />,
};

export function ServerSideBar({
  serverId,
  onChannelClick,
  activeChannelId,
}: ServerSideBarProps) {
  const {
    server,
    isLoading: serverLoading,
    error: serverError,
  } = useServerData();
  const member = useCurrentMember();
  const {
    hasAccess,
    isLoading: userLoading,
    error: userError,
  } = useExtendedUser();

  // Show loading state
  if (userLoading || serverLoading) {
    return (
      <ResizableWrapper>
        <div className='flex items-center justify-center h-full'>
          <Loader2 className='h-6 w-6 animate-spin text-zinc-500' />
        </div>
      </ResizableWrapper>
    );
  }

  // Show error state
  if (userError || serverError || !server) {
    return (
      <ResizableWrapper>
        <div className='flex items-center justify-center h-full p-4'>
          <div className='text-center text-zinc-500'>
            <p>Failed to load server</p>
            <p className='text-sm mt-1'>
              {userError || serverError || 'Server not found'}
            </p>
          </div>
        </div>
      </ResizableWrapper>
    );
  }

  // Early return if no access
  if (!hasAccess) {
    return null;
  }

  const role = member?.role;

  // All channels are now under sections - simplified structure
  const sectionsWithChannels =
    server.sections?.map(section => ({
      ...section,
      channels: server.channels.filter(ch => ch.sectionId === section.id),
    })) || [];

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
            <ServerSearch data={searchData} onChannelClick={onChannelClick} />
          </div>

          <div className='px-4 pb-6 overflow-visible'>
            <SectionContent
              server={server}
              role={role as Role}
              sectionsWithChannels={sectionsWithChannels}
              onChannelClick={onChannelClick}
              activeChannelId={activeChannelId}
            />
          </div>
        </div>
      </DragDropProvider>
    </ResizableWrapper>
  );
}
