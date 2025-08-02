import { getCurrentProfileForAuth, getAllServers } from '@/lib/query';
import { SideBarItem } from '@/components/layout/side-bar-item';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { ActionTooltip } from '@/components/ui/action-tooltip';
import { UserButton } from '@clerk/nextjs';
import { redirect } from 'next/navigation';
import { LayoutDashboard } from 'lucide-react';
import Link from 'next/link';

export async function SideBar() {
  const profile = await getCurrentProfileForAuth();
  if (!profile) {
    return redirect('/');
  }

  const servers = await getAllServers(profile.id);

  return (
    <div className='flex flex-col items-center h-full text-primary w-full bg-gradient-to-br from-gray-900/95 via-gray-800/90 to-gray-900/95 backdrop-blur-xl py-5 overflow-visible touch-manipulation'>
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

      {/* <Separator className='h-[2px] bg-zinc-300 dark:bg-zinc-700 rounded-md w-12 mx-auto mb-5' /> */}

      <div className='flex-1 w-full overflow-y-auto overflow-x-visible'>
        <div className='flex flex-col items-center space-y-4 pb-5 overflow-visible'>
          {servers?.map(server => (
            <SideBarItem
              key={server.id}
              name={server.name}
              id={server.id}
              imageUrl={server.imageUrl ?? null}
            />
          ))}
        </div>
      </div>

      <div
        className='mt-auto flex items-center flex-col gap-y-5 pb-4 overflow-visible
        pb-6 md:pb-4'
      >
        <NotificationBell />
        {/* <ModeToggle /> */}
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
  );
}
