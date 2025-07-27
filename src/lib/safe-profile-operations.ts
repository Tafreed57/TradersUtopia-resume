import { db } from '@/lib/db';

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
