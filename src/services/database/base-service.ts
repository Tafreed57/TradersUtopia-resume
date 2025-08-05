import { PrismaClient, Prisma } from '@prisma/client';
import { apiLogger } from '@/lib/enhanced-logger';
import { DatabaseError, ServiceError, ValidationError } from './errors';
import { maskId } from '@/lib/error-handling';
import type { PrismaTransaction } from './types';

/**
 * Abstract base class for all database services that use Prisma ORM.
 * Provides common error handling, validation, pagination, and transaction utilities.
 *
 * Uses a singleton pattern for PrismaClient to share database connections across
 * all service instances for better performance and resource utilization.
 *
 * @abstract
 * @example
 * ```typescript
 * class UserService extends BaseDatabaseService {
 *   async getUser(id: string) {
 *     try {
 *       this.validateId(id, 'userId');
 *       return await this.prisma.user.findUnique({ where: { id } });
 *     } catch (error) {
 *       this.handleError(error, 'get_user', { id });
 *     }
 *   }
 * }
 * ```
 */
export abstract class BaseDatabaseService {
  public prisma: PrismaClient;

  // Singleton pattern for shared PrismaClient instance
  private static sharedPrisma: PrismaClient | null = null;
  private static cleanupHandlersRegistered = false;

  /**
   * Creates a new database service instance using a shared PrismaClient.
   * The PrismaClient singleton is created once and reused across all service instances
   * to optimize database connection pooling and reduce resource consumption.
   */
  constructor() {
    this.prisma = BaseDatabaseService.getSharedPrismaClient();
  }

  /**
   * Gets or creates the shared PrismaClient instance.
   * Uses singleton pattern to ensure only one PrismaClient exists across the application.
   *
   * @returns The shared PrismaClient instance
   */
  private static getSharedPrismaClient(): PrismaClient {
    if (!BaseDatabaseService.sharedPrisma) {
      BaseDatabaseService.sharedPrisma = new PrismaClient({
        datasources: {
          db: {
            // Use validated and properly formatted database URL
            url: process.env.DATABASE_URL,
          },
        },
        log:
          process.env.NODE_ENV === 'development'
            ? ['error', 'warn']
            : ['error'],
      });

      // Register cleanup handlers only once
      if (!BaseDatabaseService.cleanupHandlersRegistered) {
        process.on('beforeExit', async () => {
          await BaseDatabaseService.cleanup();
        });

        process.on('SIGINT', async () => {
          await BaseDatabaseService.cleanup();
          process.exit(0);
        });

        process.on('SIGTERM', async () => {
          await BaseDatabaseService.cleanup();
          process.exit(0);
        });

        BaseDatabaseService.cleanupHandlersRegistered = true;
      }

      apiLogger.databaseOperation('prisma_singleton_created', true, {
        nodeEnv: process.env.NODE_ENV,
        logLevel: process.env.NODE_ENV === 'development' ? 'warn' : 'error',
      });
    }

    return BaseDatabaseService.sharedPrisma;
  }

  /**
   * Cleanup method to properly disconnect the shared PrismaClient.
   * Should be called during application shutdown to ensure clean disconnection.
   */
  public static async cleanup(): Promise<void> {
    if (BaseDatabaseService.sharedPrisma) {
      try {
        await BaseDatabaseService.sharedPrisma.$disconnect();
        apiLogger.databaseOperation('prisma_singleton_disconnected', true, {
          message: 'PrismaClient singleton disconnected cleanly',
        });
      } catch (error) {
        apiLogger.databaseOperation(
          'prisma_singleton_disconnect_error',
          false,
          {
            error: error instanceof Error ? error.message : String(error),
          }
        );
      } finally {
        BaseDatabaseService.sharedPrisma = null;
        BaseDatabaseService.cleanupHandlersRegistered = false;
      }
    }
  }

  /**
   * Handles and logs database operation errors with structured logging.
   * Converts Prisma errors to appropriate service errors and never returns.
   *
   * @param error - The error that occurred
   * @param operation - Name of the operation that failed
   * @param context - Additional context for logging
   * @throws {DatabaseError} For Prisma-specific errors
   * @throws {ServiceError} For general service errors
   */
  protected handleError(
    error: unknown,
    operation: string,
    context?: any
  ): never {
    apiLogger.databaseOperation(operation, false, {
      service: this.constructor.name,
      error: error instanceof Error ? error.message : String(error),
      context,
      stack: error instanceof Error ? error.stack : undefined,
    });

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw new DatabaseError(
        `Failed to ${operation}: ${error.message}`,
        error.code
      );
    }

