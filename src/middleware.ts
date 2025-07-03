import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// ✅ PERFORMANCE: Only log environment status once on startup, not on every request
if (process.env.NODE_ENV === 'development') {
  console.log('🔍 [MIDDLEWARE] Environment loaded:', {
    hasClerkSecret: !!process.env.CLERK_SECRET_KEY,
    hasClerkPublishable: !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    hasDatabase: !!process.env.DATABASE_URL,
  });
}

// ✅ WORKAROUND: Check for alternative environment variable names
const clerkSecretKey =
  process.env.CLERK_SECRET_KEY ||
  process.env.CLERK_SECRET ||
  process.env.NEXT_CLERK_SECRET_KEY;

if (!clerkSecretKey) {
  console.error(
    '❌ [MIDDLEWARE] CLERK_SECRET_KEY not found in environment variables'
  );
  console.log(
    '🔍 [MIDDLEWARE] Available CLERK-related env vars:',
    Object.keys(process.env).filter(key => key.includes('CLERK'))
  );
}

// Debug/test routes that should only be accessible in development
const developmentOnlyRoutes = [
  '/api/test-env', // Environment variables check
  '/api/test-clerk', // Clerk configuration test
  '/api/debug-emails', // Email debugging for Stripe sync
  '/api/debug-stripe', // Stripe data debugging
  '/api/test-login-sync', // Login sync testing
  '/api/setup-login-sync-test', // Database test setup
  '/api/check-payment-status', // Payment status debugging
  '/api/upload-security', // File upload security monitoring
  '/api/test-2fa-status', // 2FA status debugging
  '/api/debug-runtime-env', // Runtime environment debugging
];

// Always public routes (regardless of environment)
const alwaysPublicRoutes = [
  '/',
  '/pricing',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/forgot-password',
  '/2fa-verify',
  '/api/uploadthing',
  '/api/health', // Health check endpoint for monitoring
  '/api/debug-runtime-env', // TEMPORARY: For debugging production environment issues

  '/api/webhooks(.*)',
  '/api/sync-profiles',
  '/api/verify-stripe-payment',
  '/api/2fa/verify-login',
  '/api/2fa/status',
  '/api/auth/signout',
  '/api/csrf-token',
];

// Combine routes based on environment
const publicRoutes =
  process.env.NODE_ENV === 'development'
    ? [...alwaysPublicRoutes, ...developmentOnlyRoutes] // Dev: Include debug routes
    : alwaysPublicRoutes; // Prod: Exclude debug routes

const isPublicRoute = createRouteMatcher(publicRoutes);

// ✅ FORCE ENVIRONMENT VARIABLE: Set it explicitly if found
const finalSecretKey =
  clerkSecretKey ||
  process.env.CLERK_SECRET_KEY ||
  process.env.CLERK_SECRET ||
  process.env.NEXT_CLERK_SECRET_KEY;

if (finalSecretKey) {
  // Force set the environment variable that Clerk expects
  // process.env.CLERK_SECRET_KEY = finalSecretKey;
  if (process.env.NODE_ENV === 'development') {
    console.log('✅ [MIDDLEWARE] Clerk configured');
  }
} else {
  console.error(
    '❌ [MIDDLEWARE] No Clerk secret key found in any environment variable'
  );
}

// protect all routes except the public ones
export default clerkMiddleware(
  (auth, request) => {
    const isPublic = isPublicRoute(request);

    if (!isPublic) {
      auth().protect();
    }
  },
  {
    debug: false,
  }
);

export const config = {
  matcher: ['/((?!.*\\..*|_next|ws).*)', '/', '/(api|trpc)(.*)'],
};
