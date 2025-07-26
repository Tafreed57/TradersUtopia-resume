# Ticket 6.1: System Architecture Diagrams
**Priority:** HIGH | **Effort:** 2 days | **Risk:** Low

## Description
Create comprehensive Mermaid diagrams documenting the application's architecture, service layers, and data flow after the refactoring.

## Architecture Diagrams to Create

### 1. High-Level System Architecture
```mermaid
graph TB
    subgraph "Client Layer"
        WEB[Web App - Next.js]
        MOB[Mobile View]
    end
    
    subgraph "API Layer"
        AUTH[Authentication Middleware]
        API[API Routes]
        WH[Webhook Handlers]
    end
    
    subgraph "Service Layer"
        AS[Auth Service]
        SS[Subscription Service]
        CS[Channel Service]
        US[User Service]
        NS[Notification Service]
    end
    
    subgraph "Data Layer"
        DB[(PostgreSQL DB)]
        REDIS[(Redis Cache)]
    end
    
    subgraph "External Services"
        CLERK[Clerk Auth]
        STRIPE[Stripe Payments]
        UPLOADTHING[UploadThing]
        TRIGGER[Trigger.dev]
    end
    
    WEB --> AUTH
    MOB --> AUTH
    AUTH --> API
    API --> SS
    API --> CS
    API --> US
    WH --> SS
    SS --> DB
    CS --> DB
    US --> DB
    NS --> TRIGGER
    
    CLERK --> AUTH
    STRIPE --> WH
    SS --> STRIPE
    API --> UPLOADTHING
```

### 2. Authentication & Authorization Flow
```mermaid
sequenceDiagram
    participant U as User
    participant C as Client
    participant AM as Auth Middleware
    participant CS as Clerk Service
    participant SS as Subscription Service
    participant AC as Access Control
    participant DB as Database
    
    U->>C: Login Request
    C->>CS: Authenticate with Clerk
    CS->>C: Auth Token
    C->>AM: API Request + Token
    AM->>CS: Verify Token
    CS->>AM: User Info
    AM->>SS: Check Subscription
    SS->>DB: Query Subscription
    DB->>SS: Subscription Data
    SS->>AC: Verify Access Level
    AC->>AM: Access Decision
    AM->>C: Authorized Response
```

### 3. Subscription Management Flow
```mermaid
graph TD
    START[User Initiates Subscription]
    START --> STRIPE_CHECKOUT[Stripe Checkout Session]
    STRIPE_CHECKOUT --> PAYMENT{Payment Successful?}
    
    PAYMENT -->|Yes| WEBHOOK_SUCCESS[invoice.payment_succeeded]
    PAYMENT -->|No| WEBHOOK_FAILED[invoice.payment_failed]
    
    WEBHOOK_SUCCESS --> SYNC_DB[Sync Subscription to DB]
    SYNC_DB --> GRANT_ACCESS[Grant Premium Access]
    GRANT_ACCESS --> UPDATE_ROLES[Update User Roles]
    UPDATE_ROLES --> NOTIFY_USER[Notify User]
    
    WEBHOOK_FAILED --> LOG_FAILURE[Log Payment Failure]
    LOG_FAILURE --> RETRY_LOGIC[Stripe Retry Logic]
    RETRY_LOGIC --> PAYMENT
    
    UPDATE_ROLES --> ACCESS_GRANTED[Premium Access Active]
```

### 4. Service Layer Dependencies
```mermaid
graph TB
    subgraph "Authentication Layer"
        AUTH_MW[Auth Middleware]
        CSRF[CSRF Protection]
        RATE[Rate Limiting]
    end
    
    subgraph "Service Layer"
        BASE[Base Service]
        PROFILE[Profile Service]
        SERVER[Server Service]
        CHANNEL[Channel Service]
        SUBSCRIPTION[Subscription Service]
        STRIPE_SVC[Stripe Service]
        ACCESS[Access Control]
    end
    
    subgraph "Data Layer"
        PRISMA[Prisma ORM]
        DB[(PostgreSQL)]
    end
    
    AUTH_MW --> PROFILE
    AUTH_MW --> SERVER
    AUTH_MW --> CHANNEL
    
    PROFILE --> BASE
    SERVER --> BASE
    CHANNEL --> BASE
    SUBSCRIPTION --> BASE
    STRIPE_SVC --> BASE
    
    BASE --> PRISMA
    PRISMA --> DB
    
    SUBSCRIPTION --> STRIPE_SVC
    ACCESS --> SUBSCRIPTION
    CHANNEL --> ACCESS
```

