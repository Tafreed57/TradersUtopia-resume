# Ticket 5.3: Access Control Integration
**Priority:** MEDIUM | **Effort:** 2 days | **Risk:** Low

## Description
Integrate subscription status checking with the role-based access control system to ensure premium features are properly gated.

## Implementation
```typescript
// src/services/access-control-service.ts
export class AccessControlService extends BaseService {
  
  async checkUserPremiumAccess(userId: string): Promise<boolean> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          subscription: true
        }
      });
      
      if (!user?.subscription) {
        return false; // No subscription = no premium access
      }
      
      return this.shouldGrantPremiumAccess(user.subscription);
    } catch (error) {
      this.handleError(error, 'check user premium access', { userId });
      return false; // Fail securely
    }
  }
  
  async enforceChannelAccess(userId: string, channelId: string): Promise<boolean> {
    try {
      const channel = await this.prisma.channel.findUnique({
        where: { id: channelId },
        include: {
          roleChannelAccess: {
            include: {
              role: true
            }
          }
        }
      });
      
      if (!channel) return false;
      
      // Check if channel requires premium access
      const requiresPremium = channel.roleChannelAccess.some(
        access => access.role.name === 'premium'
      );
      
      if (requiresPremium) {
        return await this.checkUserPremiumAccess(userId);
      }
      
      return true; // Public channel
    } catch (error) {
      this.handleError(error, 'enforce channel access', { userId, channelId });
      return false;
    }
  }
  
  async enforceSectionAccess(userId: string, sectionId: string): Promise<boolean> {
    try {
      const section = await this.prisma.section.findUnique({
        where: { id: sectionId },
        include: {
          roleSectionAccess: {
            include: {
              role: true
            }
          }
        }
      });
      
      if (!section) return false;
      
      // Check if section requires premium access
      const requiresPremium = section.roleSectionAccess.some(
        access => access.role.name === 'premium'
      );
      
      if (requiresPremium) {
        return await this.checkUserPremiumAccess(userId);
      }
      
      return true; // Public section
    } catch (error) {
      this.handleError(error, 'enforce section access', { userId, sectionId });
      return false;
    }
  }
  
  async getUserAccessLevel(userId: string): Promise<'free' | 'premium' | 'admin'> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          subscription: true
        }
      });
      
      if (!user) return 'free';
      
      if (user.isAdmin) return 'admin';
      
      if (user.subscription && this.shouldGrantPremiumAccess(user.subscription)) {
        return 'premium';
      }
      
      return 'free';
    } catch (error) {
      this.handleError(error, 'get user access level', { userId });
      return 'free'; // Fail securely
    }
  }
  
  async validateFeatureAccess(userId: string, feature: string): Promise<boolean> {
    try {
      const accessLevel = await this.getUserAccessLevel(userId);
      
      // Define feature access requirements
      const featureRequirements = {
        'premium-channels': 'premium',
        'file-uploads': 'premium',
        'advanced-search': 'premium',
        'admin-panel': 'admin',
        'user-management': 'admin',
        'server-settings': 'admin'
      };
      
      const required = featureRequirements[feature] || 'free';
      
      switch (required) {
        case 'admin':
          return accessLevel === 'admin';
        case 'premium':
          return accessLevel === 'premium' || accessLevel === 'admin';
        case 'free':
        default:
          return true;
      }
    } catch (error) {
      this.handleError(error, 'validate feature access', { userId, feature });
      return false;
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
}
```

## Usage Examples

### API Route Protection
```typescript
// src/app/api/premium-feature/route.ts
import { withAuth } from '@/middleware/auth-middleware';
import { AccessControlService } from '@/services/access-control-service';

export const POST = withAuth(async (req, { user }) => {
  const accessControl = new AccessControlService();
  
  const hasAccess = await accessControl.validateFeatureAccess(user.id, 'premium-channels');
  
  if (!hasAccess) {
    return new NextResponse('Premium subscription required', { status: 403 });
  }
  
  // Proceed with premium feature logic
  return NextResponse.json({ success: true });
});
```

### Channel Access in Components
```typescript
// src/components/channel/channel-item.tsx
import { useAccessControl } from '@/hooks/use-access-control';

export function ChannelItem({ channel }) {
  const { hasChannelAccess, isLoading } = useAccessControl(channel.id);
  
  if (isLoading) return <ChannelSkeleton />;
  
  if (!hasChannelAccess) {
    return <PremiumChannelTeaser channel={channel} />;
  }
  
  return <ChannelContent channel={channel} />;
}
```

## Acceptance Criteria
- [ ] Implement premium access checking based on subscription status
- [ ] Integrate with existing role-based channel access
- [ ] Provide security-first access enforcement (fail closed)
- [ ] Add comprehensive logging for access decisions
- [ ] Support real-time access updates when subscription changes
- [ ] Create reusable access control hooks for frontend components
- [ ] Support feature-level access control beyond channels

### Documentation Requirements
- [ ] Create access control architecture diagram showing subscription integration
- [ ] Document access control patterns and security model in `docs/security/access-control.md`
- [ ] Add frontend integration guide for access control hooks

### Testing Requirements
- [ ] **Unit Tests**: AccessControlService methods with various subscription scenarios
- [ ] **Integration Tests**: Access control with real subscription data
- [ ] **Access Control Tests** (CRITICAL):
  - [ ] **Free User Access**: Verify access limited to public channels only
  - [ ] **Premium User Access**: Test access to premium channels and features
  - [ ] **Admin Access**: Verify admin users have full access regardless of subscription
  - [ ] **Real-time Updates**: Test access changes immediately when subscription changes
  - [ ] **Grace Period Access**: Test access during payment failures within grace period
- [ ] **Security Tests**: Test fail-closed behavior and unauthorized access attempts
- [ ] **Frontend Integration Tests**: Test access control hooks and UI component behavior

## Files to Create
- `src/services/access-control-service.ts`
- `src/hooks/use-access-control.ts`
- `src/types/access-control.ts`

## Files to Modify
- Update existing channel/section components to use access control
- Update API routes to enforce premium feature access

## Dependencies
- Ticket 5.2 (Subscription Sync Service)
- Ticket 2.3 (Server & Channel Operations)

## Context
This ticket is part of **Phase 5: Stripe-Database Subscription Synchronization**, which implements comprehensive webhook-based synchronization between Stripe subscription events and the local Subscription table to ensure accurate premium access control. 