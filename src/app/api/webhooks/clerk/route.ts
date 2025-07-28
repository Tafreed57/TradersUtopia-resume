import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { verifyWebhook } from '@clerk/nextjs/webhooks';
import { apiLogger } from '@/lib/enhanced-logger';
import { handleUserCreated, handleUserUpdated } from '@/webhooks/clerk';

export async function POST(request: NextRequest) {
  try {
    const evt = await verifyWebhook(request);
    const { type, data } = evt;

    apiLogger.webhookEvent('Clerk', 'received_webhook', {
      eventType: type,
    });

    switch (type) {
      case 'user.created':
        return await handleUserCreated(data);
      case 'user.updated':
        return await handleUserUpdated(data);
      default:
        apiLogger.webhookEvent('Clerk', 'unhandled_event', { eventType: type });
        return NextResponse.json({ received: true, status: 200 });
    }
  } catch (error) {
    apiLogger.webhookEvent('Clerk', 'processing_error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
