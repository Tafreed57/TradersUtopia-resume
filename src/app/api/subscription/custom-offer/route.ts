import { NextRequest, NextResponse } from 'next/server';
import { withAuth, authHelpers } from '@/middleware/auth-middleware';
import { rateLimitSubscription } from '@/lib/rate-limit';
import { DiscountOfferService } from '@/services';
import { apiLogger } from '@/lib/enhanced-logger';
import { z } from 'zod';

const getOfferSchema = z.object({
  subscriptionId: z.string().min(1, 'Subscription ID is required'),
});

/**
 * GET /api/subscription/custom-offer
 * Check for existing active custom discount offer for the user
 */
export const GET = withAuth(async (request: NextRequest, { user }) => {
  // Rate limiting
  const rateLimitResult = await rateLimitSubscription()(request);
  if (!rateLimitResult.success) {
    return rateLimitResult.error;
  }

  // Get subscription ID from query params
  const { searchParams } = new URL(request.url);
  const subscriptionId = searchParams.get('subscriptionId');

  if (!subscriptionId) {
    return NextResponse.json(
      { success: false, error: 'Subscription ID is required' },
      { status: 400 }
    );
  }

  // Validate input
  const validationResult = getOfferSchema.safeParse({ subscriptionId });
  if (!validationResult.success) {
    return NextResponse.json(
      {
        success: false,
        error: 'Invalid input',
        details: validationResult.error.errors,
      },
      { status: 400 }
    );
  }

  const discountOfferService = new DiscountOfferService();
  const activeOffer = await discountOfferService.getActiveOffer(
    user.id,
    subscriptionId
  );

  if (!activeOffer) {
    return NextResponse.json({
      success: true,
      hasOffer: false,
      offer: null,
    });
  }

  apiLogger.databaseOperation('custom_discount_offer_retrieved_via_api', true, {
    userId: user.id.substring(0, 8),
    subscriptionId: subscriptionId.substring(0, 8),
    offerId: activeOffer.id.substring(0, 8),
    offerPriceCents: activeOffer.offerPriceCents,
  });

  return NextResponse.json({
    success: true,
    hasOffer: true,
    offer: {
      id: activeOffer.id,
      originalPriceCents: activeOffer.originalPriceCents,
      userInputCents: activeOffer.userInputCents,
      offerPriceCents: activeOffer.offerPriceCents,
      discountPercent: activeOffer.discountPercent,
      savingsCents: activeOffer.savingsCents,
      expiresAt: activeOffer.expiresAt.toISOString(),
    },
  });
}, authHelpers.subscriberOnly('GET_CUSTOM_DISCOUNT_OFFER'));
