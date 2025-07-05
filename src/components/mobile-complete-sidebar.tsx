'use client';

import { useState, useEffect } from 'react';
import { SideBarActions } from '@/components/layout/side-bar-actions';
import { SideBarItem } from '@/components/layout/side-bar-item';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { Separator } from '@/components/ui/separator';
import { ActionTooltip } from '@/components/ui/action-tooltip';
import { UserButton } from '@clerk/nextjs';
import { SubscriptionProtectedLink } from '@/components/subscription-protected-link';
import { LayoutDashboard } from 'lucide-react';
import { ServerWithMembersWithProfiles } from '@/types/server';
import { MemberRole } from '@prisma/client';
import { MobileServerWrapper } from '@/components/mobile-server-wrapper';

interface MobileCompleteSidebarProps {
  server: ServerWithMembersWithProfiles;
  role?: MemberRole;
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
        <div className='w-24 flex-shrink-0 flex flex-col items-center h-full text-primary bg-gradient-to-br from-gray-900/95 via-gray-800/90 to-gray-900/95 backdrop-blur-xl py-5 overflow-visible border-r border-gray-700/30'>
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
      <div className='w-24 flex-shrink-0 flex flex-col items-center h-full text-primary bg-gradient-to-br from-gray-900/95 via-gray-800/90 to-gray-900/95 backdrop-blur-xl py-5 overflow-visible border-r border-gray-700/30'>
        {/* Dashboard Link */}
        <div className='mb-5 overflow-visible'>
          <ActionTooltip label='Go to Dashboard' side='right' align='center'>
            <div>
              <SubscriptionProtectedLink
                href='/dashboard'
                className='h-[56px] w-[56px] rounded-full bg-background/10 hover:bg-background/20 transition-all group flex items-center justify-center'
                size='icon'
                variant='ghost'
              >
                <LayoutDashboard className='h-6 w-6 text-primary group-hover:text-white transition-colors' />
              </SubscriptionProtectedLink>
            </div>
          </ActionTooltip>
        </div>

        <div className='mb-5 overflow-visible'>
          <SideBarActions />
        </div>

        <Separator className='h-[2px] bg-zinc-300 dark:bg-zinc-700 rounded-md w-12 mx-auto mb-5' />

        <div className='flex-1 w-full overflow-y-auto scrollbar-hide overflow-x-visible'>
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

        <div className='mt-auto flex items-center flex-col gap-y-5 pb-4 overflow-visible'>
          <NotificationBell />
          <UserButton
            afterSignOutUrl='/'
            appearance={{
              elements: {
                avatarBox: 'h-[56px] w-[56px]',
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
