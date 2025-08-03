import type { CustomDiscountOffer } from '@prisma/client';
import { BaseDatabaseService } from './base-service';
import { DatabaseError, ValidationError, ServiceError } from './errors';
import { apiLogger } from '@/lib/enhanced-logger';
import type { PrismaTransaction } from './types';

/**
 * Service for managing custom discount offers during cancellation flow.
 * Handles creation, retrieval, acceptance, and expiration of personalized discount offers.
 */
export class DiscountOfferService extends BaseDatabaseService {
  private readonly serviceName = 'DiscountOfferService';

  /**
   * Generate a random discount percentage between 5-10%
   */
  private generateRandomDiscount(): number {
    const minDiscount = 5;
    const maxDiscount = 10;
    const discount = Math.random() * (maxDiscount - minDiscount) + minDiscount;
    return Math.round(discount * 100) / 100; // Round to 2 decimals
  }

  /**
   * Calculate offer details based on user input and generated discount
   * Ensures minimum offer price of $20 (2000 cents)
   */
  public calculateOfferDetails(userInputCents: number): {
    discountPercent: number;
    offerPriceCents: number;
    savingsCents: number;
  } {
    try {
      this.validateRequired(userInputCents, 'userInputCents');

      if (userInputCents <= 0) {
        throw new ValidationError('User input price must be greater than 0');
      }

      const minOfferPriceCents = 2000; // $20 minimum

      // If user input is already at or below minimum, return minimum price
      if (userInputCents <= minOfferPriceCents) {
        return {
          discountPercent: 0,
          offerPriceCents: minOfferPriceCents,
          savingsCents: 0,
        };
      }

      const discountPercent = this.generateRandomDiscount();
      const discountAmount = Math.round(
        userInputCents * (discountPercent / 100)
      );
      let offerPriceCents = userInputCents - discountAmount;

      // Ensure offer doesn't go below minimum
      if (offerPriceCents < minOfferPriceCents) {
        offerPriceCents = minOfferPriceCents;
      }

      const actualSavings = userInputCents - offerPriceCents;
      const actualDiscountPercent =
        actualSavings > 0
          ? Math.round((actualSavings / userInputCents) * 10000) / 100
          : 0;

      return {
        discountPercent: actualDiscountPercent,
        offerPriceCents,
        savingsCents: actualSavings,
      };
    } catch (error) {
      this.handleError(error, 'calculateOfferDetails', { userInputCents });
    }
  }

  /**
   * Get active (non-expired) offer for a user's subscription
   */
  async getActiveOffer(
    userId: string,
    subscriptionId: string,
    tx?: PrismaTransaction
  ): Promise<CustomDiscountOffer | null> {
    try {
      this.validateId(userId, 'userId');
      this.validateId(subscriptionId, 'subscriptionId');

      const db = tx || this.prisma;
      const now = new Date();

      const offer = await db.customDiscountOffer.findUnique({
        where: {
          userId_subscriptionId: {
            userId,
            subscriptionId,
          },
        },
      });

      if (!offer) {
        return null;
      }

      // Check if offer is expired
      if (now > offer.expiresAt || offer.isExpired) {
        // Mark as expired if not already
        if (!offer.isExpired) {
          await this.markAsExpired(offer.id, tx);
        }
        return null;
      }

      apiLogger.databaseOperation('active_discount_offer_retrieved', true, {
        service: this.serviceName,
        userId: userId.substring(0, 8),
        subscriptionId: subscriptionId.substring(0, 8),
        offerId: offer.id.substring(0, 8),
        offerPriceCents: offer.offerPriceCents,
      });

      return offer;
    } catch (error) {
      this.handleError(error, 'getActiveOffer', { userId, subscriptionId });
    }
  }

