import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Standard public routes
const publicRoutes = createRouteMatcher([
  '/',
  '/pricing',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/2fa-verify',
  '/api/uploadthing',
  '/api/health',
  '/api/debug-runtime-env', // Temporary for debugging
  '/api/webhooks(.*)',
  '/api/sync-profiles',
  '/api/verify-stripe-payment',
  '/api/2fa/verify-login',
  '/api/2fa/status',
  '/api/auth/signout',
  '/api/csrf-token',
]);

// ✅ STANDARD CLERK CONFIGURATION: Let Clerk handle everything automatically
export default clerkMiddleware((auth, request) => {
  // Simple protection without custom configuration
  if (!publicRoutes(request)) {
    auth().protect();
  }
});

export const config = {
  matcher: ['/((?!.*\\..*|_next|ws).*)', '/', '/(api|trpc)(.*)'],
};

// To use this standard configuration:
// 1. Rename src/middleware.ts to src/middleware-debug.ts
// 2. Rename this file to src/middleware.ts
// 3. Ensure CLERK_SECRET_KEY and NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY are set in AWS Amplify
// 4. Deploy and test
