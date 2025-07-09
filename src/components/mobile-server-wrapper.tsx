'use client';

import { Hash } from 'lucide-react';
import { ChannelType, MemberRole } from '@prisma/client';
import { Separator } from '@/components/ui/separator';
import { ServerHeader } from '@/components/layout/server-header';
import { ServerSearch } from '@/components/server-search';
import { SectionContent } from '@/components/section-content';
import { DragDropProvider } from '@/contexts/drag-drop-provider';
import { ServerWithMembersWithProfiles } from '@/types/server';

interface MobileServerWrapperProps {
  server: ServerWithMembersWithProfiles;
  role?: MemberRole;
}

export function MobileServerWrapper({
  server,
  role,
}: MobileServerWrapperProps) {
  // Use the exact same logic as desktop ServerSideBar
  const channelsWithoutSection = server.channels.filter(
    channel => !channel.sectionId
  );
  const sectionsWithChannels = server.sections || [];

  const iconMap = {
    [ChannelType.TEXT]: <Hash className='mr-2 h-4 w-4' />,
  };

  const searchData = [
    {
      label: 'Text Channels',
      type: 'channel' as const,
      data: server.channels?.map(channel => ({
        icon: iconMap[channel.type as ChannelType] || iconMap[ChannelType.TEXT],
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

  // Use the EXACT same structure as desktop ServerSideBar
  return (
    <DragDropProvider>
      <div className='flex flex-col h-full text-primary w-full bg-gradient-to-br from-gray-900/95 via-gray-800/90 to-gray-900/95 backdrop-blur-xl border-r border-gray-700/30 overflow-visible'>
        <div className='flex-shrink-0 bg-gradient-to-r from-gray-800/50 to-gray-700/50 backdrop-blur-sm border-b border-gray-600/30 relative z-50 overflow-visible'>
          <ServerHeader server={server} role={role} />
          <div className='px-4 pb-3'>
            <Separator className='h-[1px] bg-gradient-to-r from-transparent via-gray-600/50 to-transparent' />
          </div>
        </div>

        <div className='flex-1 overflow-y-auto overflow-x-visible'>
          <div
            className='pt-3 mb-4 px-4 sticky top-0 bg-gradient-to-b from-gray-900/95 to-transparent backdrop-blur-sm z-40 pb-2 overflow-visible
            safe-top
            pt-6 md:pt-3
            min-h-[4rem] md:min-h-auto
            touch-manipulation'
          >
            <ServerSearch data={searchData} />
          </div>

          <div className='px-4 pb-6 overflow-visible'>
            <Separator className='h-[1px] bg-gradient-to-r from-transparent via-gray-600/50 to-transparent mb-4' />

            <SectionContent
              server={server}
              role={role}
              channelsWithoutSection={channelsWithoutSection}
              sectionsWithChannels={sectionsWithChannels}
            />
          </div>
        </div>
      </div>
    </DragDropProvider>
  );
}
