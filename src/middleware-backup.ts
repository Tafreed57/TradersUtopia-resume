import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ✅ TEMPORARY BYPASS: For testing if environment issues are resolved
export function middleware(request: NextRequest) {
  console.log(
    '🔄 [TEMP MIDDLEWARE] Bypassing Clerk authentication for testing'
  );
  console.log('📍 [TEMP MIDDLEWARE] Route:', request.nextUrl.pathname);

  // Temporarily allow all routes without authentication
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!.*\\..*|_next|ws).*)', '/', '/(api|trpc)(.*)'],
};

// To use this temporary middleware:
// 1. Rename src/middleware.ts to src/middleware-original.ts
// 2. Rename this file to src/middleware.ts
// 3. Deploy and test
// 4. Reverse the renames when ready to re-enable authentication
