import { Hash } from 'lucide-react';
import { MobileToggle } from '@/components/mobile-toggle';
import { ServerWithMembersWithUsers } from '@/types/server';
import { Role } from '@prisma/client';
import { ChannelNotificationToggle } from '@/components/chat/channel-notification-toggle';
import { useExtendedUser } from '@/hooks/use-extended-user';
import Image from 'next/image';

interface ChatHeaderProps {
  serverId: string;
  name: string;
  type: 'channel';
  imageUrl?: string;
  server?: ServerWithMembersWithUsers;
  role?: Role;
  servers?: Array<{
    id: string;
    name: string;
    imageUrl: string;
  }>;
  channelId?: string;
  onChannelClick?: (channelId: string) => void;
  activeChannelId?: string | null;
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
  onChannelClick,
  activeChannelId,
}: ChatHeaderProps) {
  const { isAdmin, hasAccess, isLoading: authLoading } = useExtendedUser();

  return (
    <>
      {/* Mobile Chat Header */}
      <div className='md:hidden sticky top-0 z-50 bg-gradient-to-br from-gray-900/95 via-gray-800/90 to-gray-900/95 backdrop-blur-xl border-b border-neutral-200 dark:border-neutral-800 touch-manipulation'>
        {/* Mobile top row with server name */}
        {server && (
          <div className='flex items-center px-4 py-3 h-16 border-b border-neutral-200/10 dark:border-neutral-800/30'>
            <div className='flex items-center gap-3 flex-1 min-w-0'>
              {server?.imageUrl ? (
                <div className='w-8 h-8 rounded-xl overflow-hidden border border-gray-600/50 transition-colors duration-300 flex-shrink-0'>
                  <Image
                    src={server.imageUrl}
                    alt={server.name}
                    width={32}
                    height={32}
                    className='w-full h-full object-cover transition-transform duration-300'
                  />
                </div>
              ) : (
                <div className='w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-lg transition-transform duration-300 flex-shrink-0'>
                  {server.name.charAt(0).toUpperCase()}
                </div>
              )}

              <div className='flex flex-col min-w-0'>
                <span className='text-white font-bold truncate text-left text-sm'>
                  {server?.name}
                </span>
                <span className='text-xs text-gray-400'>
                  {authLoading
                    ? 'Checking access...'
                    : isAdmin
                    ? 'Admin'
                    : hasAccess
                    ? 'Premium Member'
                    : 'Free Member'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Mobile bottom row with channel name */}
        <div className='flex items-center px-3 py-2 h-12'>
          {server ? (
            <MobileToggle
              server={server}
              role={role}
              servers={servers}
              onChannelClick={onChannelClick}
              activeChannelId={activeChannelId}
            />
          ) : (
            <div className='w-9 h-9 mr-3' /> // Placeholder to maintain spacing when no server
          )}
          <Hash className='w-5 h-5 text-zinc-500 dark:text-zinc-400 mr-2' />
          <p className='font-semibold text-md text-black dark:text-white flex-1 truncate'>
            {name}
          </p>

          {/* Channel notification toggle - only show for channels */}
          {type === 'channel' && channelId && (
            <div className='ml-auto flex items-center gap-x-2'>
              <ChannelNotificationToggle
                channelId={channelId}
                channelName={name}
              />
            </div>
          )}
        </div>
      </div>

      {/* Desktop Chat Header */}
      <div
        className='hidden md:flex sticky top-0 z-50 text-md font-semibold px-3 items-center border-neutral-200 dark:border-neutral-800 border-b-2 bg-gradient-to-br from-gray-900/95 via-gray-800/90 to-gray-900/95 backdrop-blur-xl touch-manipulation'
        style={{
          minHeight: '3rem',
          height: '3rem',
        }}
      >
        <Hash className='w-5 h-5 text-zinc-500 dark:text-zinc-400 mr-2' />
        <p className='font-semibold text-md text-black dark:text-white flex-1'>
          {name}
        </p>

        {/* Channel notification toggle - only show for channels */}
        {type === 'channel' && channelId && (
          <div className='ml-auto flex items-center gap-x-2'>
            <ChannelNotificationToggle
              channelId={channelId}
              channelName={name}
            />
          </div>
        )}
      </div>
    </>
  );
}
