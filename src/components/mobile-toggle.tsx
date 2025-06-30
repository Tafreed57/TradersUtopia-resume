import React from 'react';
import { Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { SideBar } from '@/components/layout/side-bar';
import { ServerSideBar } from '@/components/layout/server-side-bar';

export async function MobileToggle({ serverId }: { serverId: string }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant='ghost'
          size='icon' className='md:hidden w-12 h-12 min-w-[48px] min-h-[48px] touch-manipulation hover:bg-gray-700/50 transition-all duration-200 rounded-xl border border-gray-600/30 backdrop-blur-sm'
        >
          <Menu className='w-5 h-5 text-gray-300 hover:text-white transition-colors' />
        </Button>
      </SheetTrigger>
      <SheetContent
        side='left' className='p-0 flex gap-0 w-auto max-w-[85vw] bg-gradient-to-br from-gray-900 via-gray-900/95 to-black border-r border-gray-700/50 backdrop-blur-xl'
      >
        <div className='w-[72px] border-r border-gray-700/50'>
          {await SideBar()}
        </div>
        <div className='flex-1 min-w-0'>
          {await ServerSideBar({ serverId })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
