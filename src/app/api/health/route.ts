import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prismadb';

export async function GET() {
  try {
    // Check database connectivity
    await prisma.$queryRaw`SELECT 1`;

    // ✅ SECURITY: Check environment variables without exposing which ones are missing
    const requiredEnvVars = [
      'DATABASE_URL',
      'CLERK_SECRET_KEY',
      'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
    ];

    const missingEnvVars = requiredEnvVars.filter(
      envVar => !process.env[envVar]
    );

    if (missingEnvVars.length > 0) {
      // ✅ SECURITY: Don't expose which environment variables are missing
      return NextResponse.json(
        {
          status: 'error',
          message: 'Application configuration incomplete',
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: 'healthy',
      message: 'Application is running correctly',
      timestamp: new Date().toISOString(),
      // ✅ SECURITY: Only expose safe, non-sensitive information
      database: 'connected',
    });
  } catch (error) {
    // ✅ SECURITY: Don't expose error details that could reveal system information

    return NextResponse.json(
      {
        status: 'error',
        message: 'Health check failed',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
