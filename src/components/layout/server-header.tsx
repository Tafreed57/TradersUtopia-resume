'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ServerWithMembersWithUsers } from '@/types/server';
import { ChevronDown, PlusCircle, Settings } from 'lucide-react';
import { useState } from 'react';
import Image from 'next/image';
import { useStore } from '@/store/store';
import { useExtendedUser } from '@/hooks/use-extended-user';

interface ServerHeaderProps {
  server: ServerWithMembersWithUsers;
  role?: any; // Keep for backwards compatibility but not used
}

export function ServerHeader({ server }: ServerHeaderProps) {
  const onOpen = useStore(state => state.onOpen);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // ✅ UPDATED: Use extended user hook for admin checks and user data
  const { isAdmin, hasAccess, isLoading: authLoading } = useExtendedUser();

  // Determine if user has moderator privileges (admin or has access)
  const isModerator = isAdmin || hasAccess;

  const handleServerSettingsClick = () => {
    setIsDropdownOpen(false);
    onOpen('editServer', { server });
  };

  function handleCreateChannelClick() {
    setIsDropdownOpen(false);
    onOpen('createChannel', { server });
  }

  function handleCreateSectionClick() {
    setIsDropdownOpen(false);
    onOpen('createSection', { server });
  }

  // ✅ UPDATED: Simple header for non-admin users (no dropdown, no member count)
  if (!isAdmin) {
    return (
      <div className='relative z-50'>
        <div
          className='w-full text-md font-semibold px-4 py-3 flex items-center h-14 transition-all duration-300 group relative overflow-hidden
          min-h-[4rem] md:min-h-[3.5rem]
          touch-manipulation
          '
        >
          <div className='flex items-center w-full relative z-10'>
            <div className='flex items-center gap-3 flex-1 min-w-0'>
              {server?.imageUrl ? (
                <div
                  className='w-8 h-8 rounded-xl overflow-hidden border border-gray-600/50 transition-colors duration-300 flex-shrink-0
                  min-w-[2rem] min-h-[2rem] md:w-8 md:h-8'
                >
                  <Image
                    src={server.imageUrl}
                    alt={server.name}
                    width={32}
                    height={32}
                    className='w-full h-full object-cover transition-transform duration-300'
                  />
                </div>
              ) : (
                <div
                  className='w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-lg transition-transform duration-300 flex-shrink-0
                  min-w-[2rem] min-h-[2rem] md:w-8 md:h-8'
                >
                  {server.name.charAt(0).toUpperCase()}
                </div>
              )}

              <div className='flex flex-col min-w-0'>
                <span className='text-white font-bold truncate text-left text-sm md:text-base'>
                  {server?.name}
                </span>
                <span className='text-xs text-gray-400'>
                  {/* ✅ UPDATED: Show access status instead of role name */}
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
            {/* ✅ REMOVED: No chevron icon for non-admin users */}
          </div>
        </div>
      </div>
    );
  }

  // ✅ Full dropdown functionality for admin users
  return (
    <div className='relative z-[100]'>
      <DropdownMenu open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
        <DropdownMenuTrigger className='focus:outline-none' asChild>
          <button
            className='w-full text-md font-semibold px-4 py-3 flex items-center h-14 hover:bg-gradient-to-r hover:from-gray-700/50 hover:to-gray-600/50 transition-all duration-300 group relative overflow-hidden
            min-h-[4rem] md:min-h-[3.5rem]
            touch-manipulation
            '
          >
            {/* Background gradient on hover */}
            <div className='absolute inset-0 bg-gradient-to-r from-blue-600/10 to-purple-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300' />

            <div className='flex items-center w-full relative z-10'>
              <div className='flex items-center gap-3 flex-1 min-w-0'>
                {server?.imageUrl ? (
                  <div
                    className='w-8 h-8 rounded-xl overflow-hidden border border-gray-600/50 group-hover:border-blue-400/50 transition-colors duration-300 flex-shrink-0
                    min-w-[2rem] min-h-[2rem] md:w-8 md:h-8'
                  >
                    <Image
                      src={server.imageUrl}
                      alt={server.name}
                      width={32}
                      height={32}
                      className='w-full h-full object-cover group-hover:scale-110 transition-transform duration-300'
                    />
                  </div>
                ) : (
                  <div
                    className='w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-lg group-hover:scale-110 transition-transform duration-300 flex-shrink-0
                    min-w-[2rem] min-h-[2rem] md:w-8 md:h-8'
                  >
                    {server.name.charAt(0).toUpperCase()}
                  </div>
                )}

                <div className='flex flex-col min-w-0'>
                  <span className='text-white font-bold truncate text-left text-sm md:text-base'>
                    {server?.name}
                  </span>
                  <span className='text-xs text-gray-400 font-medium'>
                    {/* ✅ UPDATED: Show member count and admin status */}
                    {server?.members?.length || 0} members | Admin
                  </span>
                </div>
              </div>

              <ChevronDown
                className='w-5 h-5 text-gray-400 group-hover:text-white transition-colors duration-300 flex-shrink-0
                min-w-[1.25rem] min-h-[1.25rem]'
              />
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuPortal>
          <DropdownMenuContent
            className='w-64 text-sm font-medium bg-gradient-to-br from-gray-800/95 via-gray-700/90 to-gray-800/95 border border-gray-700/50 backdrop-blur-xl shadow-2xl text-gray-200 space-y-1 p-2'
            side='bottom'
            align='start'
            sideOffset={8}
            style={{ zIndex: 99999 }}
          >
            {isAdmin && (
              <DropdownMenuItem
                onClick={handleServerSettingsClick}
                className='text-gray-300 hover:text-white text-sm px-3 py-2.5 cursor-pointer rounded-lg hover:bg-gray-700/50 transition-all duration-200 flex items-center gap-3'
              >
                <Settings className='w-4 h-4' />
                <span className='font-medium'>Server Settings</span>
              </DropdownMenuItem>
            )}

            {isAdmin && isModerator && (
              <DropdownMenuSeparator className='bg-gray-700/50 my-2' />
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
              <DropdownMenuItem
                onClick={handleCreateSectionClick}
                className='text-green-400 hover:text-green-300 text-sm px-3 py-2.5 cursor-pointer rounded-lg hover:bg-green-600/20 transition-all duration-200 flex items-center gap-3'
              >
                <PlusCircle className='w-4 h-4' />
                <span className='font-medium'>Create Section</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenu>
    </div>
  );
}
