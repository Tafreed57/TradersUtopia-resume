import { ChatVideoButton } from '@/components/chat/chat-video-button';
import { MobileToggle } from '@/components/mobile-toggle';
import { SocketIndicator } from '@/components/socket-indicator';
import { UserAvatar } from '@/components/user/user-avatar';
import { Hash } from 'lucide-react';
interface ChatHeaderProps {
  name: string;
  type: 'conversation' | 'channel';
  imageUrl?: string;
  serverId: string;
}

export async function ChatHeader({
  name,
  type,
  imageUrl,
  serverId,
}: ChatHeaderProps) {
  return (
    <div className='text-sm sm:text-md font-semibold px-3 sm:px-4 flex items-center h-14 sm:h-16 border-neutral-200 dark:border-neutral-800 border-b-2 bg-white/95 dark:bg-[#313338]/95 backdrop-blur-sm touch-manipulation'>
      <div className='flex items-center gap-2 sm:gap-3 flex-1 min-w-0'>
        {await MobileToggle({ serverId })}
        {type === 'channel' && (
          <Hash className='w-4 h-4 sm:w-5 sm:h-5 text-zinc-500 dark:text-zinc-400 flex-shrink-0' />
        )}
        {type === 'conversation' && (
          <UserAvatar
            src={imageUrl}
            className='h-7 w-7 sm:h-8 sm:w-8 flex-shrink-0'
          />
        )}
        <p className='text-sm sm:text-md font-semibold text-black dark:text-white truncate'>
          {type === 'channel' ? `#${name}` : name}
        </p>
      </div>

      <div className='flex items-center gap-1 sm:gap-2 flex-shrink-0'>
        {type === 'conversation' && (
          <div className='hidden sm:block'>
            <ChatVideoButton />
          </div>
        )}
        <SocketIndicator />
      </div>
    </div>
  );
}
