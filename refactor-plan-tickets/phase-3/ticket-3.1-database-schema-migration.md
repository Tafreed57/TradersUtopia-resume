# Ticket 3.1: Database Schema Migration Execution
**Priority:** HIGH | **Effort:** 3 days | **Risk:** HIGH

## Description
Execute the database schema migration from Profile-based system to User + Subscription model with role-based access control, implementing the plan created in Phase 1.

## Prerequisites
- Phase 1 migration planning completed
- Backup of production database created
- Migration scripts tested in staging
- Rollback procedures documented

## Migration Steps
```sql
-- Step 1: Create new schema
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL, -- Changed from clerkId to userId
    "name" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stripeCustomerId" TEXT NOT NULL,
    "stripeSubscriptionId" TEXT,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'FREE',
    "currency" TEXT DEFAULT 'usd',
    "created" TIMESTAMP(3),
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "startDate" TIMESTAMP(3),
    "cancelAt" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN DEFAULT false,
    "canceledAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "trialStart" TIMESTAMP(3),
    "trialEnd" TIMESTAMP(3),
    "defaultPaymentMethod" TEXT,
    "latestInvoice" TEXT,
    "collectionMethod" TEXT,
    "items" JSONB,
    "automaticTax" JSONB,
    "billingCycleAnchor" TIMESTAMP(3),
    "description" TEXT,
    "metadata" JSONB,
    "discountPercent" INTEGER,
    "discountName" TEXT,
    "lastInvoiceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "color" TEXT,
    "isDefault" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "role_channel_access" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "role_channel_access_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "role_section_access" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "role_section_access_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "keys" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);
```

## Data Migration Script
```typescript
// scripts/migrate-database.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrateDatabase() {
  console.log('🚀 Starting database migration...');
  
  try {
    // Step 1: Migrate Profile data to User table
    console.log('📝 Migrating Profile → User data...');
    const profiles = await prisma.profile.findMany();
    
    for (const profile of profiles) {
      await prisma.user.create({
        data: {
          userId: profile.userId, // Field name change
          email: profile.email,
          name: profile.name,
          imageUrl: profile.imageUrl,
          isAdmin: profile.isAdmin,
          createdAt: profile.createdAt,
          updatedAt: profile.updatedAt,
        },
      });
    }
    
    // Step 2: Extract subscription data to Subscription table
    console.log('💳 Migrating subscription data...');
    for (const profile of profiles) {
      if (profile.stripeCustomerId) {
        const user = await prisma.user.findFirst({
          where: { userId: profile.userId },
        });
        
        if (user) {
          await prisma.subscription.create({
            data: {
              userId: user.id,
              stripeCustomerId: profile.stripeCustomerId,
              stripeSubscriptionId: profile.stripeSubscriptionId,
              status: mapLegacyStatus(profile.subscriptionStatus),
              currency: profile.subscriptionCurrency || 'usd',
              currentPeriodStart: profile.subscriptionStart,
              currentPeriodEnd: profile.subscriptionEnd,
              discountPercent: profile.discountPercent,
              discountName: profile.discountName,
              lastInvoiceUrl: profile.lastInvoiceUrl,
              createdAt: profile.subscriptionCreated || profile.createdAt,
            },
          });
        }
      }
    }
    
    // Step 3: Create default roles for servers
    console.log('🎭 Creating default roles...');
    const servers = await prisma.server.findMany();
    
    for (const server of servers) {
      const owner = await prisma.user.findFirst({
        where: { userId: server.profileId },
      });
      
      if (owner) {
        const freeRole = await prisma.role.create({
          data: {
            name: 'free',
            serverId: server.id,
            creatorId: owner.id,
            isDefault: true,
          },
        });
        
        const premiumRole = await prisma.role.create({
          data: {
            name: 'premium',
            serverId: server.id,
            creatorId: owner.id,
            color: '#FFD700',
          },
        });
        
        // Grant access to all channels for both roles (can be refined later)
        const channels = await prisma.channel.findMany({
          where: { serverId: server.id },
        });
        
        for (const channel of channels) {
          await prisma.roleChannelAccess.createMany({
            data: [
              { roleId: freeRole.id, channelId: channel.id },
              { roleId: premiumRole.id, channelId: channel.id },
            ],
          });
        }
      }
    }
    
    // Step 4: Update Member relationships
    console.log('👥 Updating member relationships...');
    const members = await prisma.member.findMany({
      include: { profile: true },
    });
    
    for (const member of members) {
      const user = await prisma.user.findFirst({
        where: { userId: member.profile.userId },
      });
      
      if (user) {
        // Assign role based on subscription status
        const subscription = await prisma.subscription.findFirst({
          where: { userId: user.id },
        });
        
        const roleName = subscription && subscription.status === 'ACTIVE' ? 'premium' : 'free';
        const role = await prisma.role.findFirst({
          where: { 
            serverId: member.serverId,
            name: roleName 
          },
        });
        
        if (role) {
          await prisma.member.update({
            where: { id: member.id },
            data: { 
              userId: user.id,
              roleId: role.id,
            },
          });
        }
      }
    }
    
    // Step 5: Migrate push notification subscriptions
    console.log('🔔 Migrating push subscriptions...');
    for (const profile of profiles) {
      if (profile.pushSubscriptions && profile.pushSubscriptions.length > 0) {
        const user = await prisma.user.findFirst({
          where: { userId: profile.userId },
        });
        
        if (user) {
          for (const pushSub of profile.pushSubscriptions) {
            await prisma.pushSubscription.create({
              data: {
                userId: user.id,
                endpoint: pushSub.endpoint,
                keys: pushSub.keys,
              },
            });
          }
        }
      }
    }
    
    console.log('✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

function mapLegacyStatus(oldStatus: string): SubscriptionStatus {
  const statusMap = {
    'FREE': 'FREE',
    'ACTIVE': 'ACTIVE',
    'EXPIRED': 'CANCELED',
    'CANCELLED': 'CANCELED',
    'TRIAL': 'TRIALING'
  };
  return statusMap[oldStatus] || 'FREE';
}

// Run migration
migrateDatabase()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

## Acceptance Criteria
- [ ] Successfully migrate all Profile data to User table with userId field
- [ ] Extract subscription data to dedicated Subscription table
- [ ] Create default roles (free, premium) for all servers
- [ ] Update all Member relationships to use new schema
- [ ] Migrate push notification subscriptions to separate table
- [ ] Validate data integrity after migration
- [ ] Update all API routes to use new User model instead of Profile
- [ ] Test role-based access control functionality

## Files to Create/Modify
- `scripts/migrate-database.ts` (new migration script)
- `prisma/schema.prisma` (update to final schema)
- Update all API routes to use User instead of Profile:
  - `src/app/api/auth/session-check/route.ts`
  - `src/app/api/admin/users/route.ts`
  - All subscription-related routes
  - All webhook handlers

## Dependencies
- Ticket 1.1 (Database Schema Migration Planning)
- All Phase 2 service implementations to handle new schema

## Rollback Plan
- Keep Profile table during initial deployment
- Maintain dual-write capability during transition
- Prepared rollback scripts to restore Profile-based system 