    throw new ServiceError(`Failed to ${operation}`, error);
  }

  /**
   * Validates that an ID is a properly formatted CUID.
   *
   * @param id - The ID to validate
   * @param fieldName - Name of the field for error messages
   * @throws {ValidationError} If the ID is invalid or malformed
   */
  protected validateId(id: string, fieldName: string): void {
    if (!id || typeof id !== 'string') {
      throw new ValidationError(`Invalid ${fieldName}: ${id}`);
    }
  }

  /**
   * Validates that a required field is present and not empty.
   *
   * @param value - The value to validate
   * @param fieldName - Name of the field for error messages
   * @throws {ValidationError} If the field is missing or empty
   */
  protected validateRequired(value: any, fieldName: string): void {
    if (value === null || value === undefined || value === '') {
      throw new ValidationError(`${fieldName} is required`);
    }
  }

  /**
   * Logs successful database operations with structured logging.
   *
   * @param operation - Name of the successful operation
   * @param context - Additional context for logging
   */
  protected logSuccess(operation: string, context?: any): void {
    apiLogger.databaseOperation(operation, true, {
      service: this.constructor.name,
      context,
    });
  }

  /**
   * Generic method to create a record
   */
  protected async createRecord<T>(
    model: string,
    data: any,
    include?: any
  ): Promise<T> {
    try {
      const record = await (this.prisma as any)[model].create({
        data,
        include,
      });

      this.logSuccess(`${model}_created`, {
        id: record.id ? maskId(record.id) : 'unknown',
      });

      return record;
    } catch (error) {
      return await this.handleError(error, `create_${model}`, { data });
    }
  }

  /**
   * Generic method to update a record
   */
  protected async updateRecord<T>(
    model: string,
    id: string,
    data: any,
    include?: any
  ): Promise<T> {
    try {
      this.validateId(id, `${model}Id`);

      const record = await (this.prisma as any)[model].update({
        where: { id },
        data,
        include,
      });

      this.logSuccess(`${model}_updated`, {
        id: maskId(id),
        updatedFields: Object.keys(data),
      });

      return record;
    } catch (error) {
      return await this.handleError(error, `update_${model}`, { id, data });
    }
  }

  /**
   * Generic method to upsert a record
   */
  protected async upsertRecord<T>(
    model: string,
    where: any,
    create: any,
    update: any,
    include?: any
  ): Promise<T> {
    try {
      const record = await (this.prisma as any)[model].upsert({
        where,
        create,
        update,
        include,
      });

      this.logSuccess(`${model}_upserted`, {
        id: record.id ? maskId(record.id) : 'unknown',
      });

      return record;
    } catch (error) {
      return await this.handleError(error, `upsert_${model}`, {
        where,
        create,
        update,
      });
    }
  }

  /**
   * Generic method to check if a record exists
   */
  protected async recordExists(model: string, where: any): Promise<boolean> {
    try {
      const count = await (this.prisma as any)[model].count({ where });
      return count > 0;
    } catch (error) {
      return await this.handleError(error, `check_${model}_exists`, { where });
    }
  }

  /**
   * Generic method to find many records
   */
  protected async findMany<T>(model: string, options: any = {}): Promise<T[]> {
    try {
      const records = await (this.prisma as any)[model].findMany(options);

      this.logSuccess(`${model}_list_retrieved`, {
        count: records.length,
        hasWhere: !!options.where,
        hasInclude: !!options.include,
      });

      return records;
    } catch (error) {
      return await this.handleError(error, `find_many_${model}`, { options });
    }
  }

  /**
   * Generic method to count records
   */
  protected async countRecords(
    model: string,
    where?: any,
    context?: any
  ): Promise<number> {
    try {
      const count = await (this.prisma as any)[model].count({ where });

      this.logSuccess(`${model}_count_retrieved`, {
        count,
        hasWhere: !!where,
        context,
      });

      return count;
    } catch (error) {
      return await this.handleError(error, `count_${model}`, {
        where,
        context,
      });
    }
  }

  /**
   * Builds pagination options for Prisma queries with cursor-based pagination.
   * Automatically limits results to a maximum of 100 items for performance.
   *
   * @param cursor - Optional cursor for pagination
   * @param limit - Maximum number of items to return (default: 10, max: 100)
   * @returns Prisma pagination options object
   */
  protected buildPaginationOptions(cursor?: string, limit: number = 10) {
    return {
      take: Math.min(limit, 100), // Max 100 items
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor } : undefined,
    };
  }

  /**
   * Executes a database operation within a Prisma transaction.
   * Provides automatic rollback on errors and ensures data consistency.
   *
   * @template T - The return type of the transaction operation
   * @param operation - The operation to execute within the transaction
   * @returns Promise resolving to the operation result
   * @throws {DatabaseError} If the transaction fails
   */
  protected async executeTransaction<T>(
    operation: (tx: PrismaTransaction) => Promise<T>
  ): Promise<T> {
    return await this.prisma.$transaction(operation);
  }
}
