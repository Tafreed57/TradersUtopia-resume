import { PrismaClient } from '@prisma/client';

// Global variable to store Prisma client
declare global {
  var __prisma__: PrismaClient | undefined;
}

// Create a single instance of PrismaClient
export const db =
  globalThis.__prisma__ ||
  new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

// In development, attach to global to prevent multiple instances
if (process.env.NODE_ENV === 'development') {
  globalThis.__prisma__ = db;
}

// Legacy export for backward compatibility
export const prisma = db;

export default db;
