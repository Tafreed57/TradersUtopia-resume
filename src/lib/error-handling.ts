import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { apiLogger } from '@/lib/enhanced-logger';

/**
 * Base API Error class for all custom application errors
 */
class APIError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

/**
 * Validation Error - 400 Bad Request
 */
export class ValidationError extends APIError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

/**
 * Authentication Error - 401 Unauthorized
 */
export class AuthenticationError extends APIError {
  constructor(message: string = 'Not authenticated') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

/**
 * Authorization Error - 403 Forbidden
 */
export class AuthorizationError extends APIError {
  constructor(message: string = 'Access denied') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

/**
 * Not Found Error - 404 Not Found
 */
export class NotFoundError extends APIError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

/**
 * Rate Limit Error - 429 Too Many Requests
 */
export class RateLimitError extends APIError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 429, 'RATE_LIMIT_ERROR');
  }
}

/**
 * Standardized error response interface
 */
interface ErrorResponse {
  error: string;
  code?: string;
  details?: any;
  timestamp: string;
}

/**
 * Create standardized error response with proper logging
 */
function createErrorResponse(error: unknown, operation?: string): NextResponse {
  const timestamp = new Date().toISOString();

  // Log error with structured logging
  apiLogger.databaseOperation(operation || 'unknown_operation', false, {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    timestamp,
    errorType:
      error instanceof APIError ? error.constructor.name : 'UnknownError',
  });

  // Handle known API error types
  if (error instanceof APIError) {
    const response: ErrorResponse = {
      error: error.message,
      code: error.code,
      details: error.details,
      timestamp,
    };
    return NextResponse.json(response, { status: error.statusCode });
  }

  // Handle Zod validation errors
  if (error instanceof z.ZodError) {
    const response: ErrorResponse = {
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code,
      })),
      timestamp,
    };
    return NextResponse.json(response, { status: 400 });
  }

  // Handle Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    let message = 'Database error';
    let statusCode = 500;
    let code = error.code;

    switch (error.code) {
      case 'P2002':
        message = 'Resource already exists';
        statusCode = 409;
        break;
      case 'P2025':
        message = 'Resource not found';
        statusCode = 404;
        break;
      case 'P2003':
        message = 'Foreign key constraint failed';
        statusCode = 400;
        break;
      case 'P2014':
        message = 'Invalid ID provided';
        statusCode = 400;
        break;
    }

    const response: ErrorResponse = {
      error: message,
      code: `PRISMA_${code}`,
      timestamp,
    };
    return NextResponse.json(response, { status: statusCode });
  }

  // Handle Prisma Client Validation Errors
  if (error instanceof Prisma.PrismaClientValidationError) {
    const response: ErrorResponse = {
      error: 'Invalid data provided',
      code: 'PRISMA_VALIDATION_ERROR',
      timestamp,
    };
    return NextResponse.json(response, { status: 400 });
  }

  // Handle generic errors
  const response: ErrorResponse = {
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    timestamp,
  };
  return NextResponse.json(response, { status: 500 });
}

/**
 * Higher-order function for wrapping API handlers with error handling
 */
export function withErrorHandling<T extends any[], R>(
  handler: (...args: T) => Promise<NextResponse | R>,
  operation?: string
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      const result = await handler(...args);
      return result instanceof NextResponse
        ? result
        : NextResponse.json(result);
    } catch (error) {
      return createErrorResponse(error, operation);
    }
  };
}

/**
 * Security helpers
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return '***';
  const [local, domain] = email.split('@');
  return `${local.substring(0, Math.min(3, local.length))}***@${domain}`;
}

export function maskId(id: string): string {
  if (!id || id.length < 4) return '***';
  return `${id.substring(0, 4)}***`;
}
