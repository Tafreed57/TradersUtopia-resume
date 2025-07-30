import { auth } from '@clerk/nextjs/server';
import { UserService } from '@/services/database/user-service';
import { ServerService } from '@/services/database/server-service';
import { MemberService } from '@/services/database/member-service';
import { ChannelService } from '@/services/database/channel-service';

// Initialize services
const userService = new UserService();
const serverService = new ServerService();
const memberService = new MemberService();
const channelService = new ChannelService();

export async function getCurrentProfileForAuth() {
  const { userId } = await auth();

  if (!userId) {
    throw new Error('Unauthorized');
  }

  const profile = await userService.findByClerkId(userId);

  if (!profile) {
    throw new Error('Profile not found');
  }

  return profile;
}

export async function getServer(serverId: string, profileId: string) {
  return await serverService.findServerWithMemberAccess(serverId, profileId);
}

export async function getAllServers(id: string) {
  return await serverService.listServersForUser(id);
}

export async function getMember(serverId: string, profileId: string) {
  return await memberService.findMemberByUserAndServer(profileId, serverId);
}

export async function getChannel(channelId: string, userId: string) {
  return await channelService.findChannelWithAccess(channelId, userId);
}

export async function getAdminProfile(userId: string) {
  const user = await userService.findAdminById(userId);
  if (!user) {
    throw new Error('Profile not found or insufficient permissions');
  }
  return user;
}
