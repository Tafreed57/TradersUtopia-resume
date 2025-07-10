import { Hash } from 'lucide-react';
import { MobileToggle } from '@/components/mobile-toggle';
import { ServerWithMembersWithProfiles } from '@/types/server';
import { MemberRole } from '@prisma/client';
import { ChannelNotificationToggle } from '@/components/chat/channel-notification-toggle';

interface ChatHeaderProps {
  serverId: string;
  name: string;
  type: 'channel';
  imageUrl?: string;
  server?: ServerWithMembersWithProfiles;
  role?: MemberRole;
  servers?: Array<{
    id: string;
    name: string;
    imageUrl: string;
  }>;
  channelId?: string;
}

export function ChatHeader({
  serverId,
  name,
  type,
  imageUrl,
  server,
  role,
  servers,
  channelId,
}: ChatHeaderProps) {
  return (
    <div
      className='sticky top-0 z-50 text-md font-semibold px-3 flex items-center border-neutral-200 dark:border-neutral-800 border-b-2 bg-gradient-to-br from-gray-900/95 via-gray-800/90 to-gray-900/95 backdrop-blur-xl touch-manipulation'
      style={{
        paddingTop: `env(safe-area-inset-top)`,
        minHeight: `calc(3rem + env(safe-area-inset-top))`,
        height: `calc(3rem + env(safe-area-inset-top))`,
      }}
    >
      {server ? (
        <MobileToggle server={server} role={role} servers={servers} />
      ) : (
        <div className='md:hidden w-9 h-9' /> // Placeholder to maintain spacing
      )}
      <Hash className='w-5 h-5 text-zinc-500 dark:text-zinc-400 mr-2' />
      <p className='font-semibold text-md text-black dark:text-white flex-1'>
        {name}
      </p>

      {/* Channel notification toggle - only show for channels */}
      {type === 'channel' && channelId && (
        <div className='ml-auto flex items-center gap-x-2'>
          <ChannelNotificationToggle channelId={channelId} channelName={name} />
        </div>
      )}
    </div>
  );
}
