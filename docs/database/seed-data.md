# Database Seed Data Strategy - TRADERSUTOPIA

## Overview

This document outlines the seed data strategy for TRADERSUTOPIA development and testing environments. The seed data provides realistic scenarios for testing subscription flows, role-based access control, and messaging functionality.

## Seed Data Philosophy

### 1. **Realistic User Scenarios**
- Mix of admin and regular users
- Various subscription states (free, trial, active, canceled)
- Different user engagement patterns

### 2. **Complete Server Hierarchies**
- Multiple servers with different organizational structures
- Nested sections and channels
- Realistic content categorization

### 3. **Access Control Testing**
- Free and premium roles with different permissions
- Cross-server membership scenarios
- Admin and member role distributions

### 4. **Content Variety**
- Messages with different attachment types
- Notification scenarios
- Subscription lifecycle events

## Sample Data Structure

### Users (Development Environment)

```typescript
// Admin Users (Content Creators)
const adminUsers = [
  {
    userId: "clerk_admin_001",
    email: "trader.alpha@tradersutopia.com",
    name: "Alpha Trader",
    imageUrl: "https://example.com/avatars/alpha.jpg",
    isAdmin: true
  },
  {
    userId: "clerk_admin_002", 
    email: "market.guru@tradersutopia.com",
    name: "Market Guru",
    imageUrl: "https://example.com/avatars/guru.jpg",
    isAdmin: true
  }
];

// Regular Users (Subscribers)
const regularUsers = [
  {
    userId: "clerk_user_001",
    email: "newbie.trader@email.com",
    name: "Newbie Trader",
    imageUrl: "https://example.com/avatars/newbie.jpg",
    isAdmin: false
  },
  {
    userId: "clerk_user_002",
    email: "day.trader@email.com", 
    name: "Day Trader Pro",
    imageUrl: "https://example.com/avatars/daytrader.jpg",
    isAdmin: false
  },
  {
    userId: "clerk_user_003",
    email: "swing.trader@email.com",
    name: "Swing Master",
    imageUrl: "https://example.com/avatars/swing.jpg", 
    isAdmin: false
  }
];
```

### Subscription States

```typescript
const subscriptionScenarios = [
  // Active Premium Subscriber
  {
    userId: "clerk_user_001", // Newbie Trader
    stripeSubscriptionId: "sub_1234567890",
    stripeCustomerId: "cus_1234567890",
    status: "ACTIVE",
    currency: "usd",
    created: new Date("2024-01-15"),
    currentPeriodStart: new Date("2024-07-01"),
    currentPeriodEnd: new Date("2024-08-01"),
    startDate: new Date("2024-01-15"),
    defaultPaymentMethod: "pm_1234567890",
    collectionMethod: "charge_automatically",
    items: [
      {
        id: "si_1234567890",
        price: {
          id: "price_premium_monthly",
          unit_amount: 4999,
          currency: "usd"
        },
        quantity: 1
      }
    ]
  },
  
  // Trial User
  {
    userId: "clerk_user_002", // Day Trader Pro
    stripeSubscriptionId: "sub_0987654321",
    stripeCustomerId: "cus_0987654321", 
    status: "TRIALING",
    currency: "usd",
    created: new Date("2024-07-20"),
    trialStart: new Date("2024-07-20"),
    trialEnd: new Date("2024-07-27"),
    currentPeriodStart: new Date("2024-07-20"),
    currentPeriodEnd: new Date("2024-08-20")
  },
  
  // Free User (No subscription)
  // clerk_user_003 (Swing Master) - No subscription record
  
  // Canceled Subscription
  {
    userId: "clerk_user_004", // (Additional user for canceled scenario)
    stripeSubscriptionId: "sub_canceled_001",
    stripeCustomerId: "cus_canceled_001",
    status: "CANCELED",
    currency: "usd",
    created: new Date("2024-03-01"),
    canceledAt: new Date("2024-06-30"),
    endedAt: new Date("2024-06-30"),
    currentPeriodEnd: new Date("2024-06-30")
  }
];
```

### Server Organization

