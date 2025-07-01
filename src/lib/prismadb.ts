import { PrismaClient } from '@prisma/client';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// ✅ SECURITY: Validate DATABASE_URL before using it
function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is not set');
    throw new Error(
      'DATABASE_URL environment variable is required but not found'
    );
  }

  // Validate URL format
  if (
    !databaseUrl.startsWith('postgresql://') &&
    !databaseUrl.startsWith('postgres://')
  ) {
    console.error(
      '❌ DATABASE_URL must start with postgresql:// or postgres://'
    );
    throw new Error(
      'DATABASE_URL must start with postgresql:// or postgres://'
    );
  }

  // Add connection pooling parameters if not already present
  const url = new URL(databaseUrl);

  // Check if pgbouncer parameter is already set
  if (!url.searchParams.has('pgbouncer')) {
    url.searchParams.set('pgbouncer', 'true');
    url.searchParams.set('connect_timeout', '10');
    url.searchParams.set('pool_timeout', '10');
  }

  return url.toString();
}

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    datasources: {
      db: {
        // Use validated and properly formatted database URL
        url: getDatabaseUrl(),
      },
    },
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
