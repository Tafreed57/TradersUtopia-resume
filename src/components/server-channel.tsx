'use client';
import { ActionTooltip } from '@/components/ui/action-tooltip';
import { cn } from '@/lib/utils';
import { Channel, ChannelType, MemberRole, Server } from '@prisma/client';
import { Edit, Hash, Trash, Lock } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import React, {
  useMemo,
  useCallback,
  useEffect,
  useState,
  useTransition,
} from 'react';
import { useStore } from '@/store/store';
import { ModalType } from '@/types/store';

interface ServerChannelParams {
  channel: Channel;
  server: Server;
  role?: MemberRole;
}

// ✅ SIMPLIFIED: Only Hash icon for TEXT channels (removed Mic and Video)
const iconMap = {
  [ChannelType.TEXT]: Hash,
};

export function ServerChannel({ channel, server, role }: ServerChannelParams) {
  const onOpen = useStore.use.onOpen();
  const router = useRouter();
  const params = useParams();
  const [isPending, startTransition] = useTransition();
  const [optimisticActive, setOptimisticActive] = useState(false);
  const [showActions, setShowActions] = useState(false);

  // ✅ SIMPLIFIED: Always Hash icon since we only support TEXT channels
  const Icon = iconMap[channel.type] || Hash;
  const isActive = params?.channelId === channel.id || optimisticActive;

  // ✅ UPDATED: Allow admins and moderators to edit any channel including general
  const canManageChannel = role !== MemberRole.GUEST;

  // ✅ NEW: Show lock icon only for guests on general channel (to indicate they can't edit)
  const showLockIcon = channel.name === 'general' && role === MemberRole.GUEST;

  // Prefetch the channel route for faster navigation
  useEffect(() => {
    router.prefetch(`/servers/${params?.serverId}/channels/${channel.id}`);
  }, [router, params?.serverId, channel.id]);

  // Reset optimistic state when actual route changes
  useEffect(() => {
    if (params?.channelId === channel.id) {
      setOptimisticActive(false);
    }
  }, [params?.channelId, channel.id]);

  // Optimistic navigation with instant UI feedback
  const onClick = useCallback(() => {
    if (params?.channelId !== channel.id) {
      // Optimistically update the UI immediately
      setOptimisticActive(true);

      // Then perform the actual navigation
      startTransition(() => {
        router.push(`/servers/${params?.serverId}/channels/${channel.id}`);
      });
    }
  }, [router, params?.serverId, params?.channelId, channel.id]);

  // Memoize the action handler to prevent unnecessary re-renders
  const onAction = useCallback(
    (e: React.MouseEvent, action: ModalType) => {
      e.stopPropagation();
      e.preventDefault();
      onOpen(action, { server, channel });
    },
    [onOpen, server, channel]
  );

  // Memoize the button classes
  const buttonClasses = useMemo(
    () =>
      cn(
        'group px-3 py-2.5 rounded-xl flex items-center gap-x-2 w-full transition-all duration-200 relative',
        'hover:bg-gradient-to-r hover:from-gray-700/50 hover:to-gray-600/50 hover:border-gray-500/30',
        'hover:transform hover:translate-x-0.5 hover:shadow-md',
        'border border-transparent backdrop-blur-sm',
        'focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:ring-offset-2 focus:ring-offset-gray-900',
        isActive
          ? 'bg-gradient-to-r from-blue-600/30 to-purple-600/30 border-blue-400/40 shadow-md shadow-blue-900/20 transform translate-x-0.5'
          : 'hover:border-gray-500/30',
        isPending && 'opacity-70 cursor-wait'
      ),
    [isActive, isPending]
  );

  const iconClasses = useMemo(
    () =>
      cn(
        'flex-shrink-0 w-5 h-5 transition-colors duration-200',
        isActive ? 'text-blue-400' : 'text-gray-400 group-hover:text-gray-200'
      ),
    [isActive]
  );

  const textClasses = useMemo(
    () =>
      cn(
        'text-sm font-medium transition-colors duration-200 flex-1 text-left truncate pr-2',
        isActive
          ? 'text-white font-semibold'
          : 'text-gray-300 group-hover:text-white'
      ),
    [isActive]
  );

  return (
    <div
      className='relative mb-1.5 mr-3 group'
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <button
        onClick={onClick}
        className={buttonClasses}
        title={channel.name}
        disabled={isPending}
      >
        <Icon className={iconClasses} />
        <span className={textClasses}>{channel.name}</span>

        {/* Lock icon only for guests on general channel */}
        {showLockIcon && (
          <div className='flex-shrink-0 ml-auto'>
            <ActionTooltip
              label='Only admins and moderators can edit'
              side='top'
            >
              <Lock className='w-4 h-4 text-gray-500 group-hover:text-gray-400 transition-colors' />
            </ActionTooltip>
          </div>
        )}

        {/* Active channel indicator */}
        {isActive && (
          <div className='absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-blue-400 to-purple-500 rounded-r-full' />
        )}

        {/* Loading indicator */}
        {isPending && (
          <div className='absolute inset-0 bg-gray-900/20 rounded-xl flex items-center justify-center'>
            <div className='w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin' />
          </div>
        )}
      </button>

      {/* Edit and Delete buttons - show for all channels if user has permissions */}
      {canManageChannel && (
        <div
          className={cn(
            'absolute right-1 top-1/2 transform -translate-y-1/2 flex items-center gap-0.5 transition-all duration-200 z-20',
            showActions ? 'opacity-100 visible' : 'opacity-0 invisible'
          )}
        >
          <ActionTooltip label='Edit' side='top'>
            <button
              onClick={e => onAction(e, 'editChannel')}
              className='p-1.5 rounded-md hover:bg-blue-600/20 transition-all duration-200 group/edit flex items-center justify-center backdrop-blur-sm border border-transparent hover:border-blue-400/30'
              title='Edit Channel'
            >
              <Edit className='w-3 h-3 text-gray-400 group-hover/edit:text-blue-400 transition-colors duration-200' />
            </button>
          </ActionTooltip>
          <ActionTooltip label='Delete' side='top'>
            <button
              onClick={e => onAction(e, 'deleteChannel')}
              className='p-1.5 rounded-md hover:bg-red-600/20 transition-all duration-200 group/delete flex items-center justify-center backdrop-blur-sm border border-transparent hover:border-red-400/30'
              title='Delete Channel'
            >
              <Trash className='w-3 h-3 text-gray-400 group-hover/delete:text-red-400 transition-colors duration-200' />
            </button>
          </ActionTooltip>
        </div>
      )}
    </div>
  );
}