```typescript
const servers = [
  {
    id: "server_001",
    name: "TRADERSUTOPIA MAIN", 
    imageUrl: "https://example.com/servers/main.png",
    inviteCode: "TRADERS001",
    ownerId: "clerk_admin_001" // Alpha Trader
  },
  {
    id: "server_002",
    name: "Advanced Strategies",
    imageUrl: "https://example.com/servers/advanced.png", 
    inviteCode: "ADVANCED01",
    ownerId: "clerk_admin_002" // Market Guru
  }
];

// Sections for Main Server
const sections = [
  {
    id: "section_001",
    name: "📈 Market Analysis",
    serverId: "server_001",
    creatorId: "clerk_admin_001",
    position: 0
  },
  {
    id: "section_002", 
    name: "💰 Trading Signals",
    serverId: "server_001",
    creatorId: "clerk_admin_001",
    position: 1
  },
  {
    id: "section_003",
    name: "📚 Education", 
    serverId: "server_001",
    creatorId: "clerk_admin_001",
    position: 2
  },
  {
    id: "section_004",
    name: "🎯 Premium Content",
    serverId: "server_001", 
    creatorId: "clerk_admin_001",
    position: 3
  }
];

// Channels within sections
const channels = [
  // Market Analysis Section
  {
    id: "channel_001",
    name: "daily-market-overview",
    type: "ANNOUNCEMENT",
    topic: "Daily market analysis and key levels to watch",
    serverId: "server_001",
    sectionId: "section_001",
    creatorId: "clerk_admin_001",
    position: 0
  },
  {
    id: "channel_002", 
    name: "sector-rotation",
    type: "TEXT",
    topic: "Sector analysis and rotation strategies",
    serverId: "server_001",
    sectionId: "section_001", 
    creatorId: "clerk_admin_001",
    position: 1
  },
  
  // Trading Signals Section
  {
    id: "channel_003",
    name: "swing-signals",
    type: "TEXT",
    topic: "Multi-day swing trading opportunities",
    serverId: "server_001",
    sectionId: "section_002",
    creatorId: "clerk_admin_001", 
    position: 0
  },
  {
    id: "channel_004",
    name: "day-trade-alerts",
    type: "TEXT", 
    topic: "Intraday trading setups and alerts",
    serverId: "server_001",
    sectionId: "section_002",
    creatorId: "clerk_admin_001",
    position: 1
  },
  
  // Education Section (Free Access)
  {
    id: "channel_005",
    name: "basics-and-fundamentals",
    type: "TEXT",
    topic: "Trading basics for new members",
    serverId: "server_001", 
    sectionId: "section_003",
    creatorId: "clerk_admin_001",
    position: 0
  },
  
  // Premium Content Section
  {
    id: "channel_006",
    name: "exclusive-setups",
    type: "TEXT",
    topic: "High-probability setups for premium members only",
    serverId: "server_001",
    sectionId: "section_004",
    creatorId: "clerk_admin_001",
    position: 0
  }
];
```

### Role-Based Access Control

```typescript
const roles = [
  // Free Role (Default)
  {
    id: "role_free_001",
    name: "free",
    color: "#6B7280", // Gray
    serverId: "server_001", 
    creatorId: "clerk_admin_001",
    isDefault: true
  },
  
  // Premium Role
  {
    id: "role_premium_001",
    name: "premium",
    color: "#F59E0B", // Amber/Gold
    serverId: "server_001",
    creatorId: "clerk_admin_001",
    isDefault: false
  }
];

// Role Access Permissions
const roleChannelAccess = [
  // Free role access (Education only)
  {
    roleId: "role_free_001",
    channelId: "channel_005" // basics-and-fundamentals
  },
  
  // Premium role access (All channels)
  {
    roleId: "role_premium_001", 
    channelId: "channel_001" // daily-market-overview
  },
  {
    roleId: "role_premium_001",
    channelId: "channel_002" // sector-rotation  
  },
  {
    roleId: "role_premium_001",
    channelId: "channel_003" // swing-signals
  },
  {
    roleId: "role_premium_001", 
    channelId: "channel_004" // day-trade-alerts
  },
  {
    roleId: "role_premium_001",
    channelId: "channel_005" // basics-and-fundamentals
  },
  {
    roleId: "role_premium_001",
    channelId: "channel_006" // exclusive-setups
  }
];

// Section Access
const roleSectionAccess = [
  // Free access to Education section only
  {
    roleId: "role_free_001",
    sectionId: "section_003" // Education
  },
  
  // Premium access to all sections  
  {
    roleId: "role_premium_001",
    sectionId: "section_001" // Market Analysis
  },
  {
    roleId: "role_premium_001", 
    sectionId: "section_002" // Trading Signals
  },
  {
    roleId: "role_premium_001",
    sectionId: "section_003" // Education
  },
  {
    roleId: "role_premium_001",
    sectionId: "section_004" // Premium Content
  }
];
```

