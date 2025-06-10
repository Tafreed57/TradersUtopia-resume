import { NextResponse } from 'next/server';

export async function GET() {
  const hasStripeSecret = !!process.env.STRIPE_SECRET_KEY;
  const hasWebhookSecret = !!process.env.STRIPE_WEBHOOK_SECRET;
  const hasDatabaseUrl = !!process.env.DATABASE_URL;

  return NextResponse.json({
    environment_check: {
      STRIPE_SECRET_KEY: hasStripeSecret ? "✅ Present" : "❌ Missing",
      STRIPE_WEBHOOK_SECRET: hasWebhookSecret ? "✅ Present" : "❌ Missing", 
      DATABASE_URL: hasDatabaseUrl ? "✅ Present" : "❌ Missing",
    },
    stripe_key_preview: process.env.STRIPE_SECRET_KEY ? 
      `${process.env.STRIPE_SECRET_KEY.substring(0, 10)}...` : "Not found",
    webhook_secret_preview: process.env.STRIPE_WEBHOOK_SECRET ? 
      `${process.env.STRIPE_WEBHOOK_SECRET.substring(0, 10)}...` : "Not found"
  });
} 