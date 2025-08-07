import { auth } from '@clerk/nextjs/server';
import { UserService } from '@/services/database/user-service';
import { ServerService } from '@/services/database/server-service';

// Initialize services
const userService = new UserService();
const serverService = new ServerService();

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

export async function getAllServers(id: string) {
  return await serverService.listServersForUser(id);
}
