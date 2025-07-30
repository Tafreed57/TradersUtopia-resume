import {
  clerkMiddleware,
  ClerkMiddlewareOptions,
  createRouteMatcher,
} from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/terms',
  '/privacy',
  '/api/webhooks/stripe',
  '/api/health',
  '/pricing',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/forgot-password',
  '/2fa-verify',
  '/api/uploadthing',
  '/api/health', // Health check endpoint for monitoring
  '/api/debug-runtime-env', // TEMPORARY: For debugging production environment issues
  '/api/user/validate-email', // Email validation for forgot password flow
  '/api/timer', // Public timer endpoint for countdown display
  '/api/track-record', // Public track record endpoint for displaying trading results

  '/api/webhooks(.*)',
  '/api/sync-profiles',
  '/api/verify-stripe-payment',
  '/api/2fa/verify-login',
  '/api/2fa/status',
  '/api/auth/signout',
  '/api/user/validate-email',
  '/api/get-participant-token',
]);

// Helper function to get the current domain based on environment
function getCurrentDomain() {
  // Check for production domain first (main/master branch)
  if (
    process.env.NODE_ENV === 'production' &&
    (!process.env.AWS_BRANCH ||
      process.env.AWS_BRANCH === 'main' ||
      process.env.AWS_BRANCH === 'master')
  ) {
    return 'https://tradersutopia.com';
  }

  // AWS Amplify automatically sets these environment variables for all branches
  if (process.env.AWS_APP_ID && process.env.AWS_BRANCH) {
    // Amplify URLs follow the pattern: https://branch.appid.amplifyapp.com
    return `https://${process.env.AWS_BRANCH}.${process.env.AWS_APP_ID}.amplifyapp.com`;
  }

  // Fallback to localhost for local development (when AWS vars are not present)
  return 'http://localhost:3000';
}

const middlewareOptions: ClerkMiddlewareOptions = {
  authorizedParties: [getCurrentDomain()],
  contentSecurityPolicy: {
    directives: {
      'frame-src': [
        "'self'",
        'https://challenges.cloudflare.com',
        'https://*.js.stripe.com',
        'https://js.stripe.com',
        'https://hooks.stripe.com',
        'https://www.youtube.com',
        'https://www.youtube-nocookie.com',
        'https://*.youtube.com',
        'https://youtube.com',
      ],
      'script-src': [
        "'self'",
        "'unsafe-inline'",
        "'unsafe-eval'",
        'https://r.wdfl.co',
        'https://*.getrewardful.com',
      ],
      'connect-src': [
        "'self'",
        'https://api.getrewardful.com',
        'https://*.getrewardful.com',
      ],
    },
  },
};

export default clerkMiddleware(async (auth, req: NextRequest) => {
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }
  const { userId } = await auth();
  if (!userId) {
    const currentDomain = getCurrentDomain();
    const signInUrl = new URL('/sign-in', currentDomain);
    console.log('signInUrl', signInUrl);
    console.log('req.nextUrl', req.nextUrl);
    console.log('currentDomain', currentDomain);

    // Use only the pathname and search params, not the full URL with host
    const redirectPath = req.nextUrl.pathname + req.nextUrl.search;
    signInUrl.searchParams.set('redirect_url', redirectPath);

    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}, middlewareOptions);

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
};
