import { prisma } from "@/lib/prismadb";
import { getCurrentProfile } from "@/lib/query";
import { MemberRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { revalidatePath } from "next/cache";
import { rateLimitServer, trackSuspiciousActivity } from '@/lib/rate-limit';
import { validateInput, channelSchema, uuidSchema } from '@/lib/validation';

export async function PATCH(req: NextRequest, { params }: { params: { channelId: string } }) {
	try {
		// ✅ SECURITY: Rate limiting for channel operations
		const rateLimitResult = await rateLimitServer()(req);
		if (!rateLimitResult.success) {
			trackSuspiciousActivity(req, 'CHANNEL_UPDATE_RATE_LIMIT_EXCEEDED');
			return rateLimitResult.error;
		}

		// ✅ SECURITY: Validate channel ID parameter
		try {
			uuidSchema.parse(params.channelId);
		} catch (error) {
			trackSuspiciousActivity(req, 'INVALID_CHANNEL_ID_FORMAT');
			return NextResponse.json({ error: 'Invalid channel ID format' }, { status: 400 });
		}

		const profile = await getCurrentProfile();
		const { searchParams } = new URL(req.url);
		const serverId = searchParams.get("serverId");

		// ✅ SECURITY: Validate server ID from query params
		if (!serverId) {
			trackSuspiciousActivity(req, 'MISSING_SERVER_ID_CHANNEL_UPDATE');
			return NextResponse.json({ error: 'Server ID is required' }, { status: 400 });
		}

		try {
			uuidSchema.parse(serverId);
		} catch (error) {
			trackSuspiciousActivity(req, 'INVALID_SERVER_ID_FORMAT_CHANNEL');
			return NextResponse.json({ error: 'Invalid server ID format' }, { status: 400 });
		}

		// ✅ SECURITY: Input validation for channel update
		const validationResult = await validateInput(channelSchema)(req);
		if (!validationResult.success) {
			trackSuspiciousActivity(req, 'INVALID_CHANNEL_UPDATE_INPUT');
			return validationResult.error;
		}

        const { name, type } = validationResult.data;

		if (!profile) {
			trackSuspiciousActivity(req, 'UNAUTHENTICATED_CHANNEL_UPDATE');
			return new NextResponse("Unauthorized", { status: 401 });
		}
		if (!params.channelId) {
			trackSuspiciousActivity(req, 'MISSING_CHANNEL_ID');
			return new NextResponse("Channel not found", { status: 404 });
		}


		const server = await prisma.server.update({
			where: {
				id: serverId,
				members: {
					some: {
						profileId: profile.id,
						role: {
							in: [MemberRole.ADMIN, MemberRole.MODERATOR],
						},
					},
				},
			},
			data: {
				channels: {
					update: {
						where: {
                            id: params.channelId,
                            NOT: {
                                name: "general"
                            }
                        },
                        data: {
                            name,
                            type,
                        },
					},
				},
			},
		});

		// ✅ SECURITY: Log successful channel update
		console.log(`📢 [CHANNEL] Channel updated successfully by user: ${profile.email} (${profile.id})`);
		console.log(`📝 [CHANNEL] Channel ID: ${params.channelId}, Name: "${name}", Type: ${type}, Server: ${serverId}`);
		console.log(`📍 [CHANNEL] IP: ${req.headers.get('x-forwarded-for') || 'unknown'}`);

		return NextResponse.json(server);
	} catch (error: any) {
		console.error("❌ [CHANNEL] Channel update error:", error);
		trackSuspiciousActivity(req, 'CHANNEL_UPDATE_ERROR');
		
		// ✅ SECURITY: Generic error response - no internal details exposed
		return NextResponse.json({ 
			error: 'Channel update failed',
			message: 'Unable to update channel. Please try again later.'
		}, { status: 500 });
	}
}


export async function DELETE(req: NextRequest,{params}: {params: {channelId: string}}) {
	try {
		// ✅ SECURITY: Rate limiting for channel operations
		const rateLimitResult = await rateLimitServer()(req);
		if (!rateLimitResult.success) {
			trackSuspiciousActivity(req, 'CHANNEL_DELETE_RATE_LIMIT_EXCEEDED');
			return rateLimitResult.error;
		}

		// ✅ SECURITY: Validate channel ID parameter
		try {
			uuidSchema.parse(params.channelId);
		} catch (error) {
			trackSuspiciousActivity(req, 'INVALID_CHANNEL_ID_FORMAT_DELETE');
			return NextResponse.json({ error: 'Invalid channel ID format' }, { status: 400 });
		}

		const profile = await getCurrentProfile();
		const { searchParams } = new URL(req.url);
		const serverId = searchParams.get("serverId");

		// ✅ SECURITY: Validate server ID from query params
		if (!serverId) {
			trackSuspiciousActivity(req, 'MISSING_SERVER_ID_CHANNEL_DELETE');
			return NextResponse.json({ error: 'Server ID is required' }, { status: 400 });
		}

		try {
			uuidSchema.parse(serverId);
		} catch (error) {
			trackSuspiciousActivity(req, 'INVALID_SERVER_ID_FORMAT_CHANNEL_DELETE');
			return NextResponse.json({ error: 'Invalid server ID format' }, { status: 400 });
		}

		if (!profile) {
			trackSuspiciousActivity(req, 'UNAUTHENTICATED_CHANNEL_DELETE');
			return new NextResponse("Unauthorized", { status: 401 });
		}
		if(!params.channelId){
			trackSuspiciousActivity(req, 'MISSING_CHANNEL_ID_DELETE');
            return new NextResponse("Channel not found", { status: 404 });
        }

		const server = await prisma.server.update({
			where: {
				id: serverId,
				members: {
					some: {
						profileId: profile.id,
						role: {
							in: [MemberRole.ADMIN, MemberRole.MODERATOR],
						},
					},
				},
			},
			data: {
				channels: {
					delete: {
						id: params.channelId,
						name : {
                            not: "general"
                        },
					},
				},
			},
		});

		// ✅ SECURITY: Log successful channel deletion
		console.log(`🗑️ [CHANNEL] Channel deleted successfully by user: ${profile.email} (${profile.id})`);
		console.log(`📝 [CHANNEL] Deleted channel ID: ${params.channelId}, Server: ${serverId}`);
		console.log(`📍 [CHANNEL] IP: ${req.headers.get('x-forwarded-for') || 'unknown'}`);

		revalidatePath("/(main)", "layout");

		return NextResponse.json(server);
	} catch (error: any) {
		console.error("❌ [CHANNEL] Channel deletion error:", error);
		trackSuspiciousActivity(req, 'CHANNEL_DELETE_ERROR');
		
		// ✅ SECURITY: Generic error response - no internal details exposed
		return NextResponse.json({ 
			error: 'Channel deletion failed',
			message: 'Unable to delete channel. Please try again later.'
		}, { status: 500 });
	}
}
