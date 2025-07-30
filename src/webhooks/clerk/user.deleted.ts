import { NextResponse } from 'next/server';
import { UserService } from '@/services/database/user-service';

// Custom interface for the actual webhook payload structure
interface ClerkDeletedUser {
  deleted: boolean;
  id: string;
  object: string;
}

export async function handleUserDeleted(userData: ClerkDeletedUser) {
  const userService = new UserService();

  try {
    // Extract user ID from the webhook data
    const userId = userData.id;

    if (!userId) {
      return NextResponse.json(
        {
          error: 'No user ID found in webhook data',
          receivedData: userData,
        },
        { status: 400 }
      );
    }

    // Find and delete user from our database by Clerk user ID
    const existingUser = await userService.findByUserIdOrEmail(userId);

    if (existingUser) {
      try {
        await userService.deleteUser(existingUser.id);
      } catch (error) {
        console.error('Error deleting user:', error);
        return NextResponse.json(
          {
            error: 'Failed to delete user',
            details: error instanceof Error ? error.message : 'Unknown error',
            userId,
            userData,
          },
          { status: 500 }
        );
      }
      return NextResponse.json({
        user: existingUser,
        message: 'User deleted successfully',
      });
    }

    return NextResponse.json(
      {
        userId,
        message: 'User not found in database',
        note: 'User may have already been deleted or never existed in our system',
        userData,
      },
      { status: 404 }
    );
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete user',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
