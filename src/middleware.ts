import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// ✅ DEBUG: Log environment variable status at module load time
console.log('🔍 [MIDDLEWARE] Environment check at load time:', {
  nodeEnv: process.env.NODE_ENV,
  hasClerkSecret: !!process.env.CLERK_SECRET_KEY,
  hasClerkPublishable: !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  secretKeyPrefix: process.env.CLERK_SECRET_KEY?.substring(0, 8) || 'NOT_FOUND',
  timestamp: new Date().toISOString(),
});

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

// protect all routes except the public ones
export default clerkMiddleware(
  (auth, request) => {
    if (!isPublicRoute(request)) {
      console.log(request);
      auth().protect();
    }
  },
  { debug: true }
);

export const config = {
  matcher: ['/((?!.*\\..*|_next|ws).*)', '/', '/(api|trpc)(.*)'],
};
