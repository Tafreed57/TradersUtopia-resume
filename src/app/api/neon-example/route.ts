import { neon } from '@neondatabase/serverless';
import { NextRequest, NextResponse } from 'next/server';

// Initialize Neon connection
const sql = neon(process.env.DATABASE_URL!);

export async function GET() {
  try {
    // Example 1: Get database version (simple query)
    const versionResult = await sql`SELECT version()`;

    // Example 2: Count users in the database
    const userCount = await sql`SELECT COUNT(*) as count FROM "Profile"`;

    // Example 3: Get recent servers (using your existing schema)
    const recentServers = await sql`
      SELECT 
        s.id,
        s.name,
        s."imageUrl",
        s."inviteCode",
        s."createdAt",
        p.name as owner_name
      FROM "Server" s
      JOIN "Profile" p ON s."profileId" = p.id
      ORDER BY s."createdAt" DESC
      LIMIT 5
    `;

    return NextResponse.json({
      success: true,
      data: {
        database_version: versionResult[0]?.version,
        user_count: userCount[0]?.count,
        recent_servers: recentServers,
        environment: {
          branch: process.env.AWS_BRANCH || 'local',
          database_url_configured: !!process.env.DATABASE_URL,
        },
      },
    });
  } catch (error) {
    console.error('Neon database error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Database connection failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'create_test_profile') {
      // Example: Create a test profile using Neon
      const { name, email } = body;

      if (!name || !email) {
        return NextResponse.json(
          {
            success: false,
            error: 'Name and email are required',
          },
          { status: 400 }
        );
      }

      // Check if profile already exists
      const existingProfile = await sql`
        SELECT id FROM "Profile" 
        WHERE email = ${email}
        LIMIT 1
      `;

      if (existingProfile.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: 'Profile with this email already exists',
          },
          { status: 409 }
        );
      }

      // Create new profile - fix the template literal syntax
      const testUserId = `test_${Date.now()}`;
      const newProfile = await sql`
        INSERT INTO "Profile" (
          "userId", 
          name, 
          email, 
          "subscriptionStatus",
          "twoFactorEnabled",
          "isAdmin"
        )
        VALUES (
          ${testUserId}, 
          ${name}, 
          ${email}, 
          'FREE',
          false,
          false
        )
        RETURNING id, name, email, "createdAt"
      `;

      return NextResponse.json({
        success: true,
        message: 'Test profile created successfully',
        data: newProfile[0],
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Invalid action',
      },
      { status: 400 }
    );
  } catch (error) {
    console.error('Neon database error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Database operation failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
