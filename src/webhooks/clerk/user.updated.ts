import { NextResponse } from 'next/server';
import { apiLogger } from '@/lib/enhanced-logger';
import { UserService } from '@/services/database/user-service';

export async function handleUserUpdated(userData: any) {
  const userService = new UserService();

  try {
    const {
      id: userId,
      email_addresses,
      first_name,
      last_name,
      image_url,
    } = userData;
    const primaryEmail = email_addresses?.find(
      (email: any) => email.id === userData.primary_email_address_id
    )?.email_address;

    if (!primaryEmail) {
      apiLogger.webhookEvent('Clerk', 'user_update_no_email', { userId });
      return NextResponse.json({ error: 'No primary email' }, { status: 400 });
    }

    apiLogger.webhookEvent('Clerk', 'user_updated', {
      userEmail: primaryEmail,
      userId,
    });

    // Find the existing user
    const existingUser = await userService.findByUserIdOrEmail(userId);

    if (!existingUser) {
      apiLogger.databaseOperation('user_update_not_found', false, {
        userEmail: primaryEmail,
        userId,
      });
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Update the user profile
    const updatedUser = await userService.updateUser(existingUser.id, {
      name: `${first_name || ''} ${last_name || ''}`.trim(),
      email: primaryEmail,
      imageUrl: image_url || '',
    });

    apiLogger.databaseOperation('user_update_success', true, {
      userEmail: primaryEmail,
      userId: updatedUser.id,
    });

    return NextResponse.json({
      message: 'User updated successfully',
      userId: updatedUser.id,
    });
  } catch (error) {
    apiLogger.databaseOperation('user_update_error', false, {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: 'Failed to update user profile' },
      { status: 500 }
    );
  }
}
