import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { rateLimitAdmin, trackSuspiciousActivity } from '@/lib/rate-limit';
import { secureTextInput } from '@/lib/validation';
import { z } from 'zod';

// Specific validation for grant access endpoint
const grantAccessSchema = z.object({
  reason: z.string().max(500, 'Reason too long').optional()
});

export async function POST(request: NextRequest) {
  try {
    // ✅ SECURITY: Rate limiting for admin operations
    const rateLimitResult = await rateLimitAdmin()(request);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(request, 'ADMIN_RATE_LIMIT_EXCEEDED');
      return rateLimitResult.error;
    }

    // ✅ SECURITY: Authentication check
    const user = await currentUser();
    if (!user) {
      trackSuspiciousActivity(request, 'UNAUTHENTICATED_ADMIN_ACCESS');
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // ⚠️ CRITICAL SECURITY FIX: Check if user is already admin or if this is initial setup
    const existingProfile = await db.profile.findFirst({
      where: { userId: user.id }
    });

    // Only allow admin grant if user is already admin OR this is the first user in the system
    const totalProfiles = await db.profile.count();
    const isFirstUser = totalProfiles === 0;
    const isExistingAdmin = existingProfile?.isAdmin === true;

    if (!isFirstUser && !isExistingAdmin) {
      trackSuspiciousActivity(request, 'UNAUTHORIZED_ADMIN_GRANT_ATTEMPT');
      console.error(`🚨 [SECURITY ALERT] Non-admin user ${user.emailAddresses[0]?.emailAddress} attempted to grant admin access`);
      return NextResponse.json({ 
        error: 'Access denied',
        message: 'Only existing administrators can grant admin access to other users'
      }, { status: 403 });
    }

    // ✅ SECURITY: Input validation
    let reason = '';
    try {
      const body = await request.json();
      const validated = grantAccessSchema.parse(body);
      reason = validated.reason || '';
    } catch (error) {
      // If no JSON body or invalid, continue with empty reason
      reason = '';
    }

    // ✅ SECURITY: Sanitize text inputs
    const sanitizedReason = reason ? secureTextInput(reason) : null;
    if (sanitizedReason?.threats.length) {
      console.warn(`🚨 [SECURITY] Admin operation blocked - threats detected: ${sanitizedReason.threats.join(', ')}`);
      trackSuspiciousActivity(request, `ADMIN_INPUT_THREATS_${sanitizedReason.threats.join('_')}`);
      return NextResponse.json({ 
        error: 'Invalid input detected',
        message: 'Potentially malicious content in request data'
      }, { status: 400 });
    }

    // Find or create the user's profile
    let profile = existingProfile;

    if (!profile) {
      const userEmail = user.emailAddresses[0]?.emailAddress;
      if (!userEmail) {
        return NextResponse.json({ error: 'No email found' }, { status: 400 });
      }

      profile = await db.profile.create({
        data: {
          userId: user.id,
          name: `${user.firstName} ${user.lastName}`,
          email: userEmail,
          imageUrl: user.imageUrl,
          isAdmin: isFirstUser, // Only grant admin to first user automatically
        }
      });

      if (isFirstUser) {
        console.log(`🎉 [SETUP] First user registered as admin: ${userEmail}`);
      }
    } else {
      // Update existing profile to grant admin access (only if authorized)
      profile = await db.profile.update({
        where: { id: profile.id },
        data: {
          isAdmin: true,
        }
      });
    }

    // ✅ SECURITY: Log admin access grant with details
    console.log(`🔑 [ADMIN] Access granted to user: ${profile.email} (${user.id})`);
    console.log(`📝 [ADMIN] Reason: ${sanitizedReason?.clean || 'No reason provided'}`);
    console.log(`📍 [ADMIN] IP: ${request.headers.get('x-forwarded-for') || 'unknown'}`);
    console.log(`🖥️ [ADMIN] User Agent: ${request.headers.get('user-agent')?.slice(0, 100) || 'unknown'}`);
    console.log(`👑 [ADMIN] ${isFirstUser ? 'Initial setup' : 'Granted by existing admin'}: ${existingProfile?.email || 'system'}`);

    return NextResponse.json({
      success: true,
      message: isFirstUser 
        ? 'Welcome! You are the first user and have been granted admin access.' 
        : 'Admin access granted successfully!',
      profile: {
        id: profile.id,
        isAdmin: profile.isAdmin,
        email: profile.email
      }
    });

  } catch (error) {
    console.error('❌ [ADMIN] Error granting admin access:', error);
    trackSuspiciousActivity(request, 'ADMIN_GRANT_ERROR');
    
    // ✅ SECURITY: Don't expose detailed error information
    return NextResponse.json({ 
      error: 'Failed to grant admin access',
      message: 'An internal error occurred. Please try again later.'
    }, { status: 500 });
  }
} 