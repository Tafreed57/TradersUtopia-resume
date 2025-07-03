import { prisma } from '@/lib/prismadb';
import { auth, currentUser, getAuth } from '@clerk/nextjs/server';
import { NextApiRequest } from 'next';
import { unstable_noStore as noStore } from 'next/cache';
import { redirect } from 'next/navigation';
import { createNotification } from '@/lib/notifications';
import {
  findOrCreateProfile,
  detectAndLogDuplicates,
} from '@/lib/safe-profile-operations';

// Login-triggered auto sync function
async function performLoginSync(userEmail: string) {
  try {
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔄 [Login Sync] Checking sync for email: ${userEmail}`);
    }

    // Find all profiles with this email
    const allProfiles = await prisma.profile.findMany({
      where: { email: userEmail },
      orderBy: { createdAt: 'desc' },
    });

    if (allProfiles.length <= 1) {
      if (process.env.NODE_ENV === 'development') {
        console.log(
          `ℹ️ [Login Sync] Only ${allProfiles.length} profile(s) found for ${userEmail}, no sync needed`
        );
      }
      return;
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(
        `🔍 [Login Sync] Found ${allProfiles.length} profiles for ${userEmail}`
      );
    }

    // Check if there's an ACTIVE profile to sync from
    const activeProfile = allProfiles.find(
      p => p.subscriptionStatus === 'ACTIVE'
    );
    const freeProfiles = allProfiles.filter(
      p => p.subscriptionStatus === 'FREE' && p.id !== activeProfile?.id
    );

    if (activeProfile && freeProfiles.length > 0) {
      if (process.env.NODE_ENV === 'development') {
        console.log(
          `✅ [Login Sync] Found ACTIVE profile ${activeProfile.id}, syncing to ${freeProfiles.length} FREE profile(s)`
        );
      }

      // Update all FREE profiles to match the ACTIVE one
      for (const freeProfile of freeProfiles) {
        await prisma.profile.update({
          where: { id: freeProfile.id },
          data: {
            subscriptionStatus: activeProfile.subscriptionStatus,
            subscriptionStart: activeProfile.subscriptionStart,
            subscriptionEnd: activeProfile.subscriptionEnd,
            stripeCustomerId: activeProfile.stripeCustomerId,
            stripeSessionId: activeProfile.stripeSessionId,
            stripeProductId: activeProfile.stripeProductId,
          },
        });
        if (process.env.NODE_ENV === 'development') {
          console.log(
            `🔄 [Login Sync] Synced profile ${freeProfile.id} to ACTIVE status`
          );
        }
      }
    } else {
      if (process.env.NODE_ENV === 'development') {
        console.log(
          `ℹ️ [Login Sync] No ACTIVE profile found to sync from, or no FREE profiles to sync to`
        );
      }
    }
  } catch (error) {
    console.error(`❌ [Login Sync] Failed for ${userEmail}:`, error);
  }
}

export async function initProfile() {
  noStore();

  try {
    const user = await currentUser();
    if (!user) return auth().redirectToSignIn();

    const userEmail = user.primaryEmailAddress?.emailAddress;

    // Use safe profile finding/creation to prevent duplicates
    try {
      const profile = await findOrCreateProfile();

      // Trigger background sync and duplicate detection
      if (userEmail) {
        Promise.resolve()
          .then(async () => {
            await performLoginSync(userEmail);
            await detectAndLogDuplicates();
          })
          .catch(error => {
            console.error(
              `❌ [Login Sync] Background operations failed for ${userEmail}:`,
              error
            );
          });
      }

      return profile;
    } catch (error) {
      console.error(`❌ [INIT_PROFILE] Error initializing profile:`, error);

      // Fallback to original logic if safe operations fail
      const profile = await prisma.profile.findUnique({
        where: { userId: user.id },
        select: {
          id: true,
          userId: true,
          name: true,
          email: true,
          imageUrl: true,
          createdAt: true,
          updatedAt: true,
          stripeCustomerId: true,
          stripeSessionId: true,
          subscriptionEnd: true,
          subscriptionStart: true,
          subscriptionStatus: true,
          stripeProductId: true,
          backupCodes: true,
          isAdmin: true,
          pushNotifications: true,
          pushSubscriptions: true,
        },
      });

      if (profile) return profile;

      // Create new profile as last resort
      const name =
        user?.fullName ||
        user?.firstName ||
        user?.lastName ||
        user.primaryEmailAddress?.emailAddress.split('@')[0] ||
        'unknown';

      const newProfile = await prisma.profile.create({
        data: {
          userId: user.id,
          email: user.primaryEmailAddress?.emailAddress as string,
          name: name,
          imageUrl: user?.imageUrl,
        },
      });

      // Create welcome notification for new users
      try {
        const welcomeMessage = `
🎉 **Welcome to Traders Utopia, ${newProfile.name}!** 

Your account has been successfully created. Explore the dashboard to customize your experience and start your trading journey.

**Get Started:**
• Set up your profile and preferences
• Join trading discussions and channels  
• Access premium trading signals and analysis
• Connect with our community of traders

**Need Help?** Use our support channels or check out our getting started guide.

Happy Trading! 📈
        `.trim();

        await createNotification({
          userId: user.id,
          type: 'SYSTEM',
          title: 'Welcome to TradersUtopia! 🎉',
          message: welcomeMessage,
          actionUrl: '/dashboard?tab=security',
        });
      } catch (error) {
        console.error('Failed to create welcome notification:', error);
      }

      return newProfile;
    }
  } catch (error) {
    console.error('❌ [initProfile] Clerk authentication error:', error);

    // If Clerk authentication fails, redirect to sign in
    return auth().redirectToSignIn();
  }
}

export async function getCurrentProfile() {
  try {
    const user = await currentUser();
    if (!user) return auth().redirectToSignIn();

    // Use upsert to handle potential race conditions and unique constraint violations
    const userEmail = user.primaryEmailAddress?.emailAddress;
    const name =
      user?.fullName ||
      user?.firstName ||
      user?.lastName ||
      user.primaryEmailAddress?.emailAddress.split('@')[0] ||
      'unknown';

    const profile = await prisma.profile.upsert({
      where: {
        userId: user.id,
      },
      update: {
        // Only update fields that should sync from Clerk - preserve isAdmin and other important fields
        name: name,
        email: userEmail as string,
        imageUrl: user?.imageUrl,
        // Note: isAdmin, subscriptionStatus, and other critical fields are preserved
      },
      create: {
        userId: user.id,
        email: userEmail as string,
        name: name,
        imageUrl: user?.imageUrl,
        // isAdmin defaults to false for new profiles (as expected)
      },
    });

    // Trigger sync in case there are other profiles with same email (only for new profiles)
    if (userEmail && profile) {
      Promise.resolve()
        .then(() => {
          performLoginSync(userEmail);
        })
        .catch(error => {
          console.error(
            `❌ [Login Sync] Background sync failed for ${userEmail}:`,
            error
          );
        });
    }

    return profile;
  } catch (error) {
    console.error('❌ [getCurrentProfile] Error:', error);

    // If there's still an error, try to find existing profile one more time
    try {
      const user = await currentUser();
      if (user) {
        const existingProfile = await prisma.profile.findUnique({
          where: { userId: user.id },
          select: {
            id: true,
            userId: true,
            name: true,
            email: true,
            imageUrl: true,
            createdAt: true,
            updatedAt: true,
            stripeCustomerId: true,
            stripeSessionId: true,
            subscriptionEnd: true,
            subscriptionStart: true,
            subscriptionStatus: true,
            stripeProductId: true,
            backupCodes: true,
            isAdmin: true,
            pushNotifications: true,
            pushSubscriptions: true,
          },
        });
        if (existingProfile) {
          return existingProfile;
        }
      }
    } catch (fallbackError) {
      console.error('❌ [getCurrentProfile] Fallback error:', fallbackError);
    }

    // If all else fails, redirect to sign in
    return auth().redirectToSignIn();
  }
}

export async function getCurrentProfilePage(req: NextApiRequest) {
  const authInfo = await getAuth(req);
  if (!authInfo.sessionId) return auth().redirectToSignIn();

  const profile = await prisma.profile.findUnique({
    where: {
      userId: authInfo.userId as string,
    },
    select: {
      id: true,
      userId: true,
      name: true,
      email: true,
      imageUrl: true,
      createdAt: true,
      updatedAt: true,
      stripeCustomerId: true,
      stripeSessionId: true,
      subscriptionEnd: true,
      subscriptionStart: true,
      subscriptionStatus: true,
      stripeProductId: true,
      backupCodes: true,
      isAdmin: true,
      pushNotifications: true,
      pushSubscriptions: true,
    },
  });
  if (profile) return profile;
}

export async function getServer(id: string, profileId: string) {
  const server = await prisma.server.findUnique({
    where: {
      id,
      members: {
        some: {
          profileId,
        },
      },
    },
    include: {
      channels: {
        orderBy: {
          createdAt: 'asc',
        },
      },
      members: {
        include: {
          profile: true,
        },
        orderBy: {
          role: 'asc',
        },
      },
    },
  });
  if (server) return server;
}

export async function getGeneralServer(id: string, profileId: string) {
  const server = await prisma.server.findUnique({
    where: {
      id,
      members: {
        some: {
          profileId,
        },
      },
    },
    include: {
      channels: {
        where: {
          name: 'general',
        },
        orderBy: {
          createdAt: 'asc',
        },
      },
    },
  });
  if (server?.channels[0]?.name !== 'general') return null;
  if (server) return server;
}

export async function getAllServers(id: string) {
  const servers = await prisma.server.findMany({
    where: {
      members: {
        some: {
          profileId: id,
        },
      },
    },
  });
  if (servers) return servers;
}

export async function getFirstServer(id: string) {
  const server = await prisma.server.findFirst({
    where: {
      members: {
        some: {
          profileId: id,
        },
      },
    },
  });
  if (server) return redirect(`/servers/${server.id}`);
}

export async function getServerByInviteCode(
  inviteCode: string,
  profileId: string
) {
  const server = await prisma.server.findFirst({
    where: {
      inviteCode,
      members: {
        some: {
          profileId,
        },
      },
    },
  });
  return server;
}

export async function getMember(serverId: string, profileId: string) {
  const member = await prisma.member.findFirst({
    where: {
      serverId,
      profileId,
    },
  });
  if (member) return member;
}

export async function getChannel(channelId: string) {
  const channel = await prisma.channel.findUnique({
    where: {
      id: channelId,
    },
  });
  if (channel) return channel;
}

export async function getConversation(
  memberOneId: string,
  memberTwoId: string
) {
  try {
    const conversation = await prisma.conversation.findFirst({
      where: {
        AND: [
          {
            memberOneId: memberOneId,
          },
          {
            memberTwoId: memberTwoId,
          },
        ],
      },
      include: {
        memberOne: {
          include: {
            profile: true,
          },
        },
        memberTwo: {
          include: {
            profile: true,
          },
        },
      },
    });
    return conversation;
  } catch (error) {
    console.log(error);
    return null;
  }
}

export async function createConversation(
  memberOneId: string,
  memberTwoId: string
) {
  try {
    const conversation = await prisma.conversation.create({
      data: {
        memberOneId,
        memberTwoId,
      },
      include: {
        memberOne: {
          include: {
            profile: true,
          },
        },
        memberTwo: {
          include: {
            profile: true,
          },
        },
      },
    });
    return conversation;
  } catch (error) {
    console.log(error);
    return null;
  }
}

export async function getOrCreateConversation(
  memberOneId: string,
  memberTwoId: string
) {
  if (!memberOneId || !memberTwoId) return;
  const conversation =
    (await getConversation(memberOneId, memberTwoId)) ||
    (await getConversation(memberTwoId, memberOneId));
  if (conversation) return conversation;
  const newConversation = await createConversation(memberOneId, memberTwoId);
  return newConversation;
}

export async function getCurrentMember(serverId: string, profileId: string) {
  const member = await prisma.member.findFirst({
    where: {
      serverId,
      profileId,
    },
    include: {
      profile: true,
    },
  });
  if (member) return member;
}
