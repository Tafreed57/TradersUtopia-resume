'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useStore } from '@/store/store';
import { ServerWithMembersWithProfiles } from '@/types/server';
import { MemberRole } from '@prisma/client';
import {
  ChevronDown,
  LogOut,
  PlusCircle,
  Settings,
  TrashIcon,
  UserPlus,
} from 'lucide-react';
import { useState } from 'react';

interface ServerHeaderProps {
  server: ServerWithMembersWithProfiles;
  role?: MemberRole;
}

export function ServerHeader({ server, role }: ServerHeaderProps) {
  const onOpen = useStore.use.onOpen();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const isAdmin = role === MemberRole.ADMIN;
  const isModerator = isAdmin || role === MemberRole.MODERATOR;

  const handleInviteClick = () => {
    setIsDropdownOpen(false);
    onOpen('invite', { server });
  };
  const handleServerSettingsClick = () => {
    setIsDropdownOpen(false);
    onOpen('editServer', { server });
  };

  function handleLeaveServerClick() {
    setIsDropdownOpen(false);
    onOpen('leaveServer', { server });
  }
  function handleDeleteServerClick() {
    setIsDropdownOpen(false);
    onOpen('deleteServer', { server });
  }
  function handleCreateChannelClick() {
    setIsDropdownOpen(false);
    onOpen('createChannel', { server });
  }

  return (
    <div className='relative z-50'>
      <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
        <DropdownMenuTrigger className='focus:outline-none' asChild>
          <button className='w-full text-md font-semibold px-4 py-3 flex items-center h-14 hover:bg-gradient-to-r hover:from-gray-700/50 hover:to-gray-600/50 transition-all duration-300 group relative overflow-hidden'>
            {/* Background gradient on hover */}
            <div className='absolute inset-0 bg-gradient-to-r from-blue-600/10 to-purple-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300' />

            <div className='flex items-center w-full relative z-10'>
              <div className='flex items-center gap-3 flex-1 min-w-0'>
                {server?.imageUrl ? (
                  <div className='w-8 h-8 rounded-xl overflow-hidden border border-gray-600/50 group-hover:border-blue-400/50 transition-colors duration-300 flex-shrink-0'>
                    <img
                      src={server.imageUrl}
                      alt={server.name}
                      className='w-full h-full object-cover group-hover:scale-110 transition-transform duration-300'
                    />
                  </div>
                ) : (
                  <div className='w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-lg group-hover:scale-110 transition-transform duration-300 flex-shrink-0'>
                    {server.name.charAt(0).toUpperCase()}
                  </div>
                )}

                <div className='flex flex-col min-w-0'>
                  <span className='text-white font-bold truncate text-left'>
                    {server?.name}
                  </span>
                  <span className='text-xs text-gray-400 font-medium'>
                    {server?.members?.length || 0} members
                  </span>
                </div>
              </div>

              <ChevronDown className='w-5 h-5 text-gray-400 group-hover:text-white transition-colors duration-300 flex-shrink-0' />
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className='w-64 text-sm font-medium bg-gradient-to-br from-gray-800/95 via-gray-700/90 to-gray-800/95 border border-gray-700/50 backdrop-blur-xl shadow-2xl text-gray-200 space-y-1 p-2 z-[9999]'
          side='bottom'
          align='start'
          sideOffset={8}
        >
          {isModerator && (
            <DropdownMenuItem
              onClick={handleInviteClick}
              className='text-blue-400 hover:text-blue-300 text-sm px-3 py-2.5 cursor-pointer rounded-lg hover:bg-blue-600/20 transition-all duration-200 flex items-center gap-3'
            >
              <UserPlus className='w-4 h-4' />
              <span className='font-medium'>Invite People</span>
            </DropdownMenuItem>
          )}

          {isAdmin && (
            <DropdownMenuItem
              onClick={handleServerSettingsClick}
              className='text-gray-300 hover:text-white text-sm px-3 py-2.5 cursor-pointer rounded-lg hover:bg-gray-700/50 transition-all duration-200 flex items-center gap-3'
            >
              <Settings className='w-4 h-4' />
              <span className='font-medium'>Server Settings</span>
            </DropdownMenuItem>
          )}
          {isModerator && (
            <DropdownMenuItem
              onClick={handleCreateChannelClick}
              className='text-purple-400 hover:text-purple-300 text-sm px-3 py-2.5 cursor-pointer rounded-lg hover:bg-purple-600/20 transition-all duration-200 flex items-center gap-3'
            >
              <PlusCircle className='w-4 h-4' />
              <span className='font-medium'>Create Channel</span>
            </DropdownMenuItem>
          )}

          {isModerator && (
            <DropdownMenuSeparator className='bg-gray-700/50 my-2' />
          )}

          {isAdmin && (
            <DropdownMenuItem
              onClick={handleDeleteServerClick}
              className='text-red-400 hover:text-red-300 text-sm px-3 py-2.5 cursor-pointer rounded-lg hover:bg-red-600/20 transition-all duration-200 flex items-center gap-3'
            >
              <TrashIcon className='w-4 h-4' />
              <span className='font-medium'>Delete Server</span>
            </DropdownMenuItem>
          )}
          {!isAdmin && (
            <DropdownMenuItem
              onClick={handleLeaveServerClick}
              className='text-red-400 hover:text-red-300 text-sm px-3 py-2.5 cursor-pointer rounded-lg hover:bg-red-600/20 transition-all duration-200 flex items-center gap-3'
            >
              <LogOut className='w-4 h-4' />
              <span className='font-medium'>Leave Server</span>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
