import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { db } from '@/lib/db';
import { passwordChangeSchema } from '@/lib/validation';

export async function GET(request: NextRequest) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await clerkClient.users.getUser(userId);
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
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = passwordChangeSchema.parse(body);
    const { currentPassword, newPassword } = validatedData;

    const user = await clerkClient.users.getUser(userId);

    if (!user.passwordEnabled) {
      return NextResponse.json(
        { error: 'Password authentication is not enabled for this account' },
        { status: 400 }
      );
    }

    // Update password using Clerk
    await clerkClient.users.updateUser(userId, {
      password: newPassword,
    });

    return NextResponse.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error: any) {
    console.error('[PASSWORD_CHANGE]', error);

    if (error.errors) {
      // Clerk validation errors
      const clerkError = error.errors[0];
      return NextResponse.json(
        {
          error: 'Password change failed',
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
