import { NextRequest, NextResponse } from 'next/server';
import { getCurrentProfileForAuth } from '@/lib/query';
import { getUnreadNotifications } from '@/lib/notifications';
import { prisma } from '@/lib/prismadb';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [DEBUG] Starting user mismatch investigation...');

    // Get current authenticated user
    const currentUser = await getCurrentProfileForAuth();
    if (!currentUser) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    console.log('🔍 [DEBUG] Current API user:', {
      userId: currentUser.userId,
      email: currentUser.email,
      profileId: currentUser.id,
    });

    // Get notifications using the API method
    const apiNotifications = await getUnreadNotifications(currentUser.id);
    console.log('🔍 [DEBUG] API notifications count:', apiNotifications.length);

    // Get notifications directly from database using userId
    const directUserIdNotifications = await prisma.notification.findMany({
      where: {
        userId: currentUser.userId, // Using Clerk userId
        read: false,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    console.log(
      '🔍 [DEBUG] Direct userId notifications count:',
      directUserIdNotifications.length
    );

    // Get notifications directly from database using profile.id
    const directProfileIdNotifications = await prisma.notification.findMany({
      where: {
        userId: currentUser.id, // Using Prisma profile id
        read: false,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    console.log(
      '🔍 [DEBUG] Direct profileId notifications count:',
      directProfileIdNotifications.length
    );

    // Get ALL notifications to see what user IDs exist
    const allNotifications = await prisma.notification.findMany({
      select: {
        userId: true,
        type: true,
        title: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    console.log('🔍 [DEBUG] All notifications (recent 20):', allNotifications);

    return NextResponse.json({
      currentUser: {
        userId: currentUser.userId,
        email: currentUser.email,
        profileId: currentUser.id,
      },
      notifications: {
        apiMethod: apiNotifications.length,
        directUserId: directUserIdNotifications.length,
        directProfileId: directProfileIdNotifications.length,
      },
      allNotificationsUserIds: [
        ...new Set(allNotifications.map(n => n.userId)),
      ],
      debugging: {
        apiNotifications: apiNotifications.map(n => ({
          id: n.id,
          title: n.title,
        })),
        directUserIdNotifications: directUserIdNotifications.map(n => ({
          id: n.id,
          title: n.title,
        })),
        directProfileIdNotifications: directProfileIdNotifications.map(n => ({
          id: n.id,
          title: n.title,
        })),
      },
    });
  } catch (error) {
    console.error('🔍 [DEBUG] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
