import Stripe from 'stripe';

// =============================================================================
// BASE PRISMA MODEL TYPES (simplified until client regeneration)
// =============================================================================

export interface User {
  id: string; // Clerk user ID (primary key)
  email: string;
  name: string;
  imageUrl?: string;
  isAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Subscription {
  id: string;
  userId: string;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  status: string;
  currentPeriodEnd?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface Server {
  id: string;
  name: string;
  imageUrl?: string;
  inviteCode: string;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Channel {
  id: string;
  name: string;
  type: string;
  topic?: string;
  serverId: string;
  sectionId?: string;
  creatorId: string;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Section {
  id: string;
  name: string;
  serverId: string;
  creatorId: string;
  parentId?: string;
  position: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Member {
  id: string;
  userId: string;
  serverId: string;
  roleId: string;
  nickname?: string;
  joinedAt: Date;
  updatedAt: Date;
}

interface Role {
  id: string;
  name: string;
  color?: string;
  serverId: string;
  creatorId: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  content: string;
  channelId: string;
  memberId: string;
  deleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Attachment interface removed - use Prisma's Attachment type instead

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  actionUrl?: string;
  metadata?: any;
  createdAt: Date;
}

// =============================================================================
// STRIPE SERVICE TYPES
// =============================================================================

export interface CreateCustomerData {
  email: string;
  name?: string;
  metadata?: Record<string, string>;
}

export interface UpdateCustomerData {
  name?: string;
  email?: string;
  metadata?: Record<string, string>;
}

export interface CreateSubscriptionData {
  customer: string;
  items: Array<{ price: string; quantity?: number }>;
  coupon?: string;
  trial_period_days?: number;
  metadata?: Record<string, string>;
  payment_behavior?:
    | 'default_incomplete'
    | 'error_if_incomplete'
    | 'allow_incomplete';
}

export interface UpdateSubscriptionData {
  cancel_at_period_end?: boolean;
  coupon?: string;
  metadata?: Record<string, string>;
  items?: Array<{
    id?: string;
    price?: string;
    quantity?: number;
    deleted?: boolean;
  }>;
  payment_behavior?:
    | 'default_incomplete'
    | 'error_if_incomplete'
    | 'allow_incomplete';
}

export interface ListSubscriptionOptions {
  limit?: number;
  expand?: string[];
  status?: 'active' | 'canceled' | 'past_due' | 'trialing' | 'all';
  startingAfter?: string;
  endingBefore?: string;
}

// =============================================================================
// DATABASE SERVICE TYPES
// =============================================================================

// User Service Types
export interface CreateUserData {
  userId: string; // Clerk user ID (will be used as primary key)
  email: string;
  name: string;
  imageUrl?: string;
  isAdmin?: boolean;
}

export interface UpdateUserData {
  name?: string;
  email?: string;
  imageUrl?: string;
  isAdmin?: boolean;
}

// UpsertUserData removed - unused interface

// UserWithSubscription removed - unused interface (inline types used instead)

// Server Service Types
// CreateServerData removed - unused interface

export interface UpdateServerData {
  name?: string;
  imageUrl?: string;
  inviteCode?: string;
}

export interface ServerWithMember extends Server {
  members: Array<Member & { user: User; role: Role }>;
  channels: Channel[];
  sections: Array<Section & { channels: Channel[] }>;
}

// ServerWithDetails removed - unused interface

// Channel Service Types
export interface CreateChannelData {
  name: string;
  type?: 'TEXT' | 'ANNOUNCEMENT';
  topic?: string;
  serverId: string;
  sectionId?: string;
}

export interface UpdateChannelData {
  name?: string;
  topic?: string;
  sectionId?: string;
  position?: number;
}

// FindChannelCriteria removed - unused interface

export interface ChannelWithAccess extends Channel {
  server: {
    id: string;
    members: Array<
      Member & {
        user: User;
        role: Role;
      }
    >;
  };
  section?: Section | null;
  creator: User;
}

// ChannelReorderData removed - unused interface

// Message Service Types
export interface CreateMessageData {
  content: string;
  channelId: string;
  memberId: string;
}

export interface UpdateMessageData {
  content?: string;
  deleted?: boolean;
}

interface AccessControlCheck {
  hasAccess: boolean;
  reason?: string;
  requiredRole?: string;
  userRole?: string;
}

export interface ChannelAccessResult extends AccessControlCheck {
  channel?: ChannelWithAccess;
  member?: Member & { user: User; role: Role };
}

export interface ServerAccessResult extends AccessControlCheck {
  server?: ServerWithMember;
  member?: Member & { user: User; role: Role };
}
