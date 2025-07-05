'use client';

import { UserAvatar } from '@/components/user/user-avatar';
import { Member, MemberRole, Profile, Server } from '@prisma/client';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
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
  const icon = roleIconMap[member.role];

  return (
    <div className='group px-2 py-2 rounded-xl flex items-center gap-x-2 w-full mb-1 border border-transparent'>
      <UserAvatar
        src={member?.profile?.imageUrl ?? undefined}
        className='h-8 w-8 md:h-8 md:w-8'
      />
      <p className='font-semibold text-sm text-gray-300'>
        {member.profile?.name}
      </p>
      {icon}
    </div>
  );
}
