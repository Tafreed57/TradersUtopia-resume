import { User } from '@clerk/nextjs/server';

export interface AuthContext {
  user: User;
  userId: string;
  isAdmin?: boolean;
  params?: any;
}

export interface AuthOptions {
  action?: string;
  requireAdmin?: boolean;
  requireCSRF?: boolean;
  rateLimit?: boolean;
}
