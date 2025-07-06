import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/query';
import { getServer } from '@/lib/query';
import { ServerHeader } from '@/components/layout/server-header';
import { Separator } from '@/components/ui/separator';
import { Hash } from 'lucide-react';
import { ChannelType } from '@prisma/client';
import { ServerSearch } from '@/components/server-search';
import { SectionContent } from '@/components/section-content';
import { DragDropProvider } from '@/contexts/drag-drop-provider';

interface ServerSideBarProps {
  serverId: string;
}

const iconMap = {
  [ChannelType.TEXT]: <Hash className='mr-2 h-4 w-4' />,
};

export async function ServerSideBar({ serverId }: ServerSideBarProps) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return redirect('/');
  }

  const server = await getServer(serverId, profile.id);

  if (!server) {
    return redirect('/');
  }

  const role = server?.members?.find(
    member => member.profileId === profile.id
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
        icon: iconMap[channel.type],
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
    <DragDropProvider>
      <div className='flex flex-col h-full text-primary w-full bg-gradient-to-br from-gray-900/95 via-gray-800/90 to-gray-900/95 backdrop-blur-xl border-r border-gray-700/30 overflow-visible'>
        <div className='flex-shrink-0 bg-gradient-to-r from-gray-800/50 to-gray-700/50 backdrop-blur-sm border-b border-gray-600/30 relative z-50 overflow-visible'>
          <ServerHeader server={server} role={role} />
          <div className='px-4 pb-3'>
            <Separator className='h-[1px] bg-gradient-to-r from-transparent via-gray-600/50 to-transparent' />
          </div>
        </div>

        <div className='flex-1 overflow-y-auto overflow-x-visible scrollbar-hide'>
          <div className='pt-3 mb-4 px-4 sticky top-0 bg-gradient-to-b from-gray-900/95 to-transparent backdrop-blur-sm z-40 pb-2 overflow-visible'>
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
