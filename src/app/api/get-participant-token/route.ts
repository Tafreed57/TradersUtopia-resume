import { AccessToken } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimitMedia, trackSuspiciousActivity } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // ✅ SECURITY: Rate limiting for media token generation
    const rateLimitResult = await rateLimitMedia()(req);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(req, 'MEDIA_TOKEN_RATE_LIMIT_EXCEEDED');
      return rateLimitResult.error;
    }

    const room = req.nextUrl.searchParams.get('room');
    const username = req.nextUrl.searchParams.get('username');
    if (!room) {
      trackSuspiciousActivity(req, 'MEDIA_TOKEN_MISSING_ROOM');
      return NextResponse.json(
        { error: 'Missing "room" query parameter' },
        { status: 400 }
      );
    } else if (!username) {
      trackSuspiciousActivity(req, 'MEDIA_TOKEN_MISSING_USERNAME');
      return NextResponse.json(
        { error: 'Missing "username" query parameter' },
        { status: 400 }
      );
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

    if (!apiKey || !apiSecret || !wsUrl) {
      trackSuspiciousActivity(req, 'MEDIA_TOKEN_SERVER_MISCONFIGURED');
      return NextResponse.json(
        { error: 'Server misconfigured' },
        { status: 500 }
      );
    }

    const at = new AccessToken(apiKey, apiSecret, { identity: username });
    at.addGrant({ room, roomJoin: true, canPublish: true, canSubscribe: true });

    // ✅ SECURITY: Log successful token generation
    console.log(
      `🎥 [MEDIA] Token generated for user: "${username}" in room: "${room}"`
    );
    console.log(
      `📍 [MEDIA] IP: ${req.headers.get('x-forwarded-for') || 'unknown'}`
    );

    return NextResponse.json({ token: await at.toJwt() });
  } catch (error) {
    console.error('❌ [MEDIA] Token generation error:', error);
    trackSuspiciousActivity(req, 'MEDIA_TOKEN_GENERATION_ERROR');
    return NextResponse.json(
      { error: 'Failed to generate token' },
      { status: 500 }
    );
  }
}
