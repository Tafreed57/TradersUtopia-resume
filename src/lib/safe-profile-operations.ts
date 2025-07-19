import { db } from '@/lib/db';

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
      return true;
    }

    // Multiple profiles - update all of them to ensure consistency
    for (const profile of allProfiles) {
      await db.profile.update({
        where: { id: profile.id },
        data: { isAdmin: true },
      });
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
