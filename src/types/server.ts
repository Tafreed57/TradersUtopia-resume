import {
  Member,
  User,
  Message,
  Server,
  Channel,
  Section,
  Role,
} from '@prisma/client';

export type ServerWithMembersWithUsers = Server & {
  members: (Member & { user: User; role: Role })[];
  channels: Channel[];
  sections: (Section & { channels: Channel[] })[];
};

export type MemberWithUserAndRole = Member & {
  user: User;
  role: Role;
};

// MessagesWithMemberWithUser removed - unused export

export type MessagesWithMemberWithUserAndRole = Message & {
  member: MemberWithUserAndRole;
  fileUrl?: string | null; // For backwards compatibility with existing code
};
