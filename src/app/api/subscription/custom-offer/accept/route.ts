import { NextRequest, NextResponse } from 'next/server';
import { withAuth, authHelpers } from '@/middleware/auth-middleware';
import { rateLimitSubscription } from '@/lib/rate-limit';
import { DiscountOfferService } from '@/services';
import { apiLogger } from '@/lib/enhanced-logger';
import { z } from 'zod';

const acceptOfferSchema = z.object({
  offerId: z.string().min(1, 'Offer ID is required'),
});

/**
 * POST /api/subscription/custom-offer/accept
 * Accept a stored custom discount offer and apply it via Stripe
 */
export const POST = withAuth(async (request: NextRequest, { user }) => {
  // Rate limiting
  const rateLimitResult = await rateLimitSubscription()(request);
  if (!rateLimitResult.success) {
    return rateLimitResult.error;
  }

  // Parse and validate request body
  const body = await request.json();
  const validationResult = acceptOfferSchema.safeParse(body);

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

  const { offerId } = validationResult.data;

  const discountOfferService = new DiscountOfferService();

  // First, get the offer to verify it exists and is valid
  const offer = await discountOfferService.getOfferById(offerId);

  if (!offer) {
    return NextResponse.json(
      { success: false, error: 'Discount offer not found' },
      { status: 404 }
    );
  }

  // Verify the offer belongs to the authenticated user
  if (offer.userId !== user.id) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized access to offer' },
      { status: 403 }
    );
  }

  // Check if offer is still valid
  const now = new Date();
  if (now > offer.expiresAt || offer.isExpired) {
    return NextResponse.json(
      { success: false, error: 'Discount offer has expired' },
      { status: 400 }
    );
  }

  if (offer.acceptedAt) {
    return NextResponse.json(
      { success: false, error: 'Offer has already been accepted' },
      { status: 400 }
    );
  }

  // Calculate discount percentage for UI to use with apply-coupon endpoint
  const totalDiscountCents = offer.originalPriceCents - offer.offerPriceCents;
  const percentOff = Math.round(
    (totalDiscountCents / offer.originalPriceCents) * 100
  );

  // Mark the offer as accepted in the database
  const acceptedOffer = await discountOfferService.acceptOffer(offerId);

  apiLogger.databaseOperation('custom_discount_offer_accepted', true, {
    userId: user.id.substring(0, 8),
    offerId: offerId.substring(0, 8),
    subscriptionId: offer.subscriptionId.substring(0, 8),
    offerPriceCents: offer.offerPriceCents,
    percentOff,
    acceptedAt: acceptedOffer.acceptedAt?.toISOString(),
  });

  return NextResponse.json({
    success: true,
    message: 'Discount offer accepted successfully',
    offer: {
      id: acceptedOffer.id,
      subscriptionId: offer.subscriptionId,
      originalPriceCents: offer.originalPriceCents,
      offerPriceCents: acceptedOffer.offerPriceCents,
      discountPercent: acceptedOffer.discountPercent,
      percentOff,
      acceptedAt: acceptedOffer.acceptedAt?.toISOString(),
    },
    // Data for UI to call apply-coupon endpoint
    applyCouponData: {
      percentOff,
      newMonthlyPrice: offer.offerPriceCents,
      currentPrice: offer.originalPriceCents,
      originalPrice: offer.originalPriceCents,
      subscriptionId: offer.subscriptionId,
    },
  });
}, authHelpers.subscriberOnly('ACCEPT_CUSTOM_DISCOUNT_OFFER'));
