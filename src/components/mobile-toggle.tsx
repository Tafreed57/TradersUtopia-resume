'use client';

import { useState, useEffect } from 'react';
import { Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ServerWithMembersWithProfiles } from '@/types/server';
import { MemberRole } from '@prisma/client';
import { MobileCompleteSidebar } from '@/components/mobile-complete-sidebar';

interface MobileToggleProps {
  server: ServerWithMembersWithProfiles;
  role?: MemberRole;
  servers?: Array<{
    id: string;
    name: string;
    imageUrl: string;
  }>;
}

export function MobileToggle({ server, role, servers }: MobileToggleProps) {
  const [isMounted, setIsMounted] = useState(false);

  // Prevent hydration mismatch by ensuring component only renders on client
  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <Button variant='ghost' size='icon' className='md:hidden' disabled>
        <Menu />
      </Button>
    );
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant='ghost' size='icon' className='md:hidden'>
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent
        side='left'
        className='p-0 flex gap-0 max-w-[90vw] w-[400px]'
      >
        <div className='w-full h-full'>
          <MobileCompleteSidebar
            server={server}
            role={role}
            servers={servers || []}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
