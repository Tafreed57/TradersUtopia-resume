// 🛡️ CSRF Protection System

import { NextRequest } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import crypto from 'crypto';

// ==============================================
// 🔒 CSRF TOKEN GENERATION & VALIDATION
// ==============================================

// In-memory CSRF token store (use Redis in production)
const csrfTokenStore = new Map<
  string,
  { token: string; expires: number; userId: string }
>();

// Generate a secure CSRF token
export const generateCSRFToken = (userId: string): string => {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = Date.now() + 60 * 60 * 1000; // 1 hour

  csrfTokenStore.set(token, { token, expires, userId });

  // Clean up expired tokens
  cleanupExpiredTokens();

  return token;
};

// Validate CSRF token
export const validateCSRFToken = async (
  request: NextRequest
): Promise<boolean> => {
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
      console.warn('🚨 [CSRF] Missing CSRF token in request');
      return false;
    }

    // Validate token
    const tokenData = csrfTokenStore.get(csrfToken);

    if (!tokenData) {
      console.warn('🚨 [CSRF] Invalid CSRF token provided');
      return false;
    }

    if (tokenData.expires < Date.now()) {
      csrfTokenStore.delete(csrfToken);
      console.warn('🚨 [CSRF] Expired CSRF token provided');
      return false;
    }

    if (tokenData.userId !== user.id) {
      console.warn('🚨 [CSRF] CSRF token user ID mismatch');
      return false;
    }

    // Token is valid
    return true;
  } catch (error) {
    console.error('❌ [CSRF] Error validating CSRF token:', error);
    return false;
  }
};

// Get CSRF token for current user
export const getCSRFTokenForUser = async (): Promise<string | null> => {
  try {
    const user = await currentUser();
    if (!user) {
      return null;
    }

    // Check if user already has a valid token
    for (const [token, data] of Array.from(csrfTokenStore.entries())) {
      if (data.userId === user.id && data.expires > Date.now()) {
        return token;
      }
    }

    // Generate new token
    return generateCSRFToken(user.id);
  } catch (error) {
    console.error('❌ [CSRF] Error getting CSRF token for user:', error);
    return null;
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

// ==============================================
// 🛡️ CSRF MIDDLEWARE
// ==============================================

export const csrfProtection = () => {
  return async (
    request: NextRequest
  ): Promise<{ success: true } | { success: false; reason: string }> => {
    // Skip CSRF validation for GET requests (they should be idempotent)
    if (request.method === 'GET') {
      return { success: true };
    }

    // Skip CSRF validation for certain endpoints that have their own protection
    const skipCSRFPaths = [
      '/api/webhooks/',
      '/api/auth/',
      '/api/uploadthing',
      '/api/socket/',
    ];

    const pathname = request.nextUrl.pathname;
    if (skipCSRFPaths.some(path => pathname.startsWith(path))) {
      return { success: true };
    }

    // Validate CSRF token for state-changing operations
    const isValid = await validateCSRFToken(request);

    if (!isValid) {
      return {
        success: false,
        reason: 'Invalid or missing CSRF token',
      };
    }

    return { success: true };
  };
};

// ==============================================
// 🔧 UTILITY FUNCTIONS
// ==============================================

// Check if request needs CSRF protection
export const needsCSRFProtection = (request: NextRequest): boolean => {
  // Only protect state-changing methods
  const protectedMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  if (!protectedMethods.includes(request.method)) {
    return false;
  }

  // Skip certain endpoints
  const skipCSRFPaths = [
    '/api/webhooks/',
    '/api/auth/',
    '/api/uploadthing',
    '/api/socket/',
  ];

  const pathname = request.nextUrl.pathname;
  return !skipCSRFPaths.some(path => pathname.startsWith(path));
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

export default {
  generateCSRFToken,
  validateCSRFToken,
  getCSRFTokenForUser,
  csrfProtection,
  needsCSRFProtection,
  strictCSRFValidation,
  getCSRFStats,
};
