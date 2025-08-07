import { NextRequest, NextResponse } from 'next/server';
import { withAuth, authHelpers } from '@/middleware/auth-middleware';
import { rateLimitSubscription } from '@/lib/rate-limit';
import { apiLogger } from '@/lib/enhanced-logger';
import { z } from 'zod';
import { DiscountOfferService } from '@/services/database/discount-offer-service';

const rejectOfferSchema = z.object({
  subscriptionId: z.string().min(1, 'Subscription ID is required'),
  originalPriceCents: z
    .number()
    .min(1, 'Original price must be greater than 0'),
  userInputCents: z.number().min(1, 'User input price must be greater than 0'),
  offerPriceCents: z.number().min(1, 'Offer price must be greater than 0'),
  discountPercent: z
    .number()
    .min(0)
    .max(100, 'Discount percent must be between 0 and 100'),
});

/**
 * POST /api/subscription/custom-offer/reject
 * Store a rejected custom discount offer in the database
 */
export const POST = withAuth(async (request: NextRequest, { user }) => {
  // Rate limiting
  const rateLimitResult = await rateLimitSubscription()(request);
  if (!rateLimitResult.success) {
    return rateLimitResult.error;
  }

  // Parse and validate request body
  const body = await request.json();
  const validationResult = rejectOfferSchema.safeParse(body);

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

  const {
    subscriptionId,
    originalPriceCents,
    userInputCents,
    offerPriceCents,
    discountPercent,
  } = validationResult.data;

  // Validate business logic
  if (offerPriceCents >= userInputCents) {
    return NextResponse.json(
      {
        success: false,
        error: 'Offer price must be less than user input price',
      },
      { status: 400 }
    );
  }

  if (originalPriceCents <= offerPriceCents) {
    return NextResponse.json(
      {
        success: false,
        error: 'Original price must be greater than offer price',
      },
      { status: 400 }
    );
  }

  const discountOfferService = new DiscountOfferService();

  // Store the rejected offer
  const storedOffer = await discountOfferService.storeRejectedOffer({
    userId: user.id,
    subscriptionId,
    originalPriceCents,
    userInputCents,
    offerPriceCents,
    discountPercent,
  });

  apiLogger.databaseOperation(
    'custom_discount_offer_rejected_and_stored',
    true,
    {
      userId: user.id.substring(0, 8),
      subscriptionId: subscriptionId.substring(0, 8),
      offerId: storedOffer.id.substring(0, 8),
      offerPriceCents,
      discountPercent,
      expiresAt: storedOffer.expiresAt.toISOString(),
    }
  );

  return NextResponse.json({
    success: true,
    message: 'Discount offer saved for future use',
    offer: {
      id: storedOffer.id,
      offerPriceCents: storedOffer.offerPriceCents,
      discountPercent: storedOffer.discountPercent,
      expiresAt: storedOffer.expiresAt.toISOString(),
    },
  });
}, authHelpers.subscriberOnly('REJECT_CUSTOM_DISCOUNT_OFFER'));
