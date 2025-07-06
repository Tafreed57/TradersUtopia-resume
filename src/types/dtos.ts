// Common DTOs
export interface ErrorResponseDto {
  error: string;
  message?: string;
}

export interface SuccessResponseDto {
  success: boolean;
  message?: string;
}

// Health DTOs
export interface HealthResponseDto {
  status: 'healthy' | 'error';
  message: string;
  timestamp: string;
  database?: string;
}

// Authentication DTOs
export interface AuthUserDto {
  userId: string;
  email?: string;
  name?: string;
}

// Subscription DTOs
export interface SubscriptionCheckResponseDto {
  hasAccess: boolean;
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'FREE' | 'TRIAL' | 'ERROR';
  canStartTrial: boolean;
  subscriptionEnd?: string;
  subscriptionStart?: string;
  stripeCustomerId?: string;
  stripeProductId?: string;
}

export interface SubscriptionActivateRequestDto {
  sessionId: string;
}

export interface SubscriptionActivateResponseDto {
  success: boolean;
  subscription?: {
    status: string;
    subscriptionEnd: string;
    stripeCustomerId: string;
  };
}

export interface SubscriptionCancelResponseDto {
  success: boolean;
  message: string;
}

export interface SubscriptionDetailsResponseDto {
  subscription: {
    status: string;
    subscriptionEnd?: string;
    subscriptionStart?: string;
    stripeCustomerId?: string;
    stripeProductId?: string;
    autoRenew?: boolean;
  };
  billing?: {
    nextBillingDate?: string;
    amount?: number;
    currency?: string;
  };
}

export interface StartTrialResponseDto {
  success: boolean;
  message: string;
  trialEnd?: string;
}

export interface ToggleAutoRenewRequestDto {
  autoRenew: boolean;
}

export interface ToggleAutoRenewResponseDto {
  success: boolean;
  autoRenew: boolean;
  message: string;
}

export interface CreateCouponRequestDto {
  code: string;
  discountPercent: number;
  validUntil: string;
  maxUses?: number;
}

export interface CreateCouponResponseDto {
  success: boolean;
  coupon: {
    id: string;
    code: string;
    discountPercent: number;
    validUntil: string;
    maxUses?: number;
  };
}

