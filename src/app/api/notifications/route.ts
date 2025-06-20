import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { getUnreadNotifications, markNotificationAsRead, markAllNotificationsAsRead } from '@/lib/notifications';

export async function GET(request: NextRequest) {
  try {
    const user = await currentUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const notifications = await getUnreadNotifications(user.id);

    return NextResponse.json({
      notifications,
      count: notifications.length
    });

  } catch (error) {
    console.error('Fetch notifications error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch notifications' 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await currentUser();
    const { action, notificationId } = await request.json();
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (action === 'mark_read' && notificationId) {
      const success = await markNotificationAsRead(notificationId);
      if (success) {
        return NextResponse.json({ success: true, message: 'Notification marked as read' });
      } else {
        return NextResponse.json({ error: 'Failed to mark notification as read' }, { status: 500 });
      }
    }

    if (action === 'mark_all_read') {
      const success = await markAllNotificationsAsRead(user.id);
      if (success) {
        return NextResponse.json({ success: true, message: 'All notifications marked as read' });
      } else {
        return NextResponse.json({ error: 'Failed to mark all notifications as read' }, { status: 500 });
      }
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Notification action error:', error);
    return NextResponse.json({ 
      error: 'Failed to process notification action' 
    }, { status: 500 });
  }
} 