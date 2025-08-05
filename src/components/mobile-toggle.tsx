'use client';

import { useState, useEffect, useCallback } from 'react';
import { Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ServerWithMembersWithUsers } from '@/types/server';
import { Role } from '@prisma/client';
import { MobileCompleteSidebar } from '@/components/mobile-complete-sidebar';

interface MobileToggleProps {
  server: ServerWithMembersWithUsers;
  role?: Role;
  servers?: Array<{
    id: string;
    name: string;
    imageUrl: string;
  }>;
  onChannelClick?: (channelId: string) => void;
  activeChannelId?: string | null;
}

export function MobileToggle({
  server,
  role,
  servers,
  onChannelClick,
  activeChannelId,
}: MobileToggleProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Prevent hydration mismatch by ensuring component only renders on client
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Wrapper function that closes the mobile sidebar when a channel is clicked
  const handleChannelClick = useCallback(
    (channelId: string) => {
      if (onChannelClick) {
        onChannelClick(channelId);
      }
      setIsOpen(false); // Close the mobile sidebar
    },
    [onChannelClick]
  );

  if (!isMounted) {
    return (
      <Button variant='ghost' size='icon' className='md:hidden' disabled>
        <Menu />
      </Button>
    );
  }

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant='ghost'
          size='icon'
          className='md:hidden
          min-h-[2.75rem] min-w-[2.75rem] h-11 w-11 md:h-10 md:w-10
          touch-manipulation'
        >
          <Menu className='h-5 w-5' />
        </Button>
      </SheetTrigger>
      <SheetContent
        side='left'
        className='p-0 flex gap-0 max-w-[90vw] w-[400px]'
        style={{
          paddingTop: `calc(1.5rem + env(safe-area-inset-top))`,
        }}
      >
        <div className='w-full h-full'>
          <MobileCompleteSidebar
            server={server}
            role={role}
            servers={servers || []}
            onChannelClick={handleChannelClick}
            activeChannelId={activeChannelId}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
