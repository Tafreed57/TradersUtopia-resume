import { db } from '@/lib/db';
import { currentUser } from '@clerk/nextjs/server';

/**
 * Safely find or create a profile, preventing duplicates
 */
export async function findOrCreateProfile() {
  const user = await currentUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  const userEmail = user.emailAddresses[0]?.emailAddress;
  if (!userEmail) {
    throw new Error('User email not found');
  }

  // First, try to find by userId (most reliable)
  let profile = await db.profile.findUnique({
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

  if (profile) {
    if (process.env.NODE_ENV === 'development') {
      console.log(
        `✅ [SAFE_PROFILE] Found existing profile by userId: ${profile.id}`
      );
    }
    return profile;
  }

  // If no profile by userId, check for existing profiles by email
  const existingProfiles = await db.profile.findMany({
    where: { email: userEmail },
    orderBy: { updatedAt: 'desc' },
  });

  if (existingProfiles.length > 0) {
    console.log(
      `🔄 [SAFE_PROFILE] Found ${existingProfiles.length} existing profiles for ${userEmail}`
    );

    // Use the most recent profile and update its userId
    const latestProfile = existingProfiles[0];

    try {
      profile = await db.profile.update({
        where: { id: latestProfile.id },
        data: {
          userId: user.id,
          name: user.fullName || user.firstName || latestProfile.name,
          imageUrl: user.imageUrl || latestProfile.imageUrl,
        },
      });

      console.log(
        `✅ [SAFE_PROFILE] Updated existing profile ${profile.id} with userId ${user.id}`
      );

      // Clean up any remaining duplicates
      if (existingProfiles.length > 1) {
        const duplicatesToDelete = existingProfiles.slice(1);
        for (const duplicate of duplicatesToDelete) {
          console.log(
            `🗑️ [SAFE_PROFILE] Cleaning up duplicate profile: ${duplicate.id}`
          );
          await db.profile
            .delete({
              where: { id: duplicate.id },
            })
            .catch(err => {
              console.error(
                `❌ [SAFE_PROFILE] Failed to delete duplicate ${duplicate.id}:`,
                err
              );
            });
        }
      }

      return profile;
    } catch (error) {
      console.error(
        `❌ [SAFE_PROFILE] Failed to update existing profile:`,
        error
      );
      // Fall through to create new profile
    }
  }

  // Use upsert to safely create profile or update existing one
  const name =
    user.fullName ||
    user.firstName ||
    user.lastName ||
    userEmail.split('@')[0] ||
    'Unknown User';

  try {
    profile = await db.profile.upsert({
      where: { userId: user.id },
      update: {
        name: name,
        email: userEmail,
        imageUrl: user.imageUrl,
      },
      create: {
        userId: user.id,
        email: userEmail,
        name: name,
        imageUrl: user.imageUrl,
      },
    });

    console.log(
      `✅ [SAFE_PROFILE] Upserted profile: ${profile.id} for ${userEmail}`
    );
    return profile;
  } catch (error) {
    console.error(`❌ [SAFE_PROFILE] Failed to upsert profile:`, error);

    // Final fallback - try to find existing profile
    profile = await db.profile.findUnique({
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

    if (profile) {
      console.log(
        `✅ [SAFE_PROFILE] Found profile after failed upsert: ${profile.id}`
      );
      return profile;
    }

    throw new Error('Failed to create or find profile');
  }
}

/**
 * Check for and fix any duplicate profiles in the system
 */
export async function detectAndLogDuplicates() {
  try {
    const allProfiles = await db.profile.findMany({
      select: { id: true, email: true, userId: true },
    });

    const profilesByEmail = allProfiles.reduce(
      (acc, profile) => {
        if (!acc[profile.email]) {
          acc[profile.email] = [];
        }
        acc[profile.email].push(profile);
        return acc;
      },
      {} as Record<string, typeof allProfiles>
    );

    const duplicates = Object.entries(profilesByEmail).filter(
      ([email, profiles]) => profiles.length > 1
    );

    if (duplicates.length > 0) {
      console.warn(
        `⚠️ [DUPLICATE_DETECTION] Found ${duplicates.length} emails with duplicate profiles:`
      );
      duplicates.forEach(([email, profiles]) => {
        console.warn(
          `   📧 ${email}: ${profiles.length} profiles (${profiles.map(p => p.id).join(', ')})`
        );
      });
      return duplicates;
    } else {
      console.log(`✅ [DUPLICATE_DETECTION] No duplicate profiles found`);
      return [];
    }
  } catch (error) {
    console.error(
      `❌ [DUPLICATE_DETECTION] Error checking for duplicates:`,
      error
    );
    return [];
  }
}

/**
 * Safely grant admin access, handling potential duplicates
 */
export async function safeGrantAdmin(targetUserId: string): Promise<boolean> {
  try {
    // Find all profiles for this user
    const allProfiles = await db.profile.findMany({
      where: { userId: targetUserId },
    });

    if (allProfiles.length === 0) {
      console.error(
        `❌ [SAFE_ADMIN] No profiles found for user: ${targetUserId}`
      );
      return false;
    }

    if (allProfiles.length === 1) {
      // Simple case - update the single profile
      await db.profile.update({
        where: { id: allProfiles[0].id },
        data: { isAdmin: true },
      });
      console.log(
        `✅ [SAFE_ADMIN] Granted admin to profile: ${allProfiles[0].id}`
      );
      return true;
    }

    // Multiple profiles - update all of them to ensure consistency
    console.log(
      `🔄 [SAFE_ADMIN] Found ${allProfiles.length} profiles for user ${targetUserId}, updating all`
    );

    for (const profile of allProfiles) {
      await db.profile.update({
        where: { id: profile.id },
        data: { isAdmin: true },
      });
      console.log(`✅ [SAFE_ADMIN] Updated profile ${profile.id} to admin`);
    }

    return true;
  } catch (error) {
    console.error(
      `❌ [SAFE_ADMIN] Error granting admin to ${targetUserId}:`,
      error
    );
    return false;
  }
}
