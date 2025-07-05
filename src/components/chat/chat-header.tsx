import { Hash } from 'lucide-react';
import { MobileToggle } from '@/components/mobile-toggle';
import { ServerWithMembersWithProfiles } from '@/types/server';
import { MemberRole } from '@prisma/client';

interface ChatHeaderProps {
  serverId: string;
  name: string;
  type: 'channel';
  imageUrl?: string;
  server?: ServerWithMembersWithProfiles;
  role?: MemberRole;
  servers?: Array<{
    id: string;
    name: string;
    imageUrl: string;
  }>;
}

export function ChatHeader({
  serverId,
  name,
  type,
  imageUrl,
  server,
  role,
  servers,
}: ChatHeaderProps) {
  return (
    <div className='text-md font-semibold px-3 flex items-center h-12 border-neutral-200 dark:border-neutral-800 border-b-2'>
      {server ? (
        <MobileToggle server={server} role={role} servers={servers} />
      ) : (
        <div className='md:hidden w-9 h-9' /> // Placeholder to maintain spacing
      )}
      <Hash className='w-5 h-5 text-zinc-500 dark:text-zinc-400 mr-2' />
      <p className='font-semibold text-md text-black dark:text-white'>{name}</p>
    </div>
  );
}
