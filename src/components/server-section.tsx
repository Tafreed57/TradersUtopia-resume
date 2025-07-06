'use client';
import { ActionTooltip } from '@/components/ui/action-tooltip';
import { useStore } from '@/store/store';
import { ServerWithMembersWithProfiles } from '@/types/server';
import { ChannelType, MemberRole } from '@prisma/client';
import { Plus } from 'lucide-react';

interface ServerSectionProps {
  label: string;
  role?: MemberRole;
  channelType?: ChannelType;
  server?: ServerWithMembersWithProfiles;
}

export function ServerSection({
  label,
  role,
  channelType,
  server,
}: ServerSectionProps) {
  const isOpen = useStore.use.isOpen();
  const onOpen = useStore.use.onOpen();

  const canCreateChannel = role === MemberRole.ADMIN;

  return (
    <div className='flex items-center justify-between px-3 py-2 mb-2 bg-gradient-to-r from-gray-800/30 to-gray-700/30 rounded-xl border border-gray-700/30 backdrop-blur-sm'>
      <div className='text-xs font-bold uppercase tracking-wider text-gray-300 flex items-center gap-2'>
        <div className='w-2 h-2 rounded-full bg-gradient-to-r from-blue-400 to-purple-500' />
        {label}
      </div>
      {canCreateChannel && (
        <div className='flex-shrink-0 ml-2'>
          <ActionTooltip label='Create Channel' side='top'>
            <button
              onClick={() => onOpen('createChannel', { channelType, server })}
              className='flex items-center justify-center w-6 h-6 text-gray-400 hover:text-blue-400 transition-all duration-300 rounded-md hover:bg-blue-600/20 group backdrop-blur-sm border border-transparent hover:border-blue-400/30 hover:shadow-md hover:shadow-blue-400/20'
            >
              <Plus className='h-3.5 w-3.5 group-hover:rotate-90 transform transition-all duration-300' />
            </button>
          </ActionTooltip>
        </div>
      )}
    </div>
  );
}
