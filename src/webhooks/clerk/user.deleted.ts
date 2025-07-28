import { UserService } from '@/services/database/user-service';
import { UserJSON } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

export async function handleUserDeleted(userData: UserJSON) {
  const userService = new UserService();

  try {
    await userService.deleteUser(userData.id);
    return NextResponse.json({
      received: true,
      status: 200,
      message: 'User deleted successfully',
    });
  } catch (error) {
    console.error('Failed to delete user:', error);
    return NextResponse.json({
      received: true,
      status: 500,
      error: 'Failed to delete user from database',
    });
  }
}
