'use client';
import { ActionTooltip } from '@/components/ui/action-tooltip';
import { cn } from '@/lib/utils';
import { Channel, ChannelType, MemberRole, Server } from '@prisma/client';
import { Edit, Hash, Trash, GripVertical } from 'lucide-react';
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
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface ServerChannelProps {
  channel: Channel;
  server: Server;
  role?: MemberRole;
}

// ✅ SIMPLIFIED: Only Hash icon for TEXT channels (removed Mic and Video)
const iconMap = {
  [ChannelType.TEXT]: Hash,
};

export function ServerChannel({ channel, server, role }: ServerChannelProps) {
  const onOpen = useStore.use.onOpen();
  const router = useRouter();
  const params = useParams();
  const [isPending, startTransition] = useTransition();
  const [optimisticActive, setOptimisticActive] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // Prevent hydration mismatch by ensuring component only renders on client
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // ✅ SIMPLIFIED: Always Hash icon since we only support TEXT channels
  const Icon = iconMap[channel.type] || Hash;
  const isActive =
    (isMounted && params?.channelId === channel.id) || optimisticActive;

  // ✅ UPDATED: Allow admins and moderators to edit any channel including general
  const canModify = role !== MemberRole.GUEST;

  // Enable drag and drop for channels when user can manage them
  const isDraggable = canModify;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `channel-${channel.id}`,
    disabled: !isDraggable,
    data: {
      type: 'Channel',
      channel,
      serverId: server.id,
      position: channel.position,
      sectionId: channel.sectionId,
      name: channel.name,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

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
    if (!isMounted) return;
    if (params?.channelId !== channel.id) {
      // Optimistically update the UI immediately
      setOptimisticActive(true);

      // Use startTransition for better UX
      startTransition(() => {
        router.push(`/servers/${params?.serverId}/channels/${channel.id}`);
      });

      // Reset optimistic state after navigation
      setTimeout(() => {
        setOptimisticActive(false);
      }, 1000);
    }
  }, [router, params?.serverId, params?.channelId, channel.id, isMounted]);

  // Memoize the action handler to prevent unnecessary re-renders
  const onAction = useCallback(
    (e: React.MouseEvent, action: ModalType) => {
      e.stopPropagation();
      onOpen(action, { channel, server });
    },
    [onOpen, channel, server]
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
        isPending && 'opacity-70 cursor-wait',
        isDragging && 'opacity-50 scale-95',
        isDraggable && 'hover:border-blue-400/30'
      ),
    [isActive, isPending, isDragging, isDraggable]
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

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className='bg-gray-800/50 border border-gray-600/50 rounded-md p-2 opacity-50 mb-1'
      >
        <div className='flex items-center gap-x-2'>
          <Icon className='w-5 h-5 text-gray-400' />
          <span className='text-sm text-gray-400'>{channel.name}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className='relative mb-1.5 mr-3 group'
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className='flex items-center'>
        {/* Drag handle outside the button */}
        {isDraggable && (
          <div
            {...attributes}
            {...listeners}
            className='flex-shrink-0 cursor-grab active:cursor-grabbing p-1 rounded transition-all duration-200 hover:bg-gray-600/30 mr-1'
            onClick={e => {
              // Prevent the drag handle from triggering the button click
              e.stopPropagation();
              e.preventDefault();
            }}
          >
            <GripVertical className='w-3 h-3 text-gray-400 group-hover:text-blue-400 transition-colors' />
          </div>
        )}

        {/* Channel button */}
        <button
          onClick={onClick}
          className={buttonClasses}
          title={channel.name}
          disabled={isPending}
          style={{ width: '100%' }}
        >
          <Icon className={iconClasses} />
          <span className={textClasses}>{channel.name}</span>

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
      </div>

      {/* Edit and Delete buttons with much higher z-index */}
      {canModify && (
        <div
          className={cn(
            'absolute right-1 top-1/2 transform -translate-y-1/2 flex items-center gap-0.5 transition-all duration-200 z-[70]',
            showActions ? 'opacity-100 visible' : 'opacity-0 invisible'
          )}
        >
          <div className='relative z-[70]'>
            <ActionTooltip label='Edit' side='top'>
              <button
                onClick={e => onAction(e, 'editChannel')}
                className='p-1.5 rounded-md hover:bg-blue-600/20 transition-all duration-200 group/edit flex items-center justify-center backdrop-blur-sm border border-transparent hover:border-blue-400/30 relative z-[70]'
                title='Edit Channel'
              >
                <Edit className='w-3 h-3 text-gray-400 group-hover/edit:text-blue-400 transition-colors duration-200' />
              </button>
            </ActionTooltip>
          </div>

          <div className='relative z-[70]'>
            <ActionTooltip label='Delete' side='top'>
              <button
                onClick={e => onAction(e, 'deleteChannel')}
                className='p-1.5 rounded-md hover:bg-red-600/20 transition-all duration-200 group/delete flex items-center justify-center backdrop-blur-sm border border-transparent hover:border-red-400/30 relative z-[70]'
                title='Delete Channel'
              >
                <Trash className='w-3 h-3 text-gray-400 group-hover/delete:text-red-400 transition-colors duration-200' />
              </button>
            </ActionTooltip>
          </div>
        </div>
      )}
    </div>
  );
}
