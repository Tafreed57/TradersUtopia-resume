# TRADERSUTOPIA Notification System Flow
## Complete End-to-End Documentation

### 📋 Overview
This document details the complete notification flow in TRADERSUTOPIA, from user setup to message delivery. The system uses **Trigger.dev** for reliable background processing and supports both database notifications and push notifications.

### 🏗️ System Architecture

```mermaid
graph TB
    subgraph "Frontend Components"
        A[NotificationBell Component]
        B[Channel Settings]
        C[Browser Push API]
    end
    
    subgraph "API Layer"
        D[/api/notifications/push]
        E[/api/notifications/channels/[channelId]]
        F[/api/servers/[serverId]/channels/[channelId]/messages]
    end
    
    subgraph "Background Processing"
        G[Trigger.dev Jobs]
        H[sendMessageNotifications Task]
    end
    
    subgraph "Database Services"
        I[UserService]
        J[NotificationService]
        K[MessageService]
        L[MemberService]
    end
    
    subgraph "External Services"
        M[Web Push Service]
        N[VAPID Server]
    end
    
    A --> D
    B --> E
    F --> G
    G --> H
    H --> I
    H --> J
    H --> K
    H --> L
    H --> M
    C --> N
```

---

## 🔄 Complete User Journey Flow

### Phase 1: User Setup & Configuration

#### 1.1 Enable Push Notifications

```mermaid
sequenceDiagram
    participant U as User
    participant NB as NotificationBell
    participant B as Browser
    participant API as /api/notifications/push
    participant DB as Database
    participant VAPID as VAPID Service

    U->>NB: Shift+Click or Right-Click Bell
    NB->>NB: togglePushNotifications()
    NB->>B: Check support (ServiceWorker + PushManager)
    B-->>NB: Support confirmed
    
    NB->>B: Notification.requestPermission()
    B->>U: Show permission dialog
    U->>B: Grant permission
    B-->>NB: 'granted'
    
    NB->>VAPID: GET /api/vapid-public-key
    VAPID-->>NB: VAPID public key
    
    NB->>B: navigator.serviceWorker.ready
    B-->>NB: ServiceWorker registration
    
    NB->>B: pushManager.subscribe(vapidKey)
    B-->>NB: PushSubscription object
    
    NB->>API: POST subscription + deviceInfo
    API->>DB: Save push subscription
    DB-->>API: Success
    API-->>NB: Subscription saved
    
    NB->>NB: setIsPushEnabled(true)
    NB->>NB: Show success toast
    NB->>NB: Update bell color to yellow
```

**Visual State Changes:**
- **Before**: 🔔 Hollow bell (push notifications OFF)
- **After**: 🔔 Yellow filled bell (push notifications ON)

#### 1.2 Configure Channel Notifications

```mermaid
sequenceDiagram
    participant U as User
    participant CH as Channel Interface
    participant API as /api/notifications/channels/[channelId]
    participant NS as NotificationService
    participant DB as Database

    U->>CH: Navigate to channel settings
    U->>CH: Toggle "Enable notifications for this channel"
    CH->>API: PATCH { enabled: true }
    
    API->>API: Validate request & auth
    API->>NS: updateChannelNotificationPreference()
    NS->>DB: UPDATE channel_notification_preferences
    DB-->>NS: Preference updated
    NS-->>API: Success result
    API-->>CH: { enabled: true, message: "Notifications enabled" }
    
    CH->>CH: Update UI to show enabled state
    CH->>U: Show success feedback
```

---

### Phase 2: Message Creation & Notification Processing

#### 2.1 Admin Sends Message

```mermaid
sequenceDiagram
    participant A as Admin
    participant UI as Message Interface
    participant API as /api/servers/.../messages
    participant MS as MessageService
    participant TG as Trigger.dev
    participant DB as Database

    A->>UI: Type message & click Send
    UI->>API: POST { content, channelId, serverId }
    
    API->>API: Validate admin permissions
    API->>MS: createMessage()
    MS->>DB: INSERT message
    DB-->>MS: Message created
    MS-->>API: Message object
    
    API->>TG: sendMessageNotifications.trigger()
    Note over API,TG: Payload: messageId, content, channelId, serverId, senderId, senderName
    TG-->>API: Job handle with ID
    
    API-->>UI: Message + notificationJobId
    UI->>UI: Display message in chat
```

