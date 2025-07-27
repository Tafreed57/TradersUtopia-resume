import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { apiLogger } from '@/lib/enhanced-logger';
import { handleUserCreated, handleUserUpdated } from '@/webhooks/clerk';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const headersList = headers();

    apiLogger.webhookEvent('Clerk', 'received_webhook', {
      bodyLength: body.length,
    });

    let event;
    try {
      event = JSON.parse(body);
    } catch (err) {
      apiLogger.securityViolation('CLERK_WEBHOOK_INVALID_JSON', request, {
        error: err,
      });
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const { type, data } = event;
    apiLogger.webhookEvent('Clerk', type, { eventType: type });

    switch (type) {
      case 'user.created':
        return await handleUserCreated(data);
      case 'user.updated':
        return await handleUserUpdated(data);
      default:
        apiLogger.webhookEvent('Clerk', 'unhandled_event', { eventType: type });
        return NextResponse.json({ received: true });
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
