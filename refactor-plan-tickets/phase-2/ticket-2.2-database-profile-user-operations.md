# Ticket 2.2: Database Service Layer - Profile & User Operations
**Priority:** HIGH | **Effort:** 3 days | **Risk:** Low

## Description
Implement ProfileService to consolidate the 35+ instances of profile lookup and admin check patterns across API routes with comprehensive logging for security and audit purposes.

## Current Problem
This pattern is repeated 35+ times with inconsistent logging:
```typescript
const profile = await db.profile.findFirst({
  where: {
    OR: [{ userId: user.id }, { email: userEmail }],
  },
});

if (profile?.isAdmin) {
  // Admin logic repeated everywhere - no audit logging
}
```

## Implementation
```typescript
// src/services/database/profile-service.ts
import { apiLogger } from '@/lib/enhanced-logger';

export class ProfileService extends BaseService {
  // Most critical - used 35+ times
  async findByUserIdOrEmail(userIdOrEmail: string): Promise<Profile | null> {
    try {
      this.validateId(userIdOrEmail, 'userIdOrEmail');
      
      const profile = await this.prisma.profile.findFirst({
        where: {
          OR: [
            { userId: userIdOrEmail },
            { email: userIdOrEmail },
          ],
        },
      });

      apiLogger.databaseOperation('profile_lookup', true, { 
        found: !!profile,
        isAdmin: profile?.isAdmin || false,
        userIdMasked: userIdOrEmail.substring(0, 4) + '***'
      });

      return profile;
    } catch (error) {
      this.handleError(error, 'find profile by userId or email', { userIdOrEmail: userIdOrEmail.substring(0, 4) + '***' });
    }
  }
  
  // Admin checks - used 15+ times with security logging  
  async findAdminById(userId: string): Promise<Profile | null> {
    try {
      const profile = await this.findByUserIdOrEmail(userId);
      
      if (profile?.isAdmin) {
        apiLogger.security('Admin access granted', { 
          userId: userId.substring(0, 4) + '***',
          email: profile.email.substring(0, 3) + '***'
        });
      } else {
        apiLogger.security('Admin access denied - insufficient privileges', { 
          userId: userId.substring(0, 4) + '***',
          profileFound: !!profile
        });
      }
      
      return profile?.isAdmin ? profile : null;
    } catch (error) {
      this.handleError(error, 'find admin by ID', { userId: userId.substring(0, 4) + '***' });
    }
  }
  
  // Check if user is admin (boolean result)
  async isUserAdmin(userId: string): Promise<boolean> {
    const profile = await this.findByUserIdOrEmail(userId);
    return profile?.isAdmin || false;
  }
  
  // Subscription-related lookups
  async findWithSubscriptionData(userId: string): Promise<ProfileWithSubscription | null> {
    try {
      this.validateId(userId, 'userId');
      
      return await this.prisma.profile.findFirst({
        where: {
          OR: [{ userId }, { email: userId }],
        },
        include: {
          // Include subscription-related fields that are frequently accessed
          _count: {
            select: {
              servers: true,
              members: true,
            },
          },
        },
      });
    } catch (error) {
      this.handleError(error, 'find profile with subscription data', { userId });
    }
  }
  
  // Create/Update patterns
  async createProfile(data: CreateProfileData): Promise<Profile> {
    try {
      return await this.prisma.profile.create({
        data: {
          userId: data.userId,
          name: data.name,
          imageUrl: data.imageUrl,
          email: data.email,
          isAdmin: data.isAdmin || false,
        },
      });
    } catch (error) {
      this.handleError(error, 'create profile', data);
    }
  }
  
  async updateProfile(id: string, data: UpdateProfileData): Promise<Profile> {
    try {
      this.validateId(id, 'profileId');
      
      return await this.prisma.profile.update({
        where: { id },
        data,
      });
    } catch (error) {
      this.handleError(error, 'update profile', { id, data });
    }
  }
  
  async upsertProfile(data: UpsertProfileData): Promise<Profile> {
    try {
      return await this.prisma.profile.upsert({
        where: { userId: data.userId },
        create: {
          userId: data.userId,
          name: data.name,
          imageUrl: data.imageUrl,
          email: data.email,
          isAdmin: data.isAdmin || false,
        },
        update: {
          name: data.name,
          imageUrl: data.imageUrl,
          email: data.email,
        },
      });
    } catch (error) {
      this.handleError(error, 'upsert profile', data);
    }
  }
  
  // Update subscription data (frequently used pattern)
  async updateSubscriptionData(id: string, data: SubscriptionUpdateData): Promise<Profile> {
    try {
      this.validateId(id, 'profileId');
      
      return await this.prisma.profile.update({
        where: { id },
        data: {
          stripeCustomerId: data.stripeCustomerId,
          stripeSubscriptionId: data.stripeSubscriptionId,
          subscriptionStatus: data.subscriptionStatus,
          subscriptionEnd: data.subscriptionEnd,
          subscriptionStart: data.subscriptionStart,
          subscriptionCurrency: data.subscriptionCurrency,
          discountPercent: data.discountPercent,
          discountName: data.discountName,
          lastInvoiceUrl: data.lastInvoiceUrl,
        },
      });
    } catch (error) {
      this.handleError(error, 'update subscription data', { id, data });
    }
  }
  
  // Bulk operations  
  async findManyProfiles(criteria: FindManyProfileOptions): Promise<Profile[]> {
    try {
      return await this.prisma.profile.findMany({
        where: criteria.where,
        take: criteria.limit,
        skip: criteria.offset,
        orderBy: criteria.orderBy || { createdAt: 'desc' },
        include: criteria.include,
      });
    } catch (error) {
      this.handleError(error, 'find many profiles', criteria);
    }
  }
}

// Types
interface ProfileWithSubscription extends Profile {
  _count: {
    servers: number;
    members: number;
  };
}

interface CreateProfileData {
  userId: string;
  name: string;
  imageUrl: string;
  email: string;
  isAdmin?: boolean;
}

interface UpdateProfileData {
  name?: string;
  imageUrl?: string;
  email?: string;
  isAdmin?: boolean;
}

interface UpsertProfileData extends CreateProfileData {}

interface SubscriptionUpdateData {
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus?: string;
  subscriptionEnd?: Date;
  subscriptionStart?: Date;
  subscriptionCurrency?: string;
  discountPercent?: number;
  discountName?: string;
  lastInvoiceUrl?: string;
}

interface FindManyProfileOptions {
  where?: any;
  limit?: number;
  offset?: number;
  orderBy?: any;
  include?: any;
}
```