#### 2.2 Trigger.dev Background Processing

```mermaid
sequenceDiagram
    participant TG as Trigger.dev Job
    participant SS as ServerService
    participant CS as ChannelService
    participant MS as MemberService
    participant NS as NotificationService
    participant US as UserService
    participant PS as PushService

    TG->>TG: Start sendMessageNotifications task
    
    par Get Channel & Server Info
        TG->>SS: findServerWithMemberAccess()
        TG->>CS: findChannelWithAccess()
    end
    
    SS-->>TG: Server details
    CS-->>TG: Channel details
    
    TG->>MS: Get server members (exclude sender)
    MS-->>TG: All server members
    
    TG->>TG: Filter eligible members
    Note over TG: Keep only: Active subscription OR Admin users
    
    TG->>NS: Get channel notification preferences
    Note over TG: For each eligible member
    NS-->>TG: Preference map (enabled/disabled)
    
    TG->>TG: Filter by channel preferences
    Note over TG: Remove users with notifications disabled for this channel
    
    TG->>TG: Detect @mentions in message
    
    loop Process in batches (10 users)
        TG->>NS: createNotification() for each user
        NS-->>TG: Notification created
        
        TG->>PS: sendPushNotification()
        PS-->>TG: Push notification result
    end
    
    TG->>TG: Return processing summary
```

#### 2.3 Push Notification Delivery

```mermaid
sequenceDiagram
    participant PS as PushService
    participant US as UserService
    participant WP as Web Push
    participant B as User Browser
    participant DB as Database

    PS->>US: getUserWithPushSubscriptions()
    US-->>PS: User + active push subscriptions
    
    PS->>PS: Filter valid subscriptions
    Note over PS: isActive=true && failureCount<5
    
    PS->>PS: Build notification payload
    Note over PS: title, body, icon, actions, requireInteraction
    
    loop For each valid subscription
        PS->>WP: webpush.sendNotification()
        
        alt Success
            WP-->>PS: Delivery confirmed
            PS->>US: updatePushSubscriptionActivity()
            US->>DB: UPDATE last_active
        else Failure (410/404)
            WP-->>PS: Invalid subscription
            PS->>US: deactivatePushSubscription()
            US->>DB: UPDATE is_active = false
        else Other Error
            WP-->>PS: Delivery failed
            PS->>US: incrementPushFailureCount()
            US->>DB: UPDATE failure_count++
        end
    end
    
    PS-->>PS: Return success count > 0
```

---

### Phase 3: User Receives Notification

#### 3.1 Browser Notification Display

```mermaid
sequenceDiagram
    participant WP as Web Push Service
    participant SW as Service Worker
    participant B as Browser
    participant U as User
    participant APP as TRADERSUTOPIA App

    WP->>SW: Push message received
    SW->>SW: Parse notification payload
    SW->>B: showNotification()
    
    B->>U: Display push notification
    Note over B,U: Title: "New message in ServerName #channelName"<br/>Body: "SenderName: message content..."<br/>Icon: TRADERSUTOPIA logo
    
    U->>B: Click notification
    B->>SW: notificationclick event
    SW->>APP: Navigate to actionUrl
    Note over SW,APP: /servers/serverId/channels/channelId
    
    APP->>APP: Open channel with new message
    APP->>APP: Mark notification as read
```

---

## 📊 Database Schema & Relationships

### Core Tables

