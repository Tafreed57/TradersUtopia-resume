import {
  Member,
  Profile,
  Message,
  Server,
  Channel,
  Section,
} from '@prisma/client';

export type ServerWithMembersWithProfiles = Server & {
  members: (Member & { profile: Profile })[];
  channels: Channel[];
  sections: (Section & { channels: Channel[] })[];
};

export type MessagesWithMemberWithProfile = Message & {
  member: Member & { profile: Profile };
};
