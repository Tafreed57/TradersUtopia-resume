import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-05-28.basil',
});

export async function GET(request: NextRequest) {
  try {
    const user = await currentUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Check if user is admin (you can modify this check as needed)
    const userEmail = user.emailAddresses[0]?.emailAddress;
    const isAdmin = userEmail === 'tafreed47@gmail.com' || user.publicMetadata?.isAdmin;
    
    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Email Configuration Diagnostics
    const emailDiagnostics = {
      timestamp: new Date().toISOString(),
      
      // Clerk Configuration
      clerk: {
        hasPublishableKey: !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
        hasSecretKey: !!process.env.CLERK_SECRET_KEY,
        hasSignInUrl: !!process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL,
        hasSignUpUrl: !!process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL,
        hasAfterSignInUrl: !!process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL,
        hasAfterSignUpUrl: !!process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL,
        publishableKeyPrefix: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? 
          process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.substring(0, 15) + '...' : 'NOT_SET'
      },
      
      // Resend Configuration (for app emails)
      resend: {
        hasApiKey: !!process.env.RESEND_API_KEY,
        hasFromEmail: !!process.env.RESEND_FROM_EMAIL,
        fromEmail: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
        apiKeyPrefix: process.env.RESEND_API_KEY ? 
          're_' + process.env.RESEND_API_KEY.substring(3, 10) + '...' : 'NOT_SET'
      },
      
      // Other Email Related
      email: {
        nodeEnv: process.env.NODE_ENV,
        isDevelopment: process.env.NODE_ENV === 'development',
        isProduction: process.env.NODE_ENV === 'production'
      },

      // Recent User Details
      user: {
        id: user.id,
        email: userEmail,
        emailVerified: user.emailAddresses[0]?.verification?.status === 'verified',
        createdAt: user.createdAt,
        lastSignInAt: user.lastSignInAt
      },

      // Potential Issues & Solutions
      potentialIssues: [
        {
          issue: "Clerk in Development Mode",
          description: "Clerk's free tier has limited email delivery in development",
          solution: "Upgrade to Clerk Pro or configure a custom email provider in Clerk dashboard"
        },
        {
          issue: "Email Domain Not Verified", 
          description: "The sending domain may not be verified with Clerk's email provider",
          solution: "Verify your domain in Clerk dashboard under 'Email & SMS' settings"
        },
        {
          issue: "Emails Going to Spam",
          description: "Verification emails might be going to spam/junk folders",
          solution: "Check spam folders and whitelist Clerk's sending domains"
        },
        {
          issue: "Rate Limiting",
          description: "Too many email requests might trigger rate limiting",
          solution: "Wait and try again, or upgrade Clerk plan for higher limits"
        },
        {
          issue: "Wrong Email Configuration",
          description: "Clerk might be using wrong email settings",
          solution: "Check Clerk dashboard email configuration and test email delivery"
        }
      ],

      // Recommended Actions
      recommendedActions: [
        "1. Check Clerk Dashboard > Email & SMS settings",
        "2. Test email delivery from Clerk dashboard", 
        "3. Verify your domain with Clerk's email provider",
        "4. Check if emails are in spam/junk folders",
        "5. Consider upgrading to Clerk Pro for better email delivery",
        "6. Configure a custom email provider (SendGrid, Mailgun, etc.) in Clerk",
        "7. Test with a different email address to rule out domain issues"
      ]
    };

    console.log('📧 [EMAIL-DEBUG] Email diagnostics requested by:', userEmail);
    console.log('🔍 [EMAIL-DEBUG] Clerk Configuration:', emailDiagnostics.clerk);
    console.log('📮 [EMAIL-DEBUG] Resend Configuration:', emailDiagnostics.resend);

    return NextResponse.json({
      message: 'Email configuration diagnostics',
      diagnostics: emailDiagnostics,
      clerkDashboardUrl: 'https://dashboard.clerk.com/',
      helpUrl: 'https://clerk.com/docs/authentication/configuration/email-sms'
    });

  } catch (error) {
    console.error('❌ [EMAIL-DEBUG] Error:', error);
    return NextResponse.json({ 
      error: 'Failed to get email diagnostics',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 