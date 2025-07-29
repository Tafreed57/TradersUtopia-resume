import { UserJSON } from '@clerk/nextjs/server';
import {
  ClerkWebhookEvent,
  handleUserCreated,
} from '@/webhooks/clerk/user.created';
import { handleUserUpdated } from '@/webhooks/clerk/user.updated';
import { handleUserDeleted } from '@/webhooks/clerk/user.deleted';
import { verifyWebhook } from '@clerk/nextjs/webhooks';
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  const evt = await verifyWebhook(req);

  // Handle the webhook
  const { type } = evt;

  try {
    switch (type) {
      case 'user.created':
        return await handleUserCreated(evt.data);
      case 'user.updated':
        return await handleUserUpdated(evt.data as UserJSON);
      case 'user.deleted':
        return await handleUserDeleted(evt.data as any);
      default:
        return new Response('Unhandled event type', { status: 200 });
    }
  } catch (error) {
    return new Response('Internal server error', { status: 500 });
  }
}
