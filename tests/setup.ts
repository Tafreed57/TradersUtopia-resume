/**
 * Test Setup File
 *
 * Global test configuration, mocks, and setup utilities for Jest tests.
 */

import { jest } from '@jest/globals';

// Mock environment variables
process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key_for_testing';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_mock_clerk_key';
process.env.CLERK_SECRET_KEY = 'sk_test_mock_clerk_secret';

// Mock Prisma Client
const mockPrismaClient = {
  $connect: jest.fn(),
  $disconnect: jest.fn(),
  $transaction: jest.fn(),
  $queryRaw: jest.fn(),
  $queryRawUnsafe: jest.fn(),
  user: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    upsert: jest.fn(),
  },
  subscription: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  server: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  channel: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  member: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  message: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  role: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

// Mock Prisma
jest.unstable_mockModule('@/lib/prismadb', () => ({
  prisma: mockPrismaClient,
}));

// Mock Stripe
const mockStripe = {
  customers: {
    list: jest.fn(),
    search: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    retrieve: jest.fn(),
    del: jest.fn(),
  },
  subscriptions: {
    list: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    retrieve: jest.fn(),
    cancel: jest.fn(),
  },
  paymentMethods: {
    list: jest.fn(),
  },
  webhooks: {
    constructEvent: jest.fn(),
  },
};

// Mock Stripe constructor
jest.unstable_mockModule('stripe', () => ({
  default: jest.fn(() => mockStripe),
}));

// Mock enhanced logger
const mockLogger = {
  databaseOperation: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
};

jest.unstable_mockModule('@/lib/enhanced-logger', () => ({
  apiLogger: mockLogger,
}));

// Export mocks for use in tests
export { mockPrismaClient, mockStripe, mockLogger };

// Global test utilities
export const createMockUser = (overrides = {}) => ({
  id: 'user_123',
  userId: 'clerk_user_123',
  email: 'test@example.com',
  name: 'Test User',
  imageUrl: 'https://example.com/avatar.jpg',
  isAdmin: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

export const createMockStripeCustomer = (overrides = {}) => ({
  id: 'cus_123',
  email: 'test@example.com',
  name: 'Test User',
  created: Math.floor(Date.now() / 1000),
  metadata: {},
  ...overrides,
});

export const createMockStripeSubscription = (overrides = {}) => ({
  id: 'sub_123',
  customer: 'cus_123',
  status: 'active',
  created: Math.floor(Date.now() / 1000),
  current_period_start: Math.floor(Date.now() / 1000),
  current_period_end: Math.floor(
    (Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000
  ),
  items: {
    data: [
      {
        price: {
          id: 'price_123',
          product: 'prod_123',
          unit_amount: 2999,
          currency: 'usd',
          recurring: { interval: 'month' },
        },
      },
    ],
  },
  ...overrides,
});

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});
