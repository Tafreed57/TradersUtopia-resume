import { Member, Profile, Message, Server } from '@prisma/client';

export type ServerWithMembersWithProfiles = Server & {
  members: (Member & { profile: Profile })[];
};

export type MessagesWithMemberWithProfile = Message & {
  member: Member & { profile: Profile };
};
