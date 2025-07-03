import { ServerHeader } from '@/components/layout/server-header';
import { SideBarItem } from '@/components/layout/side-bar-item';
import { ServerChannel } from '@/components/server-channel';
import { ServerSearch } from '@/components/server-search';
import { ServerSection } from '@/components/server-section';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { SubscriptionProtectedLink } from '@/components/subscription-protected-link';
import { getCurrentProfile, getServer } from '@/lib/query';
import { ChannelType, MemberRole } from '@prisma/client';
import { Hash, Mic, ShieldAlert, ShieldCheck, Video } from 'lucide-react';
import { redirect } from 'next/navigation';

interface ServerSideBarProps {
  serverId: string;
}

const iconMap = {
  [ChannelType.TEXT]: <Hash className='mr-2 h-4 w-4' />,
  [ChannelType.AUDIO]: <Mic className='mr-2 h-4 w-4' />,
  [ChannelType.VIDEO]: <Video className='mr-2 h-4 w-4' />,
};

const roleIconMap = {
  [MemberRole.GUEST]: null,
  [MemberRole.ADMIN]: <ShieldAlert className='text-rose-500 mr-2 h-4 w-4' />,
  [MemberRole.MODERATOR]: (
    <ShieldCheck className='text-indigo-500 mr-2 h-4 w-4' />
  ),
};

export async function ServerSideBar({ serverId }: ServerSideBarProps) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return redirect('/');
  }

  const server = await getServer(serverId, profile.id);

  const textChannels = server?.channels.filter(
    channel => channel.type === ChannelType.TEXT
  );
  const audioChannels = server?.channels.filter(
    channel => channel.type === ChannelType.AUDIO
  );
  const videoChannels = server?.channels.filter(
    channel => channel.type === ChannelType.VIDEO
  );

  if (!server) {
    return redirect('/');
  }

  const role = server?.members?.find(
    member => member.profileId === profile.id
  )?.role;

  return (
    <div className='flex flex-col h-full text-primary w-full bg-gradient-to-br from-gray-900/95 via-gray-800/90 to-gray-900/95 backdrop-blur-xl border-r border-gray-700/30 relative z-10'>
      <div className='flex-shrink-0 bg-gradient-to-r from-gray-800/50 to-gray-700/50 backdrop-blur-sm border-b border-gray-600/30 relative z-40'>
        <ServerHeader server={server} role={role} />
        <div className='px-4 pb-3'>
          <Separator className='h-[1px] bg-gradient-to-r from-transparent via-gray-600/50 to-transparent' />
        </div>
      </div>

      <div className='flex-1 overflow-y-auto overflow-x-visible scrollbar-hide px-2 relative z-10'>
        <div className='pt-3 mb-4 px-2'>
          <ServerSearch
            data={[
              {
                label: 'Text Channels',
                type: 'channel',
                data: textChannels?.map(channel => ({
                  icon: iconMap[channel.type],
                  id: channel.id,
                  name: channel.name,
                })),
              },
              {
                label: 'Voice Channels',
                type: 'channel',
                data: audioChannels?.map(channel => ({
                  icon: iconMap[channel.type],
                  id: channel.id,
                  name: channel.name,
                })),
              },
              {
                label: 'Video Channels',
                type: 'channel',
                data: videoChannels?.map(channel => ({
                  icon: iconMap[channel.type],
                  id: channel.id,
                  name: channel.name,
                })),
              },
            ]}
          />
        </div>

        <div className='px-2'>
          <Separator className='h-[1px] bg-gradient-to-r from-transparent via-gray-600/50 to-transparent mb-4' />

          {!!textChannels?.length && (
            <div className='mb-6'>
              <ServerSection
                sectionType='channels'
                channelType={ChannelType.TEXT}
                role={role}
                label='Text Channels'
              />
              <div className='flex flex-col space-y-1 mt-2 overflow-visible'>
                {textChannels.map(channel => (
                  <ServerChannel
                    key={channel.id}
                    channel={channel}
                    server={server}
                    role={role}
                  />
                ))}
              </div>
            </div>
          )}

          {!!audioChannels?.length && (
            <div className='mb-6'>
              <ServerSection
                sectionType='channels'
                channelType={ChannelType.AUDIO}
                role={role}
                label='Voice Channels'
              />
              <div className='flex flex-col space-y-1 mt-2 overflow-visible'>
                {audioChannels.map(channel => (
                  <ServerChannel
                    key={channel.id}
                    channel={channel}
                    server={server}
                    role={role}
                  />
                ))}
              </div>
            </div>
          )}

          {!!videoChannels?.length && (
            <div className='mb-6'>
              <ServerSection
                sectionType='channels'
                channelType={ChannelType.VIDEO}
                role={role}
                label='Video Channels'
              />
              <div className='flex flex-col space-y-1 mt-2 overflow-visible'>
                {videoChannels.map(channel => (
                  <ServerChannel
                    key={channel.id}
                    channel={channel}
                    server={server}
                    role={role}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
