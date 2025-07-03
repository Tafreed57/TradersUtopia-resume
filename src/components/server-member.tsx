'use client';

import { UserAvatar } from '@/components/user/user-avatar';
import { cn } from '@/lib/utils';
import { Member, MemberRole, Profile, Server } from '@prisma/client';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import React from 'react';

interface ServerMemberProps {
  member: Member & { profile: Profile };
  server: Server;
}

const roleIconMap = {
  [MemberRole.GUEST]: null,
  [MemberRole.ADMIN]: <ShieldAlert className='text-rose-500 ml-2 h-4 w-4' />,
  [MemberRole.MODERATOR]: (
    <ShieldCheck className='text-indigo-500 ml-2 h-4 w-4' />
  ),
};

export function ServerMember({ member, server }: ServerMemberProps) {
  const params = useParams();
  const router = useRouter();

  const icon = roleIconMap[member.role];
  const onClick = () => {
    router.push(`/servers/${params?.serverId}/conversations/${member.id}`);
  };
  return (
    <button
      onClick={onClick}
      className={cn(
        'group px-2 py-2 rounded-xl flex items-center gap-x-2 w-full hover:bg-gradient-to-r hover:from-gray-700/30 hover:to-gray-600/30 hover:backdrop-blur-sm transition-all duration-300 mb-1 border border-transparent hover:border-gray-600/20',
        params?.memberId === member.id &&
          'bg-gradient-to-r from-blue-600/20 to-purple-600/20 border-blue-400/30 backdrop-blur-sm'
      )}
    >
      <UserAvatar
        src={member?.profile?.imageUrl ?? undefined}
        className='h-8 w-8 md:h-8 md:w-8'
      />
      <p
        className={cn(
          'font-semibold text-sm text-gray-300 group-hover:text-white transition',
          params?.memberId === member.id && 'text-white'
        )}
      >
        {member.profile?.name}
      </p>
      {icon}
    </button>
  );
}
