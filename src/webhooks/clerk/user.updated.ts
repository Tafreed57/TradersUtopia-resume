import { NextResponse } from 'next/server';
import { UserService } from '@/services/database/user-service';
import { UserJSON } from '@clerk/nextjs/server';

export async function handleUserUpdated(userData: UserJSON) {
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
      return NextResponse.json({ error: 'No primary email' }, { status: 400 });
    }

    // Find user in our database
    const existingUser = await userService.findByUserIdOrEmail(primaryEmail);

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Update user profile
    await userService.updateUser(existingUser.id, {
      name:
        `${first_name || ''} ${last_name || ''}`.trim() || existingUser.name,
      imageUrl: image_url || existingUser.imageUrl,
    });

    return NextResponse.json({ message: 'User updated successfully' });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}
