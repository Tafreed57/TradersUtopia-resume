import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { rateLimitGeneral, trackSuspiciousActivity } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // ✅ SECURITY: Rate limiting
    const rateLimitResult = await rateLimitGeneral()(request);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(request, 'BACKFILL_RATE_LIMIT_EXCEEDED');
      return rateLimitResult.error;
    }

    // ✅ SECURITY: Admin-only endpoint
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const profile = await db.profile.findFirst({
      where: { userId: user.id },
    });

    if (!profile?.isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    console.log('🔄 [BACKFILL-ORIGINAL-AMOUNT] Starting backfill process...');

    // Find profiles with discounts but missing originalAmount
    const profilesToUpdate = await db.profile.findMany({
      where: {
        AND: [
          { discountPercent: { not: null } },
          { discountPercent: { gt: 0 } },
          { subscriptionAmount: { not: null } },
          { originalAmount: null }, // Missing originalAmount
        ],
      },
      select: {
        id: true,
        email: true,
        subscriptionAmount: true,
        discountPercent: true,
        originalAmount: true,
      },
    });

    console.log(
      `📊 [BACKFILL-ORIGINAL-AMOUNT] Found ${profilesToUpdate.length} profiles to update`
    );

    let updatedCount = 0;
    const updateResults = [];

    for (const profile of profilesToUpdate) {
      try {
        // Calculate original amount from discounted amount
        // If current = $105 and discount = 30%, then original = $105 / (1 - 0.30) = $150
        const discountedAmount = profile.subscriptionAmount!;
        const discountPercent = profile.discountPercent!;
        const originalAmount = Math.round(
          discountedAmount / (1 - discountPercent / 100)
        );

        await db.profile.update({
          where: { id: profile.id },
          data: { originalAmount },
        });

        const result = {
          email: profile.email,
          discountedAmount: `$${(discountedAmount / 100).toFixed(2)}`,
          discountPercent: `${discountPercent}%`,
          calculatedOriginal: `$${(originalAmount / 100).toFixed(2)}`,
        };

        updateResults.push(result);
        updatedCount++;

        console.log(
          `✅ [BACKFILL-ORIGINAL-AMOUNT] Updated ${profile.email}:`,
          result
        );
      } catch (error) {
        console.error(
          `❌ [BACKFILL-ORIGINAL-AMOUNT] Error updating ${profile.email}:`,
          error
        );
        updateResults.push({
          email: profile.email,
          error: 'Update failed',
        });
      }
    }

    console.log(
      `🎉 [BACKFILL-ORIGINAL-AMOUNT] Completed! Updated ${updatedCount}/${profilesToUpdate.length} profiles`
    );

    return NextResponse.json({
      success: true,
      message: `Backfill completed successfully`,
      stats: {
        totalFound: profilesToUpdate.length,
        totalUpdated: updatedCount,
        totalFailed: profilesToUpdate.length - updatedCount,
      },
      updates: updateResults,
    });
  } catch (error) {
    console.error('❌ [BACKFILL-ORIGINAL-AMOUNT] Error:', error);
    return NextResponse.json(
      {
        error: 'Backfill failed',
        message: 'Unable to complete backfill process. Please try again later.',
      },
      { status: 500 }
    );
  }
}
