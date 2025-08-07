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

export interface Server {
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

export interface Role {
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

export interface Attachment {
  id: string;
  messageId: string;
  filename: string;
  url: string;
  cdnUrl?: string;
  thumbnailUrl?: string;
  fileType: string;
  fileSize: number;
  width?: number;
  height?: number;
  duration?: number;
  uploadKey?: string;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

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

export interface UpsertUserData extends CreateUserData {}

export interface UserWithSubscription extends User {
  subscription?: Subscription | null;
  _count?: {
    servers: number;
    members: number;
  };
}

// Server Service Types
export interface CreateServerData {
  name: string;
  imageUrl?: string;
  inviteCode?: string;
  ownerId: string;
}

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

export interface ServerWithDetails extends Server {
  channels: Channel[];
  members: Array<Member & { user: User; role: Role }>;
  sections: Array<Section & { channels: Channel[] }>;
}

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

export interface FindChannelCriteria {
  serverId?: string;
  sectionId?: string;
  name?: string;
  type?: 'TEXT' | 'ANNOUNCEMENT';
  limit?: number;
  offset?: number;
}

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

export interface ChannelReorderData {
  id: string;
  position: number;
}
[];

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

export interface MessageWithMember extends Message {
  member: Member & { user: User };
  attachments: Attachment[];
}

// =============================================================================
// COMMON TYPES
// =============================================================================

export interface PaginationOptions {
  limit?: number;
  offset?: number;
  orderBy?: Record<string, 'asc' | 'desc'>;
}

export interface ServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  metadata?: Record<string, any>;
}

export interface AccessControlCheck {
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