## Acceptance Criteria
- [ ] Implement ProfileService with all common profile operations
- [ ] Add proper error handling and validation
- [ ] Create TypeScript interfaces for all parameters
- [ ] Include comprehensive JSDoc documentation
- [ ] Create unit tests for each method
- [ ] Migrate 8 API routes to use ProfileService

### Documentation Requirements
- [ ] Create user data flow diagram showing profile and subscription relationships
- [ ] Document user service patterns in `docs/developers/user-management.md`
- [ ] Add database query optimization guide

### Testing Requirements
- [ ] **Unit Tests**: All ProfileService methods with database mocks
- [ ] **Integration Tests**: Database operations with real database connections
- [ ] **User Access Tests** (CRITICAL):
  - [ ] **Profile Creation**: Test user onboarding flow
  - [ ] **Subscription Linking**: Test profile-subscription relationship
  - [ ] **Access Level Checks**: Test free vs. premium user identification
  - [ ] **Admin Access**: Test admin user detection and validation
- [ ] **Performance Tests**: Query optimization validation under load
- [ ] **Data Integrity Tests**: Ensure referential integrity is maintained

## Files to Create/Modify
- `src/services/database/profile-service.ts` (new)
- `src/services/database/types.ts` (new) - Database-related types
- Migrate these routes first:
  - `src/app/api/auth/session-check/route.ts`
  - `src/app/api/check-product-subscription/route.ts`
  - `src/app/api/admin/users/route.ts`
  - `src/app/api/admin/grant-access/route.ts`
  - `src/app/api/admin/revoke-access/route.ts`
  - `src/app/api/subscription/cancel/route.ts`
  - `src/app/api/subscription/force-sync/route.ts`
  - `src/app/api/webhooks/clerk/route.ts`

## Dependencies
- Ticket 1.4 (Base Service Architecture)
- Ticket 1.1 (Logger Consolidation) 