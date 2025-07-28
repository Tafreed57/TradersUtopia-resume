import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { UserService } from '@/services/database/user-service';
import { ServerService } from '@/services/database/server-service';
import { MemberService } from '@/services/database/member-service';
import { ChannelService } from '@/services/database/channel-service';

// Initialize services
const userService = new UserService();
const serverService = new ServerService();
const memberService = new MemberService();
const channelService = new ChannelService();

// Login-triggered auto sync function
async function performLoginSync(userEmail: string) {
  try {
    // This functionality would need to be implemented as a proper service method
    // For now, we'll skip the complex sync logic and leave it as a placeholder
    console.log(
      `Login sync for ${userEmail} - TODO: Implement with proper service`
    );
  } catch (error) {
    console.error(`❌ [Login Sync] Failed for ${userEmail}:`, error);
  }
}

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

// PERFORMANCE: Use this for dashboard/server access that might need login sync
export async function getCurrentProfileWithSync() {
  try {
    const user = await currentUser();
    if (!user) return (await auth()).redirectToSignIn();

    const userEmail = user.primaryEmailAddress?.emailAddress;
    const name =
      user?.fullName ||
      user?.firstName ||
      user?.lastName ||
      user.primaryEmailAddress?.emailAddress.split('@')[0] ||
      'unknown';

    // First check if profile exists
    const existingProfile = await userService.findByClerkId(user.id);

    if (existingProfile) {
      // Profile exists, only sync if it's the first access in a while (session-based)
      const lastSync = new Date(existingProfile.updatedAt);
      const timeSinceLastUpdate = Date.now() - lastSync.getTime();
      const shouldSync = timeSinceLastUpdate > 24 * 60 * 60 * 1000; // 24 hours

      if (userEmail && shouldSync) {
        // Background sync for periodic cleanup
        Promise.resolve()
          .then(() => performLoginSync(userEmail))
          .catch(error => {
            console.error(`❌ [Login Sync] Background sync failed:`, error);
          });
      }

      return existingProfile;
    }

    // Profile doesn't exist, create it and run sync
    const profile = await userService.createUser({
      userId: user.id,
      email: userEmail as string,
      name: name,
      imageUrl: user?.imageUrl,
    });

    // For now, skip the member creation as it requires more complex server setup
    // This would need to be handled properly in a production environment

    if (userEmail) {
      // Run sync for new profiles
      Promise.resolve()
        .then(() => performLoginSync(userEmail))
        .catch(error => {
          console.error(`❌ [Login Sync] New profile sync failed:`, error);
        });
    }

    return profile;
  } catch (error) {
    console.error('❌ [getCurrentProfileWithSync] Error:', error);

    // Check if user is actually authenticated but there's just a temporary issue
    try {
      const { userId } = await auth();
      if (userId) {
        console.error(
          '🔴 [Profile Error] User is authenticated but profile loading failed. This might be a temporary database issue.'
        );
        console.error(
          '🔄 [Profile Error] Throwing error instead of redirecting to prevent homepage redirect loop'
        );
        throw error;
      }
    } catch (authError) {
      console.error('❌ [Auth Error] User not authenticated:', authError);
    }

    // Only redirect to sign-in if user is actually not authenticated
    return (await auth()).redirectToSignIn();
  }
}

export async function getCurrentProfile() {
  const { userId } = await auth();

  if (!userId) {
    return null;
  }

  return await userService.findByClerkId(userId);
}

export async function getServer(serverId: string, profileId: string) {
  return await serverService.findServerWithMemberAccess(serverId, profileId);
}

export async function getGeneralServer(id: string, profileId: string) {
  // This function would need to be implemented as a proper service method
  // For now, we'll return null as a placeholder
  return null;
}

export async function getAllServers(id: string) {
  return await serverService.listServersForUser(id);
}

async function getFirstServer(id: string) {
  const servers = await serverService.listServersForUser(id);
  const server = servers[0];
  if (server) return redirect(`/servers/${server.id}`);
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
