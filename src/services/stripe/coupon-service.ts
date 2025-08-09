import Stripe from 'stripe';
import { BaseStripeService } from './base/base-stripe-service';
import { maskId } from '@/lib/error-handling';

interface CreateCouponData {
  discountAmountCents: number; // Discount amount in cents
  originalPriceCents: number; // Original price for percentage calculation
  currency: string; // Required for coupons
  name?: string;
  duration?: 'forever' | 'once' | 'repeating';
  durationInMonths?: number;
  maxRedemptions?: number;
  metadata?: Record<string, string>;
}

interface CouponListOptions {
  limit?: number;
  startingAfter?: string;
  endingBefore?: string;
  created?: {
    gte?: number;
    lte?: number;
  };
}

/**
 * CouponService - Handles all Stripe coupon operations
 * Centralizes coupon management with proper error handling and logging
 */
export class CouponService extends BaseStripeService {
  /**
   * Create a new coupon in Stripe
   * Used for admin discount creation and promotional offers
   */
  async createCoupon(data: CreateCouponData): Promise<Stripe.Coupon> {
    this.validateCouponData(data);

    return await this.handleStripeOperation(
      async () => {
        // Calculate percentage with precise rounding for Stripe
        const percentOff = parseFloat(
          ((data.discountAmountCents / data.originalPriceCents) * 100).toFixed(
            2
          )
        );

        const couponParams: Stripe.CouponCreateParams = {
          percent_off: percentOff, // Use percent_off for forever duration
          duration: data.duration || 'forever',
          currency: data.currency,
          name: data.name,
          metadata: data.metadata || {}, // Ensure metadata is always present
        };

        if (data.durationInMonths && data.duration === 'repeating') {
          couponParams.duration_in_months = data.durationInMonths;
        }

        if (data.maxRedemptions) {
          couponParams.max_redemptions = data.maxRedemptions;
        }

        return await this.stripe.coupons.create(couponParams);
      },
      'create_coupon',
      {
        discountAmountCents: data.discountAmountCents,
        originalPriceCents: data.originalPriceCents,
        duration: data.duration || 'forever',
        name: data.name,
        currency: data.currency,
      }
    );
  }

  /**
   * Retrieve a coupon by ID
   * Used for coupon validation and display
   */
  async getCoupon(couponId: string): Promise<Stripe.Coupon | null> {
    this.validateCouponId(couponId);

    return await this.handleStripeOperation(
      async () => {
        try {
          return await this.stripe.coupons.retrieve(couponId);
        } catch (error) {
          if (
            error instanceof Error &&
            error.message.includes('No such coupon')
          ) {
            return null;
          }
          throw error;
        }
      },
      'get_coupon',
      { couponId: maskId(couponId) }
    );
  }

  /**
   * List coupons with pagination
   * Used for admin coupon management
   */
  async listCoupons(options: CouponListOptions = {}): Promise<{
    coupons: Stripe.Coupon[];
    hasMore: boolean;
    totalCount?: number;
  }> {
    return await this.handleStripeOperation(
      async () => {
        const listParams: Stripe.CouponListParams = {
          limit: Math.min(options.limit || 10, 100),
        };

        if (options.startingAfter) {
          listParams.starting_after = options.startingAfter;
        }
        if (options.endingBefore) {
          listParams.ending_before = options.endingBefore;
        }
        if (options.created) {
          listParams.created = options.created;
        }

        const result = await this.stripe.coupons.list(listParams);

        return {
          coupons: result.data,
          hasMore: result.has_more,
        };
      },
      'list_coupons',
      {
        limit: options.limit || 10,
        hasFilters: !!(
          options.created ||
          options.startingAfter ||
          options.endingBefore
        ),
      }
    );
  }

  /**
   * Delete (disable) a coupon
   * Used for admin coupon management
   */
  async deleteCoupon(couponId: string): Promise<Stripe.DeletedCoupon> {
    this.validateCouponId(couponId);

    return await this.handleStripeOperation(
      async () => {
        return await this.stripe.coupons.del(couponId);
      },
      'delete_coupon',
      { couponId: maskId(couponId) }
    );
  }

  /**
   * Update a coupon's metadata
   * Note: Most coupon properties cannot be updated after creation
   */
  async updateCouponMetadata(
    couponId: string,
    metadata: Record<string, string>
  ): Promise<Stripe.Coupon> {
    this.validateCouponId(couponId);

    return await this.handleStripeOperation(
      async () => {
        return await this.stripe.coupons.update(couponId, { metadata });
      },
      'update_coupon_metadata',
      {
        couponId: maskId(couponId),
        metadataKeys: Object.keys(metadata),
      }
    );
  }

  /**
   * Validate coupon creation data
   */
  private validateCouponData(data: CreateCouponData): void {
    // Enhanced validation with detailed checks
    if (
      !data.discountAmountCents ||
      typeof data.discountAmountCents !== 'number' ||
      isNaN(data.discountAmountCents)
    ) {
      throw new Error(
        `Discount amount must be a valid number, received: ${
          data.discountAmountCents
        } (type: ${typeof data.discountAmountCents})`
      );
    }

    if (
      !data.originalPriceCents ||
      typeof data.originalPriceCents !== 'number' ||
      isNaN(data.originalPriceCents)
    ) {
      throw new Error(
        `Original price must be a valid number, received: ${
          data.originalPriceCents
        } (type: ${typeof data.originalPriceCents})`
      );
    }

    if (data.discountAmountCents < 1) {
      throw new Error(
        `Discount amount must be at least 1 cent, received: ${data.discountAmountCents}`
      );
    }

    if (data.originalPriceCents < 1) {
      throw new Error(
        `Original price must be at least 1 cent, received: ${data.originalPriceCents}`
      );
    }

    if (data.discountAmountCents >= data.originalPriceCents) {
      throw new Error(
        `Discount amount (${data.discountAmountCents}) must be less than original price (${data.originalPriceCents})`
      );
    }

    // Calculate percentage to validate it's within Stripe limits
    const percentOff =
      (data.discountAmountCents / data.originalPriceCents) * 100;
    if (percentOff < 1) {
      throw new Error(
        `Discount percentage must be at least 1%, calculated: ${percentOff.toFixed(
          2
        )}%`
      );
    }

    if (percentOff > 100) {
      throw new Error(
        `Discount percentage cannot exceed 100%, calculated: ${percentOff.toFixed(
          2
        )}%`
      );
    }

    if (!data.currency || typeof data.currency !== 'string') {
      throw new Error('Currency is required for amount-based coupons');
    }

    if (data.currency !== 'usd') {
      throw new Error('Only USD currency is currently supported');
    }

    if (data.duration === 'repeating' && !data.durationInMonths) {
      throw new Error('Duration in months is required for repeating coupons');
    }

    if (data.maxRedemptions && data.maxRedemptions < 1) {
      throw new Error('Max redemptions must be at least 1');
    }
  }

  /**
   * Validate coupon ID format
   */
  private validateCouponId(couponId: string): void {
    if (!couponId || typeof couponId !== 'string') {
      throw new Error('Valid coupon ID is required');
    }
  }
}