### 5. Real-Time Communication Architecture
```mermaid
graph TB
    subgraph "Frontend"
        COMP[React Components]
        WS[WebSocket Client]
        PUSH[Push Notifications]
    end
    
    subgraph "Backend"
        API[API Routes]
        DB_TRIGGERS[Database Triggers]
        TRIGGER_DEV[Trigger.dev Jobs]
    end
    
    subgraph "External"
        PUSH_SERVICE[Push Service]
        WS_SERVER[WebSocket Server]
    end
    
    COMP --> API
    API --> DB_TRIGGERS
    DB_TRIGGERS --> TRIGGER_DEV
    TRIGGER_DEV --> PUSH_SERVICE
    PUSH_SERVICE --> PUSH
    
    DB_TRIGGERS --> WS_SERVER
    WS_SERVER --> WS
```

### 6. Data Flow Architecture
```mermaid
graph LR
    subgraph "User Actions"
        LOGIN[User Login]
        MESSAGE[Send Message]
        SUBSCRIBE[Subscribe]
    end
    
    subgraph "API Processing"
        AUTH_CHECK[Auth Check]
        VALIDATION[Input Validation]
        BUSINESS_LOGIC[Business Logic]
    end
    
    subgraph "Data Persistence"
        DB_WRITE[Database Write]
        CACHE_UPDATE[Cache Update]
        TRIGGER_EVENT[Trigger Events]
    end
    
    subgraph "Real-time Updates"
        WEBSOCKET[WebSocket Broadcast]
        PUSH_NOTIF[Push Notifications]
        UI_UPDATE[UI Updates]
    end
    
    LOGIN --> AUTH_CHECK
    MESSAGE --> AUTH_CHECK
    SUBSCRIBE --> AUTH_CHECK
    
    AUTH_CHECK --> VALIDATION
    VALIDATION --> BUSINESS_LOGIC
    BUSINESS_LOGIC --> DB_WRITE
    
    DB_WRITE --> CACHE_UPDATE
    DB_WRITE --> TRIGGER_EVENT
    
    TRIGGER_EVENT --> WEBSOCKET
    TRIGGER_EVENT --> PUSH_NOTIF
    WEBSOCKET --> UI_UPDATE
    PUSH_NOTIF --> UI_UPDATE
```

## Files to Create
- `docs/architecture/system-overview.md`
- `docs/architecture/authentication-flow.md`
- `docs/architecture/subscription-management.md`
- `docs/architecture/service-dependencies.md`
- `docs/architecture/real-time-communication.md`
- `docs/architecture/data-flow.md`

## Implementation Details

### System Overview Document Structure
```markdown
# System Architecture Overview

## High-Level Architecture
[Mermaid diagram]

## Core Components
- **Client Layer**: Next.js web application with mobile-responsive design
- **API Layer**: RESTful API routes with authentication middleware
- **Service Layer**: Business logic encapsulation with base service patterns
- **Data Layer**: PostgreSQL with Prisma ORM and Redis caching

## External Integrations
- **Authentication**: Clerk for user management
- **Payments**: Stripe for subscription handling
- **File Storage**: UploadThing for file uploads
- **Background Jobs**: Trigger.dev for notifications

## Security Architecture
- CSRF protection on all state-changing operations
- Rate limiting per user and endpoint
- Role-based access control with subscription tiers
- Webhook signature verification
```

### Authentication Flow Documentation
```markdown
# Authentication & Authorization Flow

## Authentication Process
[Sequence diagram]

## Authorization Levels
1. **Free Users**: Basic access to public channels
2. **Premium Users**: Access to premium channels and features
3. **Admin Users**: Full system administration capabilities

## Security Measures
- JWT token validation via Clerk
- Subscription status verification
- Real-time access updates on subscription changes
```

## Acceptance Criteria
- [ ] Create 6+ comprehensive architecture diagrams using Mermaid
- [ ] Document all major system components and their interactions
- [ ] Show authentication and authorization flows clearly
- [ ] Illustrate subscription management lifecycle
- [ ] Provide service layer dependency mapping
- [ ] Include real-time communication patterns
- [ ] Document data flow from user actions to UI updates
- [ ] Ensure diagrams are maintainable and version-controlled

### Documentation Requirements
- [ ] Create comprehensive architecture documentation in `docs/architecture/` directory
- [ ] Document diagram maintenance procedures and update guidelines
- [ ] Add architecture decision records (ADRs) explaining key design choices

### Testing Requirements
- [ ] **Documentation Tests**: Verify all architecture diagrams render correctly
- [ ] **Accuracy Tests**: Validate diagrams match actual implementation
- [ ] **Completeness Tests**: Ensure all major system components are documented
- [ ] **Maintenance Tests**: Verify diagram update procedures work correctly

## Dependencies
- Completion of Phases 1-5 (to accurately reflect final architecture)

## Context
This ticket is part of **Phase 6: Comprehensive Documentation & Architecture Diagrams**, which creates comprehensive architecture diagrams, database schema visualizations, and updated developer guides to ensure the application is maintainable and new developers can onboard effectively. 