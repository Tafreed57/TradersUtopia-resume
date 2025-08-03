'use client';

import { useState, useEffect } from 'react';
import { SideBarItem } from '@/components/layout/side-bar-item';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { Separator } from '@/components/ui/separator';
import { ActionTooltip } from '@/components/ui/action-tooltip';
import { UserButton } from '@clerk/nextjs';
import { LayoutDashboard } from 'lucide-react';
import { ServerWithMembersWithUsers } from '@/types/server';
import { Role } from '@prisma/client';
import { MobileServerWrapper } from '@/components/mobile-server-wrapper';
import Link from 'next/link';

interface MobileCompleteSidebarProps {
  server: ServerWithMembersWithUsers;
  role?: Role;
  servers: Array<{
    id: string;
    name: string;
    imageUrl: string;
  }>;
}

export function MobileCompleteSidebar({
  server,
  role,
  servers,
}: MobileCompleteSidebarProps) {
  const [isMounted, setIsMounted] = useState(false);

  // Prevent hydration mismatch by ensuring component only renders on client
  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div className='flex h-full'>
        <div className='w-10 flex-shrink-0 flex flex-col items-center h-full text-primary bg-gradient-to-br from-gray-900/95 via-gray-800/90 to-gray-900/95 backdrop-blur-xl py-5 overflow-visible border-r border-gray-700/30'>
          <div className='animate-pulse space-y-4'>
            <div className='h-14 w-14 bg-gray-700 rounded-full'></div>
            <div className='h-14 w-14 bg-gray-700 rounded-full'></div>
            <div className='h-px w-12 bg-gray-700'></div>
            <div className='h-14 w-14 bg-gray-700 rounded-full'></div>
          </div>
        </div>
        <div className='flex-1 min-w-0 bg-gradient-to-br from-gray-900/95 via-gray-800/90 to-gray-900/95'>
          <div className='animate-pulse p-4 space-y-4'>
            <div className='h-16 bg-gray-700 rounded'></div>
            <div className='h-8 bg-gray-700 rounded'></div>
            <div className='space-y-2'>
              <div className='h-6 bg-gray-700 rounded'></div>
              <div className='h-6 bg-gray-700 rounded'></div>
              <div className='h-6 bg-gray-700 rounded'></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className='flex h-full'>
      {/* Main Server List - Left Side */}
      <div className='w-15 flex-shrink-0 flex flex-col items-center h-full text-primary bg-gradient-to-br from-gray-900/95 via-gray-800/90 to-gray-900/95 backdrop-blur-xl py-5 overflow-visible border-r border-gray-700/30 touch-manipulation'>
        {/* Dashboard Link */}
        <div className='mb-5 overflow-visible'>
          <ActionTooltip label='Go to Dashboard' side='right' align='center'>
            <div>
              <Link
                href='/dashboard'
                className='h-[56px] w-[56px] rounded-full bg-background/10 hover:bg-background/20 transition-all group flex items-center justify-center
                  min-h-[3.5rem] min-w-[3.5rem] md:h-[56px] md:w-[56px]
                  touch-manipulation'
              >
                <LayoutDashboard className='h-6 w-6 text-primary group-hover:text-white transition-colors' />
              </Link>
            </div>
          </ActionTooltip>
        </div>

        <div className='flex-1 w-full overflow-y-auto overflow-x-visible'>
          <div className='flex flex-col items-center space-y-4 pb-5 overflow-visible'>
            {servers?.map(server => (
              <SideBarItem
                key={server.id}
                name={server.name}
                id={server.id}
                imageUrl={server.imageUrl}
              />
            ))}
          </div>
        </div>

        <div
          className='mt-auto flex items-center flex-col gap-y-5 pb-4 overflow-visible
          pb-6 md:pb-4'
        >
          <NotificationBell />
          <UserButton
            appearance={{
              elements: {
                avatarBox:
                  'w-10 h-10 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-200',
                userButtonPopoverCard:
                  'bg-black-800 border border-gray-600 shadow-2xl',
                userButtonPopoverActionButton:
                  'text-black-300 hover:bg-gray-700 hover:text-white',
                userButtonPopoverActionButtonText: 'text-black-300',
                userButtonPopoverFooter: 'hidden',
              },
            }}
          />
        </div>
      </div>

      {/* Server-Specific Content - Right Side */}
      <div className='flex-1 min-w-0'>
        <MobileServerWrapper server={server} role={role} />
      </div>
    </div>
  );
}
