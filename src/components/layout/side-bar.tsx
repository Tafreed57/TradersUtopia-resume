import { getCurrentProfile, getAllServers } from '@/lib/query';
import { SideBarActions } from '@/components/layout/side-bar-actions';
import { SideBarItem } from '@/components/layout/side-bar-item';
// import { ModeToggle } from '@/components/mobile-toggle';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { Separator } from '@/components/ui/separator';
import { ActionTooltip } from '@/components/ui/action-tooltip';
import { UserButton } from '@clerk/nextjs';
import { SubscriptionProtectedLink } from '@/components/subscription-protected-link';
import { redirect } from 'next/navigation';
import { LayoutDashboard } from 'lucide-react';

export async function SideBar() {
  const profile = await getCurrentProfile();
  if (!profile) {
    return redirect('/');
  }

  const servers = await getAllServers(profile.id);

  return (
    <div className='flex flex-col items-center h-full text-primary w-full bg-gradient-to-br from-gray-900/95 via-gray-800/90 to-gray-900/95 backdrop-blur-xl py-5 overflow-visible'>
      {/* Dashboard Link */}
      <div className='mb-5'>
        <ActionTooltip label='Dashboard' side='right' align='center'>
          <SubscriptionProtectedLink
            href='/dashboard'
            className='h-[56px] w-[56px] rounded-full bg-background/10 hover:bg-background/20 transition-all group'
            size='icon'
            variant='ghost'
          >
            <LayoutDashboard className='h-6 w-6 text-primary group-hover:text-white transition-colors' />
          </SubscriptionProtectedLink>
        </ActionTooltip>
      </div>

      <div className='mb-5'>
        <SideBarActions />
      </div>

      <Separator className='h-[2px] bg-zinc-300 dark:bg-zinc-700 rounded-md w-12 mx-auto mb-5' />

      <div className='flex-1 w-full overflow-y-auto scrollbar-hide overflow-x-visible'>
        <div className='flex flex-col items-center space-y-4 pb-5'>
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

      <div className='mt-auto flex items-center flex-col gap-y-5 pb-4'>
        <NotificationBell />
        {/* <ModeToggle /> */}
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
  );
}
