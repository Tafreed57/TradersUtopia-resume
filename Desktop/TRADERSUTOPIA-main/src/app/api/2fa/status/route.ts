import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

// Circuit breaker and rate limiting - more lenient after fixing infinite loops
const userRequestCounts = new Map<string, { count: number; firstRequest: number; lastResult?: any }>();
const MAX_REQUESTS_PER_MINUTE = 15; // Increased from 10 to 15
const CIRCUIT_BREAKER_THRESHOLD = 50; // Increased from 20 to 50
const CACHE_DURATION = 2000; // Reduced from 5s to 2s for better responsiveness

let totalRequestCount = 0;
let circuitBreakerResetTime = 0;

function resetCircuitBreaker() {
  totalRequestCount = 0;
  circuitBreakerResetTime = Date.now() + 60000; // Reset after 1 minute
  console.log('🔴 [2FA-STATUS] Circuit breaker activated - cooling down for 1 minute');
}

function isCircuitBreakerOpen(): boolean {
  if (Date.now() < circuitBreakerResetTime) {
    return true;
  }
  
  if (totalRequestCount > CIRCUIT_BREAKER_THRESHOLD) {
    resetCircuitBreaker();
    return true;
  }
  
  return false;
}

function isRateLimited(userId: string): { limited: boolean; cachedResult?: any } {
  const now = Date.now();
  const userKey = userId;
  const userData = userRequestCounts.get(userKey);
  
  if (!userData) {
    userRequestCounts.set(userKey, { count: 1, firstRequest: now });
    return { limited: false };
  }
  
  // Reset count if more than 1 minute has passed
  if (now - userData.firstRequest > 60000) {
    userRequestCounts.set(userKey, { count: 1, firstRequest: now });
    return { limited: false };
  }
  
  // Check if we have a cached result within the cache duration
  if (userData.lastResult && now - userData.firstRequest < CACHE_DURATION) {
    console.log('📦 [2FA-STATUS] Returning cached result for user:', userId);
    return { limited: false, cachedResult: userData.lastResult };
  }
  
  // Increment count
  userData.count++;
  
  // Check rate limit
  if (userData.count > MAX_REQUESTS_PER_MINUTE) {
    console.warn('🚨 [2FA-STATUS] Rate limit exceeded for user:', userId, 'count:', userData.count);
    return { limited: true };
  }
  
  return { limited: false };
}

function cacheResult(userId: string, result: any) {
  const userData = userRequestCounts.get(userId);
  if (userData) {
    userData.lastResult = result;
  }
}

export async function GET(request: NextRequest) {
  try {
    // Increment total request count
    totalRequestCount++;

    // Check circuit breaker
    if (isCircuitBreakerOpen()) {
      console.log('🔴 [2FA-STATUS] Circuit breaker open - rejecting request');
      return NextResponse.json({ 
        authenticated: false,
        requires2FA: false,
        verified: false,
        error: 'Service temporarily unavailable - too many requests'
      }, { status: 503 });
    }

    const user = await currentUser();
    console.log('🔍 [2FA-STATUS] Checking 2FA status for user:', user?.id || 'none');

    if (!user) {
      console.log('❌ [2FA-STATUS] No authenticated user');
      return NextResponse.json({ 
        authenticated: false,
        requires2FA: false,
        verified: false 
      });
    }

    // Check rate limiting and caching
    const rateLimitCheck = isRateLimited(user.id);
    if (rateLimitCheck.limited) {
      return NextResponse.json({ 
        authenticated: false,
        requires2FA: false,
        verified: false,
        error: 'Rate limit exceeded'
      }, { status: 429 });
    }

    // Return cached result if available
    if (rateLimitCheck.cachedResult) {
      return NextResponse.json(rateLimitCheck.cachedResult);
    }

    // Check if user has 2FA enabled by directly querying the database
    const profile = await db.profile.findUnique({
      where: {
        userId: user.id,
      },
      select: {
        twoFactorEnabled: true,
        email: true,
      },
    });

    if (!profile) {
      console.log('❌ [2FA-STATUS] Profile not found for user:', user.id);
      const result = { 
        authenticated: true,
        requires2FA: false,
        verified: true,
        error: 'Profile not found'
      };
      cacheResult(user.id, result);
      return NextResponse.json(result);
    }
    
    console.log('👤 [2FA-STATUS] Profile found - 2FA enabled:', profile.twoFactorEnabled, 'for user:', profile.email);
    
    if (!profile.twoFactorEnabled) {
      console.log('ℹ️ [2FA-STATUS] 2FA not enabled, allowing access');
      const result = { 
        authenticated: true,
        requires2FA: false,
        verified: true 
      };
      cacheResult(user.id, result);
      return NextResponse.json(result);
    }

    // Check if 2FA verification cookie exists (server-side only)
    const cookieStore = cookies();
    const verificationCookie = cookieStore.get('2fa-verified');
    const isVerified = verificationCookie?.value === 'true';
    
    console.log('🍪 [2FA-STATUS] Cookie check - exists:', !!verificationCookie, 'value:', verificationCookie?.value, 'verified:', isVerified);
    console.log('📍 [2FA-STATUS] IP:', request.headers.get('x-forwarded-for') || 'unknown');

    const result = { 
      authenticated: true,
      requires2FA: true,
      verified: isVerified 
    };
    
    console.log('📊 [2FA-STATUS] Final result:', result);

    // Cache the result
    cacheResult(user.id, result);

    return NextResponse.json(result);

  } catch (error) {
    console.error("❌ [2FA-STATUS] 2FA status check error:", error);
    return NextResponse.json({ 
      authenticated: false,
      requires2FA: false,
      verified: false,
      error: 'Internal server error'
    }, { status: 500 });
  }
} 