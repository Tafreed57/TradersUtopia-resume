import { PrismaClient } from '@prisma/client';

interface PaginationOptions {
  cursor?: string;
  limit?: number;
}

interface PaginatedResult<T> {
  data: T[];
  nextCursor?: string;
  hasMore: boolean;
}

export type PrismaTransaction = Parameters<
  Parameters<PrismaClient['$transaction']>[0]
>[0];