```mermaid
erDiagram
    USERS {
        string id PK
        string email
        string name
        boolean isAdmin
        timestamp createdAt
    }
    
    PUSH_SUBSCRIPTIONS {
        string id PK
        string userId FK
        string endpoint
        json keys
        json deviceInfo
        timestamp lastActive
        int failureCount
        boolean isActive
        timestamp createdAt
        timestamp updatedAt
    }
    
    CHANNEL_NOTIFICATION_PREFERENCES {
        string id PK
        string userId FK
        string channelId FK
        boolean enabled
        timestamp createdAt
        timestamp updatedAt
    }
    
    NOTIFICATIONS {
        string id PK
        string userId FK
        string type
        string title
        string message
        string actionUrl
        boolean isRead
        timestamp createdAt
    }
    
    MESSAGES {
        string id PK
        string content
        string channelId FK
        string authorId FK
        timestamp createdAt
    }
    
    USERS ||--o{ PUSH_SUBSCRIPTIONS : has
    USERS ||--o{ CHANNEL_NOTIFICATION_PREFERENCES : has
    USERS ||--o{ NOTIFICATIONS : receives
    USERS ||--o{ MESSAGES : sends
```

---

## 🔧 Key Components & APIs

### Frontend Components

#### NotificationBell Component
- **Location**: `src/components/notifications/notification-bell.tsx`
- **Key Functions**:
  - `togglePushNotifications()` - Enable/disable push notifications
  - `checkPushStatus()` - Check current subscription status
  - Bell color indicates push notification state:
    - 🔔 Hollow = Push OFF
    - 🔔 Yellow = Push ON
    - 🔔 Red badge = Unread notifications

### API Endpoints

#### Push Notification Management
- **Endpoint**: `/api/notifications/push`
- **Methods**: 
  - `POST` - Subscribe to push notifications
  - `GET` - Check push notification status
  - `DELETE` - Unsubscribe from push notifications

#### Channel Notification Preferences
- **Endpoint**: `/api/notifications/channels/[channelId]`
- **Methods**:
  - `GET` - Get notification preference for channel
  - `PATCH` - Update notification preference

#### Message Creation
- **Endpoint**: `/api/servers/[serverId]/channels/[channelId]/messages`
- **Method**: `POST` - Create message and trigger notifications

### Background Jobs

#### Trigger.dev Task
- **Location**: `src/trigger/send-message-notifications.ts`
- **Function**: `sendMessageNotifications`
- **Features**:
  - Batch processing (10 users per batch)
  - Retry logic with exponential backoff
  - Comprehensive logging and monitoring
  - Mention detection
  - Channel preference filtering

---

## 🚀 Performance Optimizations

### 1. Batch Processing
- Process notifications in batches of 10 users
- Prevents overwhelming the system
- Optimized for AWS Amplify serverless functions

### 2. Subscription Management
- Automatic cleanup of invalid subscriptions
- Failure count tracking
- Activity-based subscription management

### 3. Channel Filtering
- Early filtering by channel notification preferences
- Reduces unnecessary processing
- User-controlled notification granularity

### 4. Database Optimization
- Indexed queries for performance
- Service layer for consistent data access
- Connection pooling for database efficiency

---

## 🔍 Monitoring & Observability

### Trigger.dev Dashboard
- Real-time job monitoring
- Success/failure rates
- Performance metrics
- Retry attempts and outcomes

### API Logging
- Structured logging with `apiLogger`
- Operation tracking and timing
- Error categorization and handling
- User action audit trail

### Error Handling
- Graceful degradation (DB notifications without push)
- Automatic retry mechanisms
- Invalid subscription cleanup
- Comprehensive error reporting

---

## 🛡️ Security & Permissions

### Authentication
- All endpoints require user authentication
- Admin-only message creation
- User-specific notification access

### CSRF Protection
- CSRF tokens for state-changing operations
- Rate limiting on all endpoints
- Input validation with Zod schemas

### Push Security
- VAPID authentication for push notifications
- Secure subscription key handling
- Device fingerprinting for subscription management

---

## 🔄 Complete Flow Summary

1. **Setup Phase**:
   - User enables push notifications (bell turns yellow)
   - User configures channel notification preferences

2. **Message Phase**:
   - Admin sends message
   - API creates message and triggers background job
   - Trigger.dev processes eligible recipients

3. **Processing Phase**:
   - Filter by subscription status (active/admin)
   - Check channel notification preferences
   - Create database notifications
   - Send push notifications with error handling

4. **Delivery Phase**:
   - Push notifications appear in browser
   - User clicks to navigate to channel
   - Notifications marked as read

This architecture ensures **reliable**, **scalable**, and **user-controlled** notification delivery with comprehensive monitoring and error handling.