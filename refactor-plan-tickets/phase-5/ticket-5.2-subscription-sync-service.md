# Ticket 5.2: Subscription Sync Service Implementation  
**Priority:** HIGH | **Effort:** 4 days | **Risk:** Medium

## Description
Create a centralized service for synchronizing Stripe subscription data with the local database and managing user access control based on subscription status.

## Implementation
```typescript
// src/services/subscription-sync-service.ts
import { db } from '@/lib/db';
import { apiLogger } from '@/lib/enhanced-logger';
import { BaseService } from '@/services/base/base-service';
import Stripe from 'stripe';

export class SubscriptionSyncService extends BaseService {
  
  async createOrUpdateSubscription(stripeSubscription: Stripe.Subscription): Promise<void> {
    try {
      const subscriptionData = this.mapStripeSubscriptionToDbFields(stripeSubscription);
      
      await this.executeTransaction(async (tx) => {
        // Find user by Stripe customer ID
        const user = await tx.user.findFirst({
          where: { 
            subscription: {
              stripeCustomerId: stripeSubscription.customer as string
            }
          }
        });
        
        if (!user) {
          throw new Error(`User not found for Stripe customer: ${stripeSubscription.customer}`);
        }
        
        // Upsert subscription
        await tx.subscription.upsert({
          where: { stripeSubscriptionId: stripeSubscription.id },
          create: {
            userId: user.id,
            ...subscriptionData
          },
          update: subscriptionData
        });
        
        apiLogger.databaseOperation('subscription_sync', true, {
          subscriptionId: stripeSubscription.id,
          status: stripeSubscription.status,
          operation: 'upsert'
        });
      });
    } catch (error) {
      this.handleError(error, 'create or update subscription', {
        subscriptionId: stripeSubscription.id
      });
    }
  }
  
  async updateUserAccess(stripeCustomerId: string): Promise<void> {
    try {
      await this.executeTransaction(async (tx) => {
        // Get user and subscription
        const user = await tx.user.findFirst({
          where: {
            subscription: {
              stripeCustomerId
            }
          },
          include: {
            subscription: true,
            members: {
              include: {
                roles: true
              }
            }
          }
        });
        
        if (!user?.subscription) {
          throw new Error(`User/subscription not found for customer: ${stripeCustomerId}`);
        }
        
        const shouldHavePremiumAccess = this.shouldGrantPremiumAccess(user.subscription);
        
        // Update role assignments across all servers
        for (const member of user.members) {
          const currentHasPremium = member.roles.some(role => role.name === 'premium');
          
          if (shouldHavePremiumAccess && !currentHasPremium) {
            // Grant premium access
            await this.grantPremiumRole(tx, member.id, member.serverId);
          } else if (!shouldHavePremiumAccess && currentHasPremium) {
            // Revoke premium access
            await this.revokePremiumRole(tx, member.id, member.serverId);
          }
        }
        
        apiLogger.adminOperation('subscription_access_updated', 'system', user.id, {
          customerId: stripeCustomerId,
          premiumAccess: shouldHavePremiumAccess,
          memberCount: user.members.length
        });
      });
    } catch (error) {
      this.handleError(error, 'update user access', { stripeCustomerId });
    }
  }
  
  async grantUserAccess(stripeCustomerId: string): Promise<void> {
    await this.updateUserAccess(stripeCustomerId);
  }
  
  async revokeUserAccess(stripeCustomerId: string): Promise<void> {
    await this.updateUserAccess(stripeCustomerId);
  }
  
  async handleSubscriptionCancellation(stripeSubscription: Stripe.Subscription): Promise<void> {
    try {
      await this.executeTransaction(async (tx) => {
        await tx.subscription.update({
          where: { stripeSubscriptionId: stripeSubscription.id },
          data: {
            status: 'CANCELED',
            canceledAt: stripeSubscription.canceled_at 
              ? new Date(stripeSubscription.canceled_at * 1000) 
              : new Date(),
            endedAt: stripeSubscription.ended_at 
              ? new Date(stripeSubscription.ended_at * 1000) 
              : new Date(),
            updatedAt: new Date()
          }
        });
        
        apiLogger.databaseOperation('subscription_cancellation', true, {
          subscriptionId: stripeSubscription.id,
          customerId: stripeSubscription.customer
        });
      });
    } catch (error) {
      this.handleError(error, 'handle subscription cancellation', {
        subscriptionId: stripeSubscription.id
      });
    }
  }
  
  async handlePaymentFailure(invoice: Stripe.Invoice): Promise<void> {
    try {
      if (!invoice.subscription) return;
      
      await this.executeTransaction(async (tx) => {
        // Update subscription status based on invoice
        await tx.subscription.updateMany({
          where: { stripeSubscriptionId: invoice.subscription as string },
          data: {
            status: 'PAST_DUE', // or 'UNPAID' depending on attempt count
            latestInvoice: invoice.id,
            updatedAt: new Date()
          }
        });
        
        apiLogger.databaseOperation('payment_failure_sync', true, {
          invoiceId: invoice.id,
          subscriptionId: invoice.subscription,
          attemptCount: invoice.attempt_count
        });
      });
    } catch (error) {
      this.handleError(error, 'handle payment failure', {
        invoiceId: invoice.id
      });
    }
  }
  
  async syncSubscriptionFromInvoice(invoice: Stripe.Invoice): Promise<any> {
    try {
      if (!invoice.subscription) return null;
      
      return await this.executeTransaction(async (tx) => {
        const subscription = await tx.subscription.findFirst({
          where: { stripeSubscriptionId: invoice.subscription as string }
        });
        
        if (subscription) {
          await tx.subscription.update({
            where: { id: subscription.id },
            data: {
              status: 'ACTIVE', // Payment succeeded
              latestInvoice: invoice.id,
              updatedAt: new Date()
            }
          });
        }
        
        return subscription;
      });
    } catch (error) {
      this.handleError(error, 'sync subscription from invoice', {
        invoiceId: invoice.id
      });
      return null;
    }
  }
  
  async getSubscriptionById(stripeSubscriptionId: string): Promise<any> {
    try {
      return await this.prisma.subscription.findFirst({
        where: { stripeSubscriptionId }
      });
    } catch (error) {
      this.handleError(error, 'get subscription by id', { stripeSubscriptionId });
      return null;
    }
  }
  
  private shouldGrantPremiumAccess(subscription: any): boolean {
    // Define business logic for premium access
    return subscription.status === 'ACTIVE' || 
           subscription.status === 'TRIALING' ||
           (subscription.status === 'PAST_DUE' && this.isWithinGracePeriod(subscription));
  }
  
  private isWithinGracePeriod(subscription: any): boolean {
    // Allow 7-day grace period for past due subscriptions
    if (!subscription.currentPeriodEnd) return false;
    
    const gracePeriodEnd = new Date(subscription.currentPeriodEnd);
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 7);
    
    return new Date() <= gracePeriodEnd;
  }
  
  private async grantPremiumRole(tx: any, memberId: string, serverId: string): Promise<void> {
    // Find or create premium role for this server
    let premiumRole = await tx.role.findFirst({
      where: { 
        serverId,
        name: 'premium'
      }
    });
    
    if (!premiumRole) {
      premiumRole = await tx.role.create({
        data: {
          name: 'premium',
          color: '#FFD700', // Gold color for premium
          serverId,
          creatorId: 'system', // System-created role
          isDefault: false
        }
      });
    }
    
    // Assign role to member
    await tx.memberRole.upsert({
      where: {
        memberId_roleId: {
          memberId,
          roleId: premiumRole.id
        }
      },
      create: {
        memberId,
        roleId: premiumRole.id,
        assignedAt: new Date()
      },
      update: {
        assignedAt: new Date()
      }
    });
  }
  
  private async revokePremiumRole(tx: any, memberId: string, serverId: string): Promise<void> {
    // Find premium role for this server
    const premiumRole = await tx.role.findFirst({
      where: { 
        serverId,
        name: 'premium'
      }
    });
    
    if (premiumRole) {
      // Remove role assignment
      await tx.memberRole.deleteMany({
        where: {
          memberId,
          roleId: premiumRole.id
        }
      });
    }
  }
  
  private mapStripeSubscriptionToDbFields(stripeSubscription: Stripe.Subscription) {
    return {
      stripeSubscriptionId: stripeSubscription.id,
      stripeCustomerId: stripeSubscription.customer as string,
      status: this.mapStripeStatusToDbStatus(stripeSubscription.status),
      currency: stripeSubscription.currency,
      created: new Date(stripeSubscription.created * 1000),
      currentPeriodStart: stripeSubscription.current_period_start 
        ? new Date(stripeSubscription.current_period_start * 1000) 
        : null,
      currentPeriodEnd: stripeSubscription.current_period_end 
        ? new Date(stripeSubscription.current_period_end * 1000) 
        : null,
      cancelAt: stripeSubscription.cancel_at 
        ? new Date(stripeSubscription.cancel_at * 1000) 
        : null,
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      canceledAt: stripeSubscription.canceled_at 
        ? new Date(stripeSubscription.canceled_at * 1000) 
        : null,
      endedAt: stripeSubscription.ended_at 
        ? new Date(stripeSubscription.ended_at * 1000) 
        : null,
      trialStart: stripeSubscription.trial_start 
        ? new Date(stripeSubscription.trial_start * 1000) 
        : null,
      trialEnd: stripeSubscription.trial_end 
        ? new Date(stripeSubscription.trial_end * 1000) 
        : null,
      defaultPaymentMethod: stripeSubscription.default_payment_method as string || null,
      latestInvoice: stripeSubscription.latest_invoice as string || null,
      collectionMethod: stripeSubscription.collection_method,
      items: stripeSubscription.items ? JSON.stringify(stripeSubscription.items) : null,
      metadata: stripeSubscription.metadata ? JSON.stringify(stripeSubscription.metadata) : null,
      updatedAt: new Date()
    };
  }
  
  private mapStripeStatusToDbStatus(stripeStatus: string) {
    const statusMap = {
      'incomplete': 'INCOMPLETE',
      'incomplete_expired': 'INCOMPLETE_EXPIRED',
      'trialing': 'TRIALING',
      'active': 'ACTIVE',
      'past_due': 'PAST_DUE',
      'canceled': 'CANCELED',
      'unpaid': 'UNPAID',
      'paused': 'PAUSED'
    };
    
    return statusMap[stripeStatus] || 'FREE';
  }
}
```

