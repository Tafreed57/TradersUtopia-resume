// 🛡️ CSRF Protection System

import { NextRequest } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { apiLogger } from '@/lib/enhanced-logger';
import crypto from 'crypto';

// ==============================================
// 🔒 CSRF TOKEN GENERATION & VALIDATION
// ==============================================

// Singleton CSRF token store that survives Next.js hot reloads
declare global {
  var __csrf_token_store:
    | Map<string, { token: string; expires: number; userId: string }>
    | undefined;
  var __csrf_store_id: string | undefined;
}

// Initialize global store if it doesn't exist
if (!global.__csrf_token_store) {
  global.__csrf_token_store = new Map<
    string,
    { token: string; expires: number; userId: string }
  >();
  global.__csrf_store_id = Math.random().toString(36).substring(2, 15);
}

// Use the global store
const csrfTokenStore = global.__csrf_token_store;

// Generate a secure CSRF token
const generateCSRFToken = (userId: string): string => {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = Date.now() + 60 * 60 * 1000; // 1 hour

  // Store the token
  const tokenData = { token, expires, userId };
  csrfTokenStore.set(token, tokenData);

  // Clean up expired tokens
  cleanupExpiredTokens();

  return token;
};

// Validate CSRF token
const validateCSRFToken = async (request: NextRequest): Promise<boolean> => {
  try {
    // Get current user
    const user = await currentUser();
    if (!user) {
      return false;
    }

    // Check for CSRF token in headers
    const csrfToken =
      request.headers.get('x-csrf-token') ||
      request.headers.get('csrf-token') ||
      request.nextUrl.searchParams.get('csrf_token');

    if (!csrfToken) {
      apiLogger.csrfViolation(request, 'missing_csrf_token');
      return false;
    }

    // Validate token
    const tokenData = csrfTokenStore.get(csrfToken);

    if (!tokenData) {
      return false;
    }

    if (tokenData.expires < Date.now()) {
      csrfTokenStore.delete(csrfToken);
      return false;
    }

    if (tokenData.userId !== user.id) {
      return false;
    }

    // Token is valid
    return true;
  } catch (error) {
    apiLogger.csrfViolation(request, 'validation_error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
};

// Get CSRF token for current user (using currentUser())
export const getCSRFTokenForUser = async (): Promise<string | null> => {
  try {
    const user = await currentUser();
    if (!user) {
      return null;
    }

    return getCSRFTokenForUserId(user.id);
  } catch (error) {
    console.error('❌ [CSRF] Error getting CSRF token for user:', error);
    return null;
  }
};

// Get CSRF token for specific user ID (more reliable for service calls)
export const getCSRFTokenForUserId = (userId: string): string => {
  try {
    // Check if user already has a valid token
    for (const [token, data] of Array.from(csrfTokenStore.entries())) {
      if (data.userId === userId && data.expires > Date.now()) {
        return token;
      }
    }

    // Generate new token
    return generateCSRFToken(userId);
  } catch (error) {
    console.error('❌ [CSRF] Error getting CSRF token for user ID:', error);
    throw error;
  }
};

// Clean up expired tokens
const cleanupExpiredTokens = () => {
  const now = Date.now();
  for (const [token, data] of Array.from(csrfTokenStore.entries())) {
    if (data.expires < now) {
      csrfTokenStore.delete(token);
    }
  }
};

// Get CSRF protection status
export const getCSRFStats = () => {
  cleanupExpiredTokens();
  return {
    activeTokens: csrfTokenStore.size,
    oldestToken: Math.min(
      ...Array.from(csrfTokenStore.values()).map(d => d.expires)
    ),
    newestToken: Math.max(
      ...Array.from(csrfTokenStore.values()).map(d => d.expires)
    ),
  };
};

// Export a rate-limited CSRF validation for high-security endpoints
export const strictCSRFValidation = async (
  request: NextRequest
): Promise<boolean> => {
  // Always require CSRF for high-security endpoints
  const highSecurityPaths = [
    '/api/admin/',
    '/api/user/password',
    '/api/2fa/',
    '/api/subscription/',
  ];

  const pathname = request.nextUrl.pathname;
  const isHighSecurity = highSecurityPaths.some(path =>
    pathname.startsWith(path)
  );

  if (isHighSecurity) {
    return await validateCSRFToken(request);
  }

  return true; // Less critical endpoints can use regular validation
};
