import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prismadb';

export async function POST(request: NextRequest) {
	try {
		// Find the tafreed47@gmail.com profiles for testing
		const profiles = await prisma.profile.findMany({
			where: { email: 'tafreed47@gmail.com' },
			orderBy: { createdAt: 'asc' }
		});

		if (profiles.length < 2) {
			return NextResponse.json({
				error: 'Need at least 2 profiles with same email to test sync',
				found: profiles.length
			}, { status: 400 });
		}

		// Set the first profile to FREE for testing
		const testProfile = await prisma.profile.update({
			where: { id: profiles[0].id },
			data: {
				subscriptionStatus: 'FREE',
				subscriptionStart: null,
				subscriptionEnd: null,
				stripeCustomerId: null,
				stripeSessionId: null,
			}
		});

		console.log(`🧪 [Test Setup] Set profile ${testProfile.id} (${testProfile.userId}) to FREE status for testing`);

		return NextResponse.json({
			success: true,
			message: 'Test scenario created',
			email: 'tafreed47@gmail.com',
			testProfile: {
				id: testProfile.id,
				userId: testProfile.userId,
				status: testProfile.subscriptionStatus
			},
			remainingActiveProfiles: profiles.length - 1,
			instruction: 'Now test login sync with POST /api/test-login-sync'
		});

	} catch (error) {
		console.error('❌ Error setting up login sync test:', error);
		
		// ✅ SECURITY: Generic error response - no internal details exposed
		return NextResponse.json({ 
			success: false,
			message: 'Setup operation failed. Please try again later.'
		}, { status: 500 });
	}
}

export async function GET(request: NextRequest) {
	return NextResponse.json({
		message: 'Login Sync Test Setup',
		usage: 'POST to this endpoint to create a test scenario with mixed profile statuses',
		description: 'Sets one profile to FREE status so you can test login sync functionality'
	});
} 