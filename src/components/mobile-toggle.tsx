'use client';

import React from 'react';
import { Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

export function MobileToggle({ serverId }: { serverId: string }) {
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
        <div className='flex-1 p-4'>
          <p className='text-center text-gray-400 text-sm'>
            Mobile navigation is being updated...
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
