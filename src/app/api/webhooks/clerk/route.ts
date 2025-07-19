import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  console.log('clerk webhook received');
  return NextResponse.json({ message: 'Clerk webhook received' });
}
