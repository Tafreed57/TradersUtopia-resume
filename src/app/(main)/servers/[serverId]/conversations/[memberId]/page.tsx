import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getConversation, getCurrentProfile } from '@/lib/query';
import { ChatHeader } from '@/components/chat/chat-header';
import { ChatMessages } from '@/components/chat/chat-messages';
import { ChatInput } from '@/components/chat/chat-input';

import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Traders Utopia | Conversation',
  description: 'Private conversation between trading community members',
  openGraph: {
    type: 'website',
  },
};

interface MemberIdPageProps {
  params: {
    memberId: string;
    serverId: string;
  };
  searchParams: {
    video?: boolean;
  };
}

const getOrCreateConversation = async (
  memberOneId: string,
  memberTwoId: string
) => {
  return await getConversation(memberOneId, memberTwoId);
};

export default async function MemberIdPage({
  params,
  searchParams,
}: MemberIdPageProps) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return auth().redirectToSignIn();
  }

  const conversation = await getOrCreateConversation(
    params.memberId,
    profile.id
  );

  if (!conversation) {
    return redirect(`/servers/${params.serverId}`);
  }

  const { memberOne, memberTwo } = conversation;
  const otherMember =
    memberOne.profileId === profile.id ? memberTwo : memberOne;

  return (
    <div className='bg-white dark:bg-[#313338] flex flex-col h-full'>
      <ChatHeader
        serverId={params.serverId}
        name={otherMember.profile.name}
        type='conversation'
        imageUrl={otherMember.profile.imageUrl || undefined}
      />

      <ChatMessages
        chatId={conversation.id}
        member={otherMember}
        name={otherMember.profile.name}
        type='conversation'
        apiUrl='/api/direct-messages'
        paramKey='conversationId'
        paramValue={conversation.id}
        socketUrl='/api/direct-messages'
        socketQuery={{
          conversationId: conversation.id,
        }}
      />
      <ChatInput
        name={otherMember.profile.name}
        type='conversation'
        apiUrl='/api/direct-messages'
        query={{
          conversationId: conversation.id,
        }}
        member={otherMember}
      />
    </div>
  );
}
