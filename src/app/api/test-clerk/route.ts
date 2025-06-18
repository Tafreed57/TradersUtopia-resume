import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const hasPublishableKey = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const hasSecretKey = !!process.env.CLERK_SECRET_KEY;
  
  return NextResponse.json({
    hasPublishableKey,
    hasSecretKey,
    publishableKeyPreview: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY 
      ? `${process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.substring(0, 20)}...` 
      : "Not found",
    message: hasPublishableKey && hasSecretKey 
      ? "Clerk keys are configured" 
      : "Missing Clerk environment variables"
  });
} 