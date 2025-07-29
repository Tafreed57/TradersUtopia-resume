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
  if (process.env.NODE_ENV === 'production') {
    return 'https://tradersutopia.com';
  }

  // For AWS Amplify environments, check for site URL first
  // if (process.env.NEXT_PUBLIC_SITE_URL) {
  //   return process.env.NEXT_PUBLIC_SITE_URL;
  // }

  // AWS Amplify automatically sets these environment variables
  if (process.env.AWS_APP_ID && process.env.AWS_BRANCH) {
    // Amplify URLs follow the pattern: https://branch.appid.amplifyapp.com
    return `https://${process.env.AWS_BRANCH}.${process.env.AWS_APP_ID}.amplifyapp.com`;
  }

  // Alternative AWS Amplify URL pattern check
  if (process.env.AMPLIFY_DIFF_DEPLOY_ROOT) {
    return process.env.AMPLIFY_DIFF_DEPLOY_ROOT;
  }

  // Fallback to localhost for development
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