## Acceptance Criteria
- [ ] Implement complete Stripe-to-Database field mapping
- [ ] Handle all subscription status transitions correctly
- [ ] Provide atomic user access control updates
- [ ] Include comprehensive error handling and logging
- [ ] Support grace periods for payment failures
- [ ] Handle role assignments across multiple servers

### Documentation Requirements
- [ ] Create subscription synchronization flow diagram
- [ ] Document subscription-to-access mapping logic in `docs/features/subscription-sync.md`
- [ ] Add database consistency validation procedures

### Testing Requirements
- [ ] **Unit Tests**: SubscriptionSyncService methods with comprehensive mocking
- [ ] **Integration Tests**: Full subscription sync flow with real Stripe data
- [ ] **Subscription Sync Tests** (CRITICAL):
  - [ ] **Stripe-to-Database Mapping**: Verify all Stripe fields map correctly to database
  - [ ] **Access Control Updates**: Test role assignments and permissions based on subscription status
  - [ ] **Grace Period Handling**: Test access during payment failures within grace period
  - [ ] **Multi-Server Access**: Test role assignments across multiple servers
- [ ] **Data Consistency Tests**: Verify subscription data remains consistent across operations
- [ ] **Transaction Tests**: Test rollback scenarios for failed sync operations

## Files to Create
- `src/services/subscription-sync-service.ts`
- `src/services/stripe/subscription-service.ts` (enhance existing)
- `src/types/subscription-sync.ts` (type definitions)

## Dependencies
- Ticket 1.4 (Base Service Architecture)
- Ticket 1.1 (Logger Consolidation)

## Context
This ticket is part of **Phase 5: Stripe-Database Subscription Synchronization**, which implements comprehensive webhook-based synchronization between Stripe subscription events and the local Subscription table to ensure accurate premium access control. 