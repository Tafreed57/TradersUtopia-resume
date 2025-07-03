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
          size='icon'
          className='md:hidden w-10 h-10 min-w-[40px] min-h-[40px] touch-manipulation transition-all duration-300 rounded-xl group relative overflow-hidden bg-gradient-to-br from-gray-700/50 to-gray-600/50 border border-gray-600/30 backdrop-blur-sm hover:from-blue-600/30 hover:to-purple-600/30 hover:border-blue-400/50 hover:shadow-lg hover:shadow-blue-400/20'
        >
          {/* Background gradient overlay */}
          <div className='absolute inset-0 bg-gradient-to-br from-blue-600/20 to-purple-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300' />

          <Menu className='w-5 h-5 text-gray-300 group-hover:text-white transition-colors duration-300 relative z-10' />
        </Button>
      </SheetTrigger>
      <SheetContent
        side='left'
        className='p-0 flex gap-0 w-auto max-w-[90vw] bg-gradient-to-br from-gray-900/98 via-gray-800/95 to-gray-900/98 border-r border-gray-700/50 backdrop-blur-xl shadow-2xl shadow-black/50 overflow-visible'
      >
        {/* Main server sidebar */}
        <div className='w-[96px] border-r border-gray-700/50 bg-gradient-to-b from-gray-800/50 to-gray-900/50 overflow-visible'>
          {await SideBar()}
        </div>

        {/* Channel sidebar */}
        <div className='flex-1 min-w-0 max-w-[280px] sm:max-w-[320px] overflow-visible'>
          {await ServerSideBar({ serverId })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
