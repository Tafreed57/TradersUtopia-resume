import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { createNotification } from '@/lib/notifications';

export async function POST(request: NextRequest) {
  try {
    // Authentication check
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Create a test notification (this will trigger email + push if enabled)
    const notification = await createNotification({
      userId: user.id,
      type: 'SYSTEM',
      title: 'Email Test Notification',
      message: 'This is a test email notification to verify your email configuration is working properly. If you received this email, everything is set up correctly!',
      actionUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`
    });

    if (notification) {
      return NextResponse.json({
        success: true,
        message: 'Test email sent! Check your inbox.',
        notificationId: notification.id
      });
    } else {
      return NextResponse.json({
        error: 'Failed to create test notification'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('❌ [TEST-EMAIL] Error:', error);
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 });
  }
} 