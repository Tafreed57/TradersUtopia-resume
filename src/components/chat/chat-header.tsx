import { ChatVideoButton } from '@/components/chat/chat-video-button';
import { MobileToggle } from '@/components/mobile-toggle';
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
    <div
      className='text-sm sm:text-md font-semibold px-3 sm:px-6 flex items-center h-16 sm:h-18 border-b border-gray-700/50 bg-gradient-to-r from-gray-800/95 via-gray-700/90 to-gray-800/95 backdrop-blur-xl touch-manipulation relative overflow-hidden sticky top-0 z-50 md:relative md:top-auto md:z-auto shadow-lg md:shadow-none'
      style={{
        paddingTop: 'max(0px, env(safe-area-inset-top))',
      }}
    >
      {/* Enhanced background for mobile sticky behavior */}
      <div className='absolute inset-0 bg-gradient-to-r from-blue-900/10 via-transparent to-purple-900/10 pointer-events-none md:bg-gradient-to-r md:from-blue-900/10 md:via-transparent md:to-purple-900/10' />

      {/* Extra backdrop blur for mobile */}
      <div className='absolute inset-0 backdrop-blur-sm md:backdrop-blur-0 pointer-events-none' />

      <div className='flex items-center gap-3 sm:gap-4 flex-1 min-w-0 relative z-10'>
        {await MobileToggle({ serverId })}

        {type === 'channel' && (
          <div className='flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-600/20 border border-blue-400/30 backdrop-blur-sm flex-shrink-0'>
            <Hash className='w-4 h-4 sm:w-5 sm:h-5 text-blue-400' />
          </div>
        )}

        {type === 'conversation' && (
          <div className='relative flex-shrink-0'>
            <UserAvatar
              src={imageUrl}
              className='h-8 w-8 sm:h-9 sm:w-9 border-2 border-green-400/50 shadow-lg shadow-green-400/20'
            />
            <div className='absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-gray-800 shadow-sm' />
          </div>
        )}

        <div className='flex flex-col min-w-0'>
          <p className='text-lg sm:text-xl font-bold text-white truncate leading-tight'>
            {type === 'channel' ? `${name}` : name}
          </p>
          {type === 'channel' && (
            <p className='text-xs text-gray-400 font-medium'>
              Click to view channel info
            </p>
          )}
          {type === 'conversation' && (
            <p className='text-xs text-green-400 font-medium'>Online</p>
          )}
        </div>
      </div>

      <div className='flex items-center gap-2 sm:gap-3 flex-shrink-0 relative z-10'>
        {type === 'conversation' && (
          <div className='hidden sm:block'>
            <ChatVideoButton />
          </div>
        )}

        {/* Additional info indicator */}
        <div className='hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-gray-700/40 via-gray-600/40 to-gray-700/40 border border-gray-600/30 backdrop-blur-sm'>
          <div className='w-2 h-2 bg-green-400 rounded-full animate-pulse' />
          <span className='text-xs font-medium text-gray-300'>Live</span>
        </div>
      </div>
    </div>
  );
}
