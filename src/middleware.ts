import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/terms',
  '/privacy',
  '/api/webhooks/stripe',
  '/api/health',
  '/api/csrf-token',
  '/api/user/validate-email',
  '/api/auth/signout',
  '/api/get-participant-token',
  // Debug routes for development
  '/api/test-env',
  '/api/test-clerk',
  '/api/debug-emails',
  '/api/debug-stripe',
  '/api/test-login-sync',
  '/api/test-2fa-status',
]);

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
});

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
};
