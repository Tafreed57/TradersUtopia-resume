import { NextResponse } from 'next/server';
import { checkUserSubscription } from '@/lib/subscription';

export async function GET() {
  try {
    const subscriptionData = await checkUserSubscription();

    return NextResponse.json(subscriptionData);
  } catch (error) {
    console.error('Error checking subscription:', error);
    return NextResponse.json(
      { hasAccess: false, status: 'ERROR', canStartTrial: false },
      { status: 500 }
    );
  }
}