  /**
   * Store a rejected offer in the database (only called when user declines)
   */
  async storeRejectedOffer(
    params: {
      userId: string;
      subscriptionId: string;
      originalPriceCents: number;
      userInputCents: number;
      offerPriceCents: number;
      discountPercent: number;
    },
    tx?: PrismaTransaction
  ): Promise<CustomDiscountOffer> {
    try {
      this.validateId(params.userId, 'userId');
      this.validateId(params.subscriptionId, 'subscriptionId');
      this.validateRequired(params.originalPriceCents, 'originalPriceCents');
      this.validateRequired(params.userInputCents, 'userInputCents');
      this.validateRequired(params.offerPriceCents, 'offerPriceCents');
      this.validateRequired(params.discountPercent, 'discountPercent');

      if (params.originalPriceCents <= 0) {
        throw new ValidationError('Original price must be greater than 0');
      }
      if (params.userInputCents <= 0) {
        throw new ValidationError('User input price must be greater than 0');
      }
      if (params.offerPriceCents <= 0) {
        throw new ValidationError('Offer price must be greater than 0');
      }
      if (params.discountPercent < 0 || params.discountPercent > 100) {
        throw new ValidationError('Discount percent must be between 0 and 100');
      }

      const db = tx || this.prisma;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 2); // 2 days from now

      const savingsCents = params.userInputCents - params.offerPriceCents;

      const offer = await db.customDiscountOffer.upsert({
        where: {
          userId_subscriptionId: {
            userId: params.userId,
            subscriptionId: params.subscriptionId,
          },
        },
        update: {
          originalPriceCents: params.originalPriceCents,
          userInputCents: params.userInputCents,
          offerPriceCents: params.offerPriceCents,
          discountPercent: params.discountPercent,
          savingsCents,
          expiresAt,
          isExpired: false,
          acceptedAt: null, // Reset acceptance if updating
        },
        create: {
          userId: params.userId,
          subscriptionId: params.subscriptionId,
          originalPriceCents: params.originalPriceCents,
          userInputCents: params.userInputCents,
          offerPriceCents: params.offerPriceCents,
          discountPercent: params.discountPercent,
          savingsCents,
          expiresAt,
        },
      });

      apiLogger.databaseOperation('custom_discount_offer_stored', true, {
        service: this.serviceName,
        userId: params.userId.substring(0, 8),
        subscriptionId: params.subscriptionId.substring(0, 8),
        offerId: offer.id.substring(0, 8),
        offerPriceCents: offer.offerPriceCents,
        discountPercent: offer.discountPercent,
        expiresAt: offer.expiresAt.toISOString(),
      });

      return offer;
    } catch (error) {
      this.handleError(error, 'storeRejectedOffer', params);
    }
  }

  /**
   * Mark an offer as accepted
   */
  async acceptOffer(
    offerId: string,
    tx?: PrismaTransaction
  ): Promise<CustomDiscountOffer> {
    try {
      this.validateId(offerId, 'offerId');

      const db = tx || this.prisma;

      // First check if offer exists and is still valid
      const existingOffer = await db.customDiscountOffer.findUnique({
        where: { id: offerId },
      });

      if (!existingOffer) {
        throw new ValidationError('Discount offer not found');
      }

      if (existingOffer.acceptedAt) {
        throw new ValidationError('Offer has already been accepted');
      }

      const now = new Date();
      if (now > existingOffer.expiresAt || existingOffer.isExpired) {
        throw new ValidationError('Offer has expired');
      }

      const offer = await db.customDiscountOffer.update({
        where: { id: offerId },
        data: { acceptedAt: now },
      });

      apiLogger.databaseOperation('custom_discount_offer_accepted', true, {
        service: this.serviceName,
        offerId: offerId.substring(0, 8),
        userId: offer.userId.substring(0, 8),
        offerPriceCents: offer.offerPriceCents,
        acceptedAt: offer.acceptedAt?.toISOString(),
      });

      return offer;
    } catch (error) {
      this.handleError(error, 'acceptOffer', { offerId });
    }
  }

  /**
   * Mark an offer as expired
   */
  async markAsExpired(
    offerId: string,
    tx?: PrismaTransaction
  ): Promise<CustomDiscountOffer> {
    try {
      this.validateId(offerId, 'offerId');

      const db = tx || this.prisma;

      const offer = await db.customDiscountOffer.update({
        where: { id: offerId },
        data: { isExpired: true },
      });

      apiLogger.databaseOperation('custom_discount_offer_expired', true, {
        service: this.serviceName,
        offerId: offerId.substring(0, 8),
        userId: offer.userId.substring(0, 8),
      });

      return offer;
    } catch (error) {
      this.handleError(error, 'markAsExpired', { offerId });
    }
  }

  /**
   * Clean up expired offers (for background jobs)
   */
  async cleanupExpiredOffers(): Promise<number> {
    try {
      const now = new Date();

      const result = await this.prisma.customDiscountOffer.updateMany({
        where: {
          AND: [{ expiresAt: { lt: now } }, { isExpired: false }],
        },
        data: { isExpired: true },
      });

      apiLogger.databaseOperation('expired_discount_offers_cleaned', true, {
        service: this.serviceName,
        expiredCount: result.count,
      });

      return result.count;
    } catch (error) {
      this.handleError(error, 'cleanupExpiredOffers', {});
    }
  }

  /**
   * Get a single offer by ID
   */
  async getOfferById(
    offerId: string,
    tx?: PrismaTransaction
  ): Promise<CustomDiscountOffer | null> {
    try {
      this.validateId(offerId, 'offerId');

      const db = tx || this.prisma;

      const offer = await db.customDiscountOffer.findUnique({
        where: { id: offerId },
      });

      return offer;
    } catch (error) {
      this.handleError(error, 'getOfferById', { offerId });
    }
  }

  /**
   * Get offer statistics for admin/monitoring
   */
  async getOfferStats(): Promise<{
    totalOffers: number;
    activeOffers: number;
    expiredOffers: number;
    acceptedOffers: number;
    avgDiscountPercent: number;
  }> {
    try {
      const now = new Date();

      const [
        totalOffers,
        activeOffers,
        expiredOffers,
        acceptedOffers,
        avgDiscountResult,
      ] = await Promise.all([
        this.prisma.customDiscountOffer.count(),
        this.prisma.customDiscountOffer.count({
          where: {
            AND: [
              { expiresAt: { gt: now } },
              { isExpired: false },
              { acceptedAt: null },
            ],
          },
        }),
        this.prisma.customDiscountOffer.count({
          where: {
            OR: [{ expiresAt: { lt: now } }, { isExpired: true }],
          },
        }),
        this.prisma.customDiscountOffer.count({
          where: { acceptedAt: { not: null } },
        }),
        this.prisma.customDiscountOffer.aggregate({
          _avg: { discountPercent: true },
        }),
      ]);

      return {
        totalOffers,
        activeOffers,
        expiredOffers,
        acceptedOffers,
        avgDiscountPercent: avgDiscountResult._avg.discountPercent || 0,
      };
    } catch (error) {
      this.handleError(error, 'getOfferStats', {});
    }
  }
}
