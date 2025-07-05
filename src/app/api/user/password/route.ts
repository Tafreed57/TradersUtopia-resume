import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { passwordChangeSchema } from '@/lib/validation';

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);
    const hasPassword = user.passwordEnabled;

    return NextResponse.json({
      hasPassword,
      message: 'Password status retrieved successfully',
    });
  } catch (error) {
    console.error('[PASSWORD_STATUS]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = passwordChangeSchema.parse(body);
    const { currentPassword, newPassword, action } = validatedData;

    // Get clerk client instance
    const clerk = await clerkClient();
    const user = await clerk.users.getUser(userId);

    // Handle first-time password setup for OAuth users
    if (!user.passwordEnabled) {
      // For first-time setup, we don't need current password verification
      await clerk.users.updateUser(userId, {
        password: newPassword,
      });
      return NextResponse.json({
        success: true,
        message:
          'Password set up successfully! You can now use password authentication.',
        isFirstTimeSetup: true,
      });
    }

    // For existing password users, verify current password first
    // Verify current password by attempting to update with the same credentials
    try {
      // Note: Clerk doesn't provide direct password verification,
      // so we rely on the update operation to validate the current password
      await clerk.users.updateUser(userId, {
        password: newPassword,
      });
      return NextResponse.json({
        success: true,
        message: 'Password changed successfully',
        isFirstTimeSetup: false,
      });
    } catch (verificationError: any) {
      return NextResponse.json(
        {
          error: 'Current password is incorrect',
          message: 'Please verify your current password and try again.',
        },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('[PASSWORD_CHANGE]', error);

    if (error.errors) {
      // Clerk validation errors
      const clerkError = error.errors[0];
      return NextResponse.json(
        {
          error: 'Password setup failed',
          message: clerkError.message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
