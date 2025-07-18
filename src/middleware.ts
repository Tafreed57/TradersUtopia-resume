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

  '/api/webhooks(.*)',
  '/api/sync-profiles',
  '/api/verify-stripe-payment',
  '/api/2fa/verify-login',
  '/api/2fa/status',
  '/api/auth/signout',
  '/api/csrf-token',
  '/api/user/validate-email',
  '/api/auth/signout',
  '/api/get-participant-token',
]);

const middlewareOptions: ClerkMiddlewareOptions = {
  authorizedParties: [
    process.env.NODE_ENV === 'production'
      ? 'https://tradersutopia.com'
      : 'http://localhost:3000',
  ],
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
    const signInUrl = new URL('/sign-in', req.url);
    signInUrl.searchParams.set('redirect_url', req.url);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}, middlewareOptions);

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
};
