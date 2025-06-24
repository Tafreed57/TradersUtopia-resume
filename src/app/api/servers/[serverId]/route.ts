import { prisma } from "@/lib/prismadb";
import { getCurrentProfile } from "@/lib/query";
import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { revalidatePath } from "next/cache";
import { rateLimitServer, trackSuspiciousActivity } from '@/lib/rate-limit';
import { validateInput, serverUpdateSchema, uuidSchema } from '@/lib/validation';

export async function PATCH(req: NextRequest, { params }: { params: { serverId: string } }) {
	try {
		// ✅ SECURITY: Rate limiting for server operations
		const rateLimitResult = await rateLimitServer()(req);
		if (!rateLimitResult.success) {
			trackSuspiciousActivity(req, 'SERVER_UPDATE_RATE_LIMIT_EXCEEDED');
			return rateLimitResult.error;
		}

		// ✅ SECURITY: Validate server ID parameter
		try {
			uuidSchema.parse(params.serverId);
		} catch (error) {
			trackSuspiciousActivity(req, 'INVALID_SERVER_ID_FORMAT');
			return NextResponse.json({ error: 'Invalid server ID format' }, { status: 400 });
		}

		const profile = await getCurrentProfile();
		if (!profile) {
			trackSuspiciousActivity(req, 'UNAUTHENTICATED_SERVER_UPDATE');
			return new NextResponse("Unauthorized", { status: 401 });
		}
		if (!params.serverId) {
			return new NextResponse("Server not found", { status: 404 });
		}

		// ✅ SECURITY: Input validation for server update
		const validationResult = await validateInput(serverUpdateSchema)(req);
		if (!validationResult.success) {
			trackSuspiciousActivity(req, 'INVALID_SERVER_UPDATE_INPUT');
			return validationResult.error;
		}

		const { name, imageUrl } = validationResult.data;

		const server = await prisma.server.update({
			where: {
				id: params.serverId,
				profileId: profile.id,
			},
			data: {
				inviteCode: uuidv4(),
				name,
				imageUrl,
			},
		});

		// ✅ SECURITY: Log successful server update
		console.log(`🏰 [SERVER] Server updated successfully by user: ${profile.email} (${profile.id})`);
		console.log(`📝 [SERVER] Server name: "${name}", ID: ${params.serverId}`);
		console.log(`📍 [SERVER] IP: ${req.headers.get('x-forwarded-for') || 'unknown'}`);

		return NextResponse.json(server);
	} catch (error: any) {
		console.error("❌ [SERVER] Server update error:", error);
		trackSuspiciousActivity(req, 'SERVER_UPDATE_ERROR');
		
		// ✅ SECURITY: Generic error response - no internal details exposed
		return NextResponse.json({ 
			error: 'Server update failed',
			message: 'Unable to update server. Please try again later.'
		}, { status: 500 });
	}
}

export async function DELETE(req: NextRequest, { params }: { params: { serverId: string } }) {
	try {
		// ✅ SECURITY: Rate limiting for server operations
		const rateLimitResult = await rateLimitServer()(req);
		if (!rateLimitResult.success) {
			trackSuspiciousActivity(req, 'SERVER_DELETE_RATE_LIMIT_EXCEEDED');
			return rateLimitResult.error;
		}

		// ✅ SECURITY: Validate server ID parameter
		try {
			uuidSchema.parse(params.serverId);
		} catch (error) {
			trackSuspiciousActivity(req, 'INVALID_SERVER_ID_FORMAT_DELETE');
			return NextResponse.json({ error: 'Invalid server ID format' }, { status: 400 });
		}

		const profile = await getCurrentProfile();
		if (!profile) {
			trackSuspiciousActivity(req, 'UNAUTHENTICATED_SERVER_DELETE');
			return new NextResponse("Unauthorized", { status: 401 });
		}
		if (!params.serverId) {
			return new NextResponse("Server not found", { status: 404 });
		}

		const server = await prisma.server.delete({
			where: {
				id: params.serverId,
				profileId: profile.id,
			},
		});

		// ✅ SECURITY: Log successful server deletion
		console.log(`🗑️ [SERVER] Server deleted successfully by user: ${profile.email} (${profile.id})`);
		console.log(`📝 [SERVER] Deleted server ID: ${params.serverId}`);
		console.log(`📍 [SERVER] IP: ${req.headers.get('x-forwarded-for') || 'unknown'}`);

		revalidatePath("/(main)","layout");
		return NextResponse.json(server);
	} catch (error: any) {
		console.error("❌ [SERVER] Server deletion error:", error);
		trackSuspiciousActivity(req, 'SERVER_DELETE_ERROR');
		
		// ✅ SECURITY: Generic error response - no internal details exposed
		return NextResponse.json({ 
			error: 'Server deletion failed',
			message: 'Unable to delete server. Please try again later.'
		}, { status: 500 });
	}
}