### Server Membership

```typescript
const members = [
  // Active Premium Member
  {
    userId: "clerk_user_001", // Newbie Trader (Active subscription)
    serverId: "server_001",
    roleId: "role_premium_001",
    nickname: "NewbieT",
    joinedAt: new Date("2024-01-15")
  },
  
  // Trial Member (Premium access during trial)
  {
    userId: "clerk_user_002", // Day Trader Pro (Trial)
    serverId: "server_001", 
    roleId: "role_premium_001",
    nickname: "DayTraderPro",
    joinedAt: new Date("2024-07-20")
  },
  
  // Free Member
  {
    userId: "clerk_user_003", // Swing Master (No subscription)
    serverId: "server_001",
    roleId: "role_free_001", 
    nickname: "SwingMaster",
    joinedAt: new Date("2024-07-01")
  }
];
```

### Sample Messages & Attachments

```typescript
const sampleMessages = [
  // Daily Market Overview
  {
    id: "msg_001",
    content: "📊 **Daily Market Analysis - July 26, 2024**\n\n🔥 **Key Levels Today:**\n• SPY: Watch 545 support, 548 resistance\n• QQQ: 475 key level to hold\n• IWM: Looking for bounce off 220\n\n📈 **Sector Focus:** Technology showing relative strength\n\n⚠️ **Risk Management:** Keep positions small ahead of Fed meeting next week",
    channelId: "channel_001", // daily-market-overview
    memberId: "member_admin_001", // Alpha Trader's member record
    createdAt: new Date("2024-07-26T09:15:00Z")
  },
  
  // Swing Signal with Chart
  {
    id: "msg_002", 
    content: "🎯 **SWING SETUP: $AAPL**\n\n📊 **Setup:** Bull flag continuation\n💰 **Entry:** $224.50 - $225.00\n🛑 **Stop:** $222.00\n🎯 **Target 1:** $230.00\n🎯 **Target 2:** $235.00\n\n⏰ **Timeframe:** 3-5 days\n📊 **Risk/Reward:** 1:3\n\nChart analysis attached 👇",
    channelId: "channel_003", // swing-signals
    memberId: "member_admin_001",
    createdAt: new Date("2024-07-26T14:30:00Z")
  }
];

const sampleAttachments = [
  // Chart attachment for AAPL swing setup
  {
    messageId: "msg_002",
    filename: "AAPL_swing_setup_july26.png",
    url: "https://cdn.tradersutopia.com/charts/aapl_swing_july26.png",
    cdnUrl: "https://cdn.tradersutopia.com/charts/optimized/aapl_swing_july26.webp",
    thumbnailUrl: "https://cdn.tradersutopia.com/charts/thumbs/aapl_swing_july26_thumb.webp",
    fileType: "image/png", 
    fileSize: 156789,
    width: 1200,
    height: 800,
    uploadKey: "charts/aapl_swing_july26.png",
    metadata: {
      description: "AAPL daily chart showing bull flag pattern and key levels",
      altText: "Apple stock chart with technical analysis"
    }
  }
];
```

### Notification Samples

