import React from 'react'
import { Menu } from 'lucide-react'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { SideBar } from '@/components/layout/side-bar'
import { ServerSideBar } from '@/components/layout/server-side-bar'

export function MobileToggle({serverId}: {serverId: string}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className='md:hidden text-zinc-500 hover:text-zinc-600 dark:text-zinc-400 dark:hover:text-zinc-300 hover:bg-zinc-200/20 dark:hover:bg-zinc-700/50 transition-all duration-200'
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent 
        side="left" 
        className='p-0 flex gap-0 w-[352px] bg-white dark:bg-[#2B2D31] border-r border-zinc-200 dark:border-zinc-800'
      >
        {/* Main Sidebar - Server List */}
        <div className='w-[72px] flex-shrink-0 bg-[#E3E5E8] dark:bg-[#1E1F22]'>
          <SideBar />
        </div>
        
        {/* Server Sidebar - Channels */}
        <div className='flex-1 bg-[#F2F3F5] dark:bg-[#2B2D31] min-w-0'>
          <ServerSideBar serverId={serverId} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
