import { apiLogger } from '@/lib/enhanced-logger';
import { BaseDatabaseService } from './database/base-service';
import { ValidationError } from '@/lib/error-handling';
import Stripe from 'stripe';
import { SubscriptionStatus } from '@prisma/client';
// Type alias to handle Stripe API version differences
type StripeInvoiceWithSubscription = Stripe.Invoice & {
  subscription?: string | Stripe.Subscription;
};

// Webhook payloads include additional fields not in the standard Stripe.Subscription type
type StripeSubscriptionWebhookPayload = Stripe.Subscription & {
  current_period_start?: number;
  current_period_end?: number;
  items?: {
    data: Array<
      Stripe.SubscriptionItem & {
        current_period_start?: number;
        current_period_end?: number;
      }
    >;
  };
  discount?: Stripe.Discount; // Legacy single discount field
};

// Interface for database subscription records that include JSON fields
interface DatabaseSubscription {
  id?: string;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  currentPeriodEnd?: Date | null;
  items?: string; // JSON string containing subscription items
  [key: string]: any;
}

/**
 * Service for synchronizing Stripe subscription data with the local database
 * and managing user access control based on subscription status.
 */
export class SubscriptionSyncService extends BaseDatabaseService {
  /**
   * Extract period information from subscription items JSON
   */
  private extractPeriodFromItems(
    subscription: DatabaseSubscription | StripeSubscriptionWebhookPayload
  ): {
    currentPeriodEnd: Date | null;
  } {
    console.dir(subscription, { depth: null });
    try {
      // First try direct properties (for Stripe API responses)
      if (
        'current_period_start' in subscription &&
        subscription.current_period_start
      ) {
        return {
          currentPeriodEnd: subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000)
            : null,
        };
      }

      // Then try items field
      if ('items' in subscription && subscription.items) {
        let itemsData;

        // Handle both string (database records) and object (Stripe API responses)
        if (typeof subscription.items === 'string') {
          // Database record - items stored as JSON string
          itemsData = JSON.parse(subscription.items);
        } else if (typeof subscription.items === 'object') {
          // Direct Stripe API response - items is already an object
          itemsData = subscription.items;
        }

        // Extract period from items data
        if (itemsData && itemsData.data && itemsData.data.length > 0) {
          const firstItem = itemsData.data[0];
          return {
            currentPeriodEnd: firstItem.current_period_end
              ? new Date(firstItem.current_period_end * 1000)
              : null,
          };
        }
      }

      // Fallback to existing properties if available
      if (
        'currentPeriodStart' in subscription &&
        subscription.currentPeriodStart
      ) {
        return {
          currentPeriodEnd:
            subscription.currentPeriodEnd instanceof Date
              ? subscription.currentPeriodEnd
              : subscription.currentPeriodEnd
                ? new Date(subscription.currentPeriodEnd)
                : null,
        };
      }

      return {
        currentPeriodEnd: null,
      };
    } catch (error) {
      // Get subscription ID based on type - database records have stripeSubscriptionId, Stripe objects have id
      const subscriptionId =
        'stripeSubscriptionId' in subscription
          ? subscription.stripeSubscriptionId
          : 'id' in subscription
            ? subscription.id
            : 'unknown';

      apiLogger.databaseOperation('extract_period_from_items', false, {
        error: error instanceof Error ? error.message : 'Unknown error',
        subscriptionId,
      });
      return {
        currentPeriodEnd: null,
      };
    }
  }

  /**
   * Create or update a subscription from Stripe data
   * @param stripeSubscription - The subscription data from Stripe
   * @param userId - Optional user ID for new users who don't have a subscription record yet
   */
  async createOrUpdateSubscription(
    stripeSubscription: StripeSubscriptionWebhookPayload,
    userId?: string
  ): Promise<void> {
    try {
      // Extract period information using the helper function
      const { currentPeriodEnd } =
        this.extractPeriodFromItems(stripeSubscription);

      console.log('currentPeriodEnd', currentPeriodEnd);
      const subscriptionData = {
        stripeSubscriptionId: stripeSubscription.id,
        stripeCustomerId: stripeSubscription.customer as string,
        status: this.mapStripeStatusToDbStatus(stripeSubscription.status),
        createdAt: new Date(stripeSubscription.created * 1000),
        currentPeriodEnd,
        updatedAt: new Date(),
      };

      await this.executeTransaction(async tx => {
        let targetUserId: string;

        if (userId) {
          // Use provided userId (for new users)
          targetUserId = userId;
        } else {
          // Find user by Stripe customer ID (for existing users)
          const user = await tx.user.findFirst({
            where: {
              subscription: {
                stripeCustomerId: stripeSubscription.customer as string,
              },
            },
          });

          if (!user) {
            // Try to find user by email if customer is expanded
            if (
              typeof stripeSubscription.customer === 'object' &&
              'email' in stripeSubscription.customer &&
              stripeSubscription.customer.email
            ) {
              const userByEmail = await tx.user.findFirst({
                where: { email: stripeSubscription.customer.email },
              });

              if (userByEmail) {
                targetUserId = userByEmail.id;
              } else {
                throw new ValidationError(
                  `User not found for Stripe customer: ${stripeSubscription.customer.id || stripeSubscription.customer}`
                );
              }
            } else {
              throw new ValidationError(
                `User not found for Stripe customer: ${stripeSubscription.customer}`
              );
            }
          } else {
            targetUserId = user.id;
          }
        }

        // Upsert subscription
        await tx.subscription.upsert({
          where: { stripeSubscriptionId: stripeSubscription.id },
          create: {
            userId: targetUserId,
            ...subscriptionData,
          },
          update: subscriptionData,
        });

        apiLogger.databaseOperation('subscription_sync', true, {
          subscriptionId: stripeSubscription.id,
          status: stripeSubscription.status,
          operation: 'upsert',
          userId: targetUserId,
        });
      });
    } catch (error) {
      this.handleError(error, 'create or update subscription', {
        subscriptionId: stripeSubscription.id,
        customerId: stripeSubscription.customer,
      });
    }
  }

  /**
   * Update user access based on subscription status
   */
  async updateUserAccess(stripeCustomerId: string): Promise<void> {
    try {
      await this.executeTransaction(async tx => {
        // Get user and subscription
        const user = await tx.user.findFirst({
          where: {
            subscription: {
              stripeCustomerId,
            },
          },
          include: {
            subscription: true,
            members: {
              include: {
                role: true,
                server: true,
              },
            },
          },
        });

        if (!user?.subscription) {
          throw new ValidationError(
            `User/subscription not found for customer: ${stripeCustomerId}`
          );
        }

        const shouldHavePremiumAccess = this.shouldGrantPremiumAccess(
          user.subscription
        );

        // Update role assignments across all servers
        for (const member of user.members) {
          const currentHasPremium = member.role.name === 'premium';

          if (shouldHavePremiumAccess && !currentHasPremium) {
            // Grant premium access
            await this.grantPremiumRole(tx, member.id, member.serverId);
          } else if (!shouldHavePremiumAccess && currentHasPremium) {
            // Revoke premium access and assign free role
            await this.revokePremiumRole(tx, member.id, member.serverId);
          }
        }

        apiLogger.databaseOperation('subscription_access_updated', true, {
          customerId: stripeCustomerId,
          userId: user.id,
          premiumAccess: shouldHavePremiumAccess,
          memberCount: user.members.length,
        });
      });
    } catch (error) {
      this.handleError(error, 'update user access', { stripeCustomerId });
    }
  }

  /**
   * Grant premium access to a user
   */
  async grantUserAccess(stripeCustomerId: string): Promise<void> {
    await this.updateUserAccess(stripeCustomerId);
  }

  /**
   * Revoke premium access from a user
   */
  async revokeUserAccess(stripeCustomerId: string): Promise<void> {
    await this.updateUserAccess(stripeCustomerId);
  }

  /**
   * Handle subscription cancellation
   */
  async handleSubscriptionCancellation(
    stripeSubscription: StripeSubscriptionWebhookPayload
  ): Promise<void> {
    try {
      await this.executeTransaction(async tx => {
        await tx.subscription.update({
          where: { stripeSubscriptionId: stripeSubscription.id },
          data: {
            status: 'CANCELED',
            updatedAt: new Date(),
          },
        });

        apiLogger.databaseOperation('subscription_cancellation', true, {
          subscriptionId: stripeSubscription.id,
          customerId: stripeSubscription.customer,
        });
      });
    } catch (error) {
      this.handleError(error, 'handle subscription cancellation', {
        subscriptionId: stripeSubscription.id,
      });
    }
  }

  /**
   * Handle payment failure
   */
  async handlePaymentFailure(
    invoice: StripeInvoiceWithSubscription
  ): Promise<void> {
    try {
      if (!invoice.subscription) return;

      const subscriptionId =
        typeof invoice.subscription === 'string'
          ? invoice.subscription
          : invoice.subscription.id;

      await this.executeTransaction(async tx => {
        // Determine status based on attempt count
        const status =
          invoice.attempt_count && invoice.attempt_count >= 3
            ? 'UNPAID'
            : 'PAST_DUE';

        // Update subscription status based on invoice
        await tx.subscription.updateMany({
          where: { stripeSubscriptionId: subscriptionId },
          data: {
            status,
            updatedAt: new Date(),
          },
        });

        apiLogger.databaseOperation('payment_failure_sync', true, {
          invoiceId: invoice.id,
          subscriptionId,
          attemptCount: invoice.attempt_count,
          newStatus: status,
        });
      });
    } catch (error) {
      this.handleError(error, 'handle payment failure', {
        invoiceId: invoice.id,
        subscriptionId: invoice.subscription,
      });
    }
  }

  /**
   * Sync subscription from successful invoice payment
   */
  async syncSubscriptionFromInvoice(
    invoice: StripeInvoiceWithSubscription
  ): Promise<any> {
    try {
      if (!invoice.subscription) return null;

      const subscriptionId =
        typeof invoice.subscription === 'string'
          ? invoice.subscription
          : invoice.subscription.id;

      return await this.executeTransaction(async tx => {
        const subscription = await tx.subscription.findFirst({
          where: { stripeSubscriptionId: subscriptionId },
        });

        if (subscription) {
          await tx.subscription.update({
            where: { id: subscription.id },
            data: {
              status: 'ACTIVE', // Payment succeeded
              updatedAt: new Date(),
            },
          });

          apiLogger.databaseOperation('invoice_payment_sync', true, {
            invoiceId: invoice.id,
            subscriptionId: subscriptionId,
            previousStatus: subscription.status,
            newStatus: 'ACTIVE',
          });
        }

        return subscription;
      });
    } catch (error) {
      this.handleError(error, 'sync subscription from invoice', {
        invoiceId: invoice.id,
        subscriptionId: invoice.subscription,
      });
      return null;
    }
  }

  /**
   * Get subscription by Stripe ID
   */
  async getSubscriptionById(stripeSubscriptionId: string): Promise<any> {
    try {
      return await this.prisma.subscription.findFirst({
        where: { stripeSubscriptionId },
      });
    } catch (error) {
      this.handleError(error, 'get subscription by id', {
        stripeSubscriptionId,
      });
      return null;
    }
  }

  /**
   * Determine if user should have premium access based on subscription
   */
  private shouldGrantPremiumAccess(subscription: any): boolean {
    // Define business logic for premium access
    return (
      subscription.status === 'ACTIVE' ||
      subscription.status === 'TRIALING' ||
      (subscription.status === 'PAST_DUE' &&
        this.isWithinGracePeriod(subscription))
    );
  }

  /**
   * Check if subscription is within grace period for past due payments
   */
  private isWithinGracePeriod(subscription: any): boolean {
    // Allow 7-day grace period for past due subscriptions
    const { currentPeriodEnd } = this.extractPeriodFromItems(subscription);
    if (!currentPeriodEnd) return false;

    const gracePeriodEnd = new Date(currentPeriodEnd);
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 7);

    return new Date() <= gracePeriodEnd;
  }

  /**
   * Grant premium role to a member
   */
  private async grantPremiumRole(
    tx: any,
    memberId: string,
    serverId: string
  ): Promise<void> {
    // Find or create premium role for this server
    let premiumRole = await tx.role.findFirst({
      where: {
        serverId,
        name: 'premium',
      },
    });

    if (!premiumRole) {
      // Get server creator to assign as role creator
      const server = await tx.server.findUnique({
        where: { id: serverId },
        select: { userId: true },
      });

      premiumRole = await tx.role.create({
        data: {
          name: 'premium',
          color: '#FFD700', // Gold color for premium
          serverId,
          creatorId: server?.userId || 'system',
          isDefault: false,
        },
      });
    }

    // Update member role to premium
    await tx.member.update({
      where: { id: memberId },
      data: { roleId: premiumRole.id },
    });

    apiLogger.databaseOperation('premium_role_granted', true, {
      memberId,
      serverId,
      roleId: premiumRole.id,
    });
  }

  /**
   * Revoke premium role and assign free role
   */
  private async revokePremiumRole(
    tx: any,
    memberId: string,
    serverId: string
  ): Promise<void> {
    // Find or create free role for this server
    let freeRole = await tx.role.findFirst({
      where: {
        serverId,
        name: 'free',
      },
    });

    if (!freeRole) {
      // Get server creator to assign as role creator
      const server = await tx.server.findUnique({
        where: { id: serverId },
        select: { userId: true },
      });

      freeRole = await tx.role.create({
        data: {
          name: 'free',
          color: '#808080', // Gray color for free
          serverId,
          creatorId: server?.userId || 'system',
          isDefault: true,
        },
      });
    }

    // Update member role to free
    await tx.member.update({
      where: { id: memberId },
      data: { roleId: freeRole.id },
    });

    apiLogger.databaseOperation('premium_role_revoked', true, {
      memberId,
      serverId,
      newRoleId: freeRole.id,
    });
  }

  /**
   * Map Stripe status to database status enum
   */
  private mapStripeStatusToDbStatus(stripeStatus: string): SubscriptionStatus {
    const statusMap: Record<string, SubscriptionStatus> = {
      incomplete: SubscriptionStatus.INCOMPLETE,
      incomplete_expired: SubscriptionStatus.INCOMPLETE_EXPIRED,
      trialing: SubscriptionStatus.TRIALING,
      active: SubscriptionStatus.ACTIVE,
      past_due: SubscriptionStatus.PAST_DUE,
      canceled: SubscriptionStatus.CANCELED,
      unpaid: SubscriptionStatus.UNPAID,
      paused: SubscriptionStatus.PAUSED,
    };

    return statusMap[stripeStatus] || SubscriptionStatus.FREE;
  }
}