```typescript
const sampleNotifications = [
  // Welcome notification for new premium subscriber
  {
    userId: "clerk_user_001",
    type: "SUBSCRIPTION_RENEWED",
    title: "Welcome to Premium! 🎉",
    message: "Your premium subscription is now active. You have full access to all trading signals and analysis.",
    read: false,
    actionUrl: "/servers/server_001",
    metadata: {
      subscriptionId: "sub_1234567890",
      planName: "Premium Monthly"
    }
  },
  
  // Trial ending notification
  {
    userId: "clerk_user_002", 
    type: "TRIAL_ENDING",
    title: "Trial ending in 1 day ⏰",
    message: "Your premium trial expires tomorrow. Subscribe now to continue receiving exclusive trading signals.",
    read: false,
    actionUrl: "/pricing",
    metadata: {
      trialEndDate: "2024-07-27T23:59:59Z",
      daysRemaining: 1
    }
  },
  
  // New message notification
  {
    userId: "clerk_user_001",
    type: "NEW_MESSAGE", 
    title: "New signal in #swing-signals",
    message: "Alpha Trader posted a new AAPL swing setup",
    read: false,
    actionUrl: "/servers/server_001/channels/channel_003",
    metadata: {
      messageId: "msg_002",
      channelName: "swing-signals",
      authorName: "Alpha Trader"
    }
  }
];
```

### Timer Configuration

```typescript
const timerData = [
  {
    startTime: new Date("2024-07-26T09:30:00Z"), // Market open
    duration: 6.5, // 6.5 hours (market hours)
    message: "🔥 Live Trading Session - Following SPY & QQQ setups",
    priceMessage: "Join premium for live trade alerts and real-time analysis",
    isActive: true
  }
];
```

## Seeding Strategy

### 1. **Environment-Specific Seeds**

#### Development Environment
- Complete dataset with all scenarios
- Test users with known credentials
- Sample content for UI development
- All subscription states represented

#### Testing Environment  
- Focused datasets for specific test scenarios
- Automated test data generation
- Performance testing with larger datasets
- Edge case scenarios

#### Staging Environment
- Production-like data volumes
- Anonymized real-world patterns
- Performance validation datasets
- Security testing scenarios

### 2. **Seed Script Structure**

```typescript
// scripts/seed-database.ts
export async function seedDatabase(environment: 'dev' | 'test' | 'staging') {
  console.log(`🌱 Seeding database for ${environment} environment...`);
  
  // 1. Clear existing data (development only)
  if (environment === 'dev') {
    await clearDatabase();
  }
  
  // 2. Create users
  await seedUsers(environment);
  
  // 3. Create subscriptions  
  await seedSubscriptions(environment);
  
  // 4. Create servers and organization
  await seedServers(environment);
  await seedSections(environment);
  await seedChannels(environment);
  
  // 5. Create roles and permissions
  await seedRoles(environment);
  await seedRoleAccess(environment);
  
  // 6. Create memberships
  await seedMemberships(environment);
  
  // 7. Create sample content
  await seedMessages(environment);
  await seedAttachments(environment);
  
  // 8. Create notifications
  await seedNotifications(environment);
  
  // 9. Create timer data
  await seedTimers(environment);
  
  console.log(`✅ Database seeded successfully for ${environment}`);
}
```

### 3. **Data Validation**

#### Referential Integrity
- All foreign keys properly linked
- Cascade deletion testing
- Constraint validation

#### Business Logic Validation
- Subscription status consistency
- Role permission correctness  
- Access control enforcement

#### Performance Validation
- Query performance with realistic data volumes
- Index effectiveness verification
- Join optimization validation

## Testing Scenarios

### 1. **Subscription Lifecycle**
- Free user signup and trial activation
- Trial to paid conversion
- Subscription cancellation and renewal
- Payment failure handling

### 2. **Access Control**
- Role-based channel access
- Premium content protection
- Admin-only message sending
- Cross-server permissions

### 3. **Content Management**
- Message creation and attachments
- Notification delivery
- Channel organization
- Server management

### 4. **Performance Testing**
- Large message volumes
- Multiple concurrent users
- Complex permission queries
- Notification batch processing

## Maintenance & Updates

### 1. **Regular Updates**
- Monthly seed data refresh
- New feature scenario addition
- Performance optimization
- Security testing scenarios

### 2. **Version Control**
- Seed data versioning
- Environment-specific configurations
- Migration between seed versions
- Rollback capabilities

---

*This seed data strategy ensures comprehensive testing coverage while providing realistic development scenarios for the TRADERSUTOPIA platform.* 