// User Management DTOs
export interface UserProfileResponseDto {
  id: string;
  userId: string;
  name: string;
  email: string;
  imageUrl?: string;
  subscriptionStatus: string;
  isAdmin: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateUserProfileRequestDto {
  name?: string;
  email?: string;
  imageUrl?: string;
}

export interface UpdateUserProfileResponseDto {
  success: boolean;
  profile: UserProfileResponseDto;
}

export interface PasswordChangeRequestDto {
  currentPassword?: string;
  newPassword: string;
  action: 'set' | 'change';
}

export interface PasswordChangeResponseDto {
  success: boolean;
  message: string;
  isFirstTimeSetup: boolean;
}

export interface PasswordStatusResponseDto {
  hasPassword: boolean;
  message: string;
}

// Admin DTOs
export interface AdminStatusResponseDto {
  isAdmin: boolean;
  hasAccess: boolean;
}

export interface AdminUsersResponseDto {
  users: Array<{
    id: string;
    userId: string;
    name: string;
    email: string;
    subscriptionStatus: string;
    isAdmin: boolean;
    createdAt: string;
  }>;
  total: number;
  page: number;
  limit: number;
}

export interface AdminGrantAccessRequestDto {
  userId: string;
  duration?: number; // days
}

export interface AdminGrantAccessResponseDto {
  success: boolean;
  message: string;
}

export interface AdminRevokeAccessRequestDto {
  userId: string;
}

export interface AdminRevokeAccessResponseDto {
  success: boolean;
  message: string;
}

export interface AdminToggleAdminRequestDto {
  userId: string;
  isAdmin: boolean;
}

export interface AdminToggleAdminResponseDto {
  success: boolean;
  message: string;
  user: {
    id: string;
    isAdmin: boolean;
  };
}

export interface AdminDeleteUserRequestDto {
  userId: string;
}

export interface AdminDeleteUserResponseDto {
  success: boolean;
  message: string;
}

export interface AdminGrantSubscriptionRequestDto {
  userId: string;
  duration: number; // days
  productId?: string;
}

export interface AdminGrantSubscriptionResponseDto {
  success: boolean;
  message: string;
  subscription: {
    status: string;
    subscriptionEnd: string;
  };
}

export interface AdminCancelSubscriptionRequestDto {
  userId: string;
}

export interface AdminCancelSubscriptionResponseDto {
  success: boolean;
  message: string;
}

export interface SystemHealthResponseDto {
  status: 'healthy' | 'degraded' | 'down';
  services: {
    database: 'up' | 'down';
    auth: 'up' | 'down';
    stripe: 'up' | 'down';
  };
  metrics: {
    uptime: number;
    memoryUsage: number;
    activeUsers: number;
  };
  timestamp: string;
}

// Server Management DTOs
export interface ServerDto {
  id: string;
  name: string;
  imageUrl?: string;
  inviteCode: string;
  profileId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateServerRequestDto {
  name: string;
  imageUrl?: string;
}

export interface CreateServerResponseDto {
  success: boolean;
  server: ServerDto;
}

export interface UpdateServerRequestDto {
  name?: string;
  imageUrl?: string;
}

export interface UpdateServerResponseDto {
  success: boolean;
  server: ServerDto;
}

export interface ServerInviteCodeResponseDto {
  inviteCode: string;
}

export interface LeaveServerResponseDto {
  success: boolean;
  message: string;
}

export interface EnsureDefaultServerResponseDto {
  success: boolean;
  server: ServerDto;
}

// Channel Management DTOs
export interface ChannelDto {
  id: string;
  name: string;
  type: 'TEXT' | 'AUDIO' | 'VIDEO';
  profileId: string;
  serverId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateChannelRequestDto {
  name: string;
  type: 'TEXT' | 'AUDIO' | 'VIDEO';
  serverId: string;
}

export interface CreateChannelResponseDto {
  success: boolean;
  channel: ChannelDto;
}

export interface UpdateChannelRequestDto {
  name?: string;
  type?: 'TEXT' | 'AUDIO' | 'VIDEO';
}

export interface UpdateChannelResponseDto {
  success: boolean;
  channel: ChannelDto;
}

export interface DeleteChannelResponseDto {
  success: boolean;
  message: string;
}

// Message DTOs
export interface MessageDto {
  id: string;
  content: string;
  fileUrl?: string;
  deleted: boolean;
  memberId: string;
  channelId: string;
  createdAt: string;
  updatedAt: string;
  member: {
    id: string;
    role: string;
    profile: {
      id: string;
      name: string;
      imageUrl?: string;
    };
  };
}

export interface CreateMessageRequestDto {
  content: string;
  fileUrl?: string;
  channelId: string;
}

export interface CreateMessageResponseDto {
  success: boolean;
  message: MessageDto;
}

export interface UpdateMessageRequestDto {
  content: string;
}

export interface UpdateMessageResponseDto {
  success: boolean;
  message: MessageDto;
}

export interface DeleteMessageResponseDto {
  success: boolean;
  message: string;
}

export interface MessagesResponseDto {
  items: MessageDto[];
  nextCursor?: string;
}

// Source Messages DTOs (for external database)
export interface SourceMessageDto {
  id: string;
  content?: string;
  fileUrl?: string;
  deleted: boolean;
  createdAt: string;
  updatedAt: string;
  member: {
    id: string;
    role: string;
    profile: {
      id: string;
      name: string;
      imageUrl?: string;
    };
  };
}

export interface SourceMessagesResponseDto {
  items: SourceMessageDto[];
  nextCursor?: string;
}

// Member DTOs
export interface MemberDto {
  id: string;
  role: 'ADMIN' | 'MODERATOR' | 'GUEST';
  profileId: string;
  serverId: string;
  createdAt: string;
  updatedAt: string;
  profile: {
    id: string;
    name: string;
    imageUrl?: string;
  };
}

export interface UpdateMemberRequestDto {
  role: 'ADMIN' | 'MODERATOR' | 'GUEST';
}

export interface UpdateMemberResponseDto {
  success: boolean;
  member: MemberDto;
}

// Direct Message DTOs
export interface DirectMessageDto {
  id: string;
  content: string;
  fileUrl?: string;
  deleted: boolean;
  memberId: string;
  conversationId: string;
  createdAt: string;
  updatedAt: string;
  member: {
    id: string;
    role: string;
    profile: {
      id: string;
      name: string;
      imageUrl?: string;
    };
  };
}

export interface CreateDirectMessageRequestDto {
  content: string;
  fileUrl?: string;
  conversationId: string;
}

export interface CreateDirectMessageResponseDto {
  success: boolean;
  message: DirectMessageDto;
}

export interface DirectMessagesResponseDto {
  items: DirectMessageDto[];
  nextCursor?: string;
}

// Notification DTOs
export interface NotificationDto {
  id: string;
  type:
    | 'MESSAGE'
    | 'MENTION'
    | 'SERVER_UPDATE'
    | 'FRIEND_REQUEST'
    | 'SYSTEM'
    | 'PAYMENT'
    | 'SECURITY';
  title: string;
  message: string;
  read: boolean;
  actionUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationsResponseDto {
  notifications: NotificationDto[];
  unreadCount: number;
}

export interface MarkNotificationReadRequestDto {
  notificationId: string;
}

export interface MarkNotificationReadResponseDto {
  success: boolean;
  message: string;
}

export interface NotificationPreferencesDto {
  system: boolean;
  payment: boolean;
  mentions: boolean;
  messages: boolean;
  security: boolean;
  serverUpdates: boolean;
}

export interface UpdateNotificationPreferencesRequestDto {
  emailNotifications?: NotificationPreferencesDto;
  pushNotifications?: NotificationPreferencesDto;
}

export interface UpdateNotificationPreferencesResponseDto {
  success: boolean;
  preferences: {
    emailNotifications: NotificationPreferencesDto;
    pushNotifications: NotificationPreferencesDto;
  };
}

export interface PushSubscriptionRequestDto {
  subscription: {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  };
}

export interface PushSubscriptionResponseDto {
  success: boolean;
  message: string;
}

// File Upload DTOs
export interface UploadSecurityResponseDto {
  allowedTypes: string[];
  maxFileSize: number;
  securityChecks: string[];
}

// Participant Token DTOs
export interface ParticipantTokenRequestDto {
  room: string;
  username: string;
}

export interface ParticipantTokenResponseDto {
  token: string;
  room: string;
  username: string;
}

// Payment DTOs
export interface PaymentStatusResponseDto {
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  sessionId?: string;
  customerId?: string;
  subscriptionId?: string;
}

export interface VerifyStripePaymentRequestDto {
  sessionId: string;
}

export interface VerifyStripePaymentResponseDto {
  success: boolean;
  status: string;
  subscription?: {
    id: string;
    status: string;
    currentPeriodEnd: string;
  };
}

// CSRF DTOs
export interface CsrfTokenResponseDto {
  token: string;
  expiresAt: string;
}

// Rate Limiting DTOs
export interface ClearRateLimitsResponseDto {
  success: boolean;
  message: string;
  clearedLimits: string[];
}

// Product Access DTOs
export interface ProductSubscriptionResponseDto {
  hasAccess: boolean;
  productId?: string;
  subscriptionStatus: string;
  accessLevel: 'free' | 'trial' | 'premium';
}

// Sync DTOs
export interface SyncProfilesResponseDto {
  success: boolean;
  synced: number;
  errors: number;
  message: string;
}
