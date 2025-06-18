import { prisma } from "@/lib/prismadb";
import { auth, currentUser,getAuth } from "@clerk/nextjs/server";
import { NextApiRequest } from "next";
import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";

// Login-triggered auto sync function
async function performLoginSync(userEmail: string) {
	try {
		console.log(`🔄 [Login Sync] Checking sync for email: ${userEmail}`);
		
		// Find all profiles with this email
		const allProfiles = await prisma.profile.findMany({
			where: { email: userEmail },
			orderBy: { createdAt: 'desc' }
		});

		if (allProfiles.length <= 1) {
			console.log(`ℹ️ [Login Sync] Only ${allProfiles.length} profile(s) found for ${userEmail}, no sync needed`);
			return;
		}

		console.log(`🔍 [Login Sync] Found ${allProfiles.length} profiles for ${userEmail}`);
		
		// Check if there's an ACTIVE profile to sync from
		const activeProfile = allProfiles.find(p => p.subscriptionStatus === 'ACTIVE');
		const freeProfiles = allProfiles.filter(p => p.subscriptionStatus === 'FREE' && p.id !== activeProfile?.id);

		if (activeProfile && freeProfiles.length > 0) {
			console.log(`✨ [Login Sync] Syncing ${freeProfiles.length} FREE profile(s) from ACTIVE profile ${activeProfile.id}`);
			
			// Update all FREE profiles to match the ACTIVE one
			const updatePromises = freeProfiles.map(async (freeProfile) => {
				try {
					const updated = await prisma.profile.update({
						where: { id: freeProfile.id },
						data: {
							subscriptionStatus: 'ACTIVE',
							subscriptionStart: activeProfile.subscriptionStart,
							subscriptionEnd: activeProfile.subscriptionEnd,
							stripeCustomerId: activeProfile.stripeCustomerId,
							stripeSessionId: activeProfile.stripeSessionId,
						}
					});
					console.log(`   ✅ [Login Sync] Synced profile ${updated.id} (${updated.userId})`);
					return updated;
				} catch (error) {
					console.error(`   ❌ [Login Sync] Failed to sync profile ${freeProfile.id}:`, error);
					return null;
				}
			});

			await Promise.all(updatePromises);
			console.log(`🎉 [Login Sync] Successfully synced profiles for ${userEmail}`);
		} else {
			console.log(`ℹ️ [Login Sync] No sync needed for ${userEmail} - ${activeProfile ? 'no FREE profiles to sync' : 'no ACTIVE profile found'}`);
		}
	} catch (error) {
		console.error(`❌ [Login Sync] Error during sync for ${userEmail}:`, error);
		// Don't throw error - login should continue even if sync fails
	}
}

export async function initProfile() {
	noStore();
	const user = await currentUser();

	if (!user) return auth().redirectToSignIn();

	const userEmail = user.primaryEmailAddress?.emailAddress;

	const profile = await prisma.profile.findUnique({
		where: {
			userId: user.id,
		},
	});

	// If profile exists, trigger login sync in the background
	if (profile && userEmail) {
		// Run sync asynchronously without blocking login
		Promise.resolve().then(() => {
			performLoginSync(userEmail);
		}).catch((error) => {
			console.error(`❌ [Login Sync] Background sync failed for ${userEmail}:`, error);
		});
		return profile;
	}

	const name =
		user?.fullName ||
		user?.firstName ||
		user?.lastName ||
		user.primaryEmailAddress?.emailAddress.split("@")[0] ||
		"unknown";

	const newProfile = await prisma.profile.create({
		data: {
			userId: user.id,
			email: user.primaryEmailAddress?.emailAddress as string,
			name: name,
			imageUrl: user?.imageUrl,
		},
	});

	// For new profiles, also trigger sync in case there are other profiles with same email
	if (userEmail) {
		Promise.resolve().then(() => {
			performLoginSync(userEmail);
		}).catch((error) => {
			console.error(`❌ [Login Sync] Background sync failed for ${userEmail}:`, error);
		});
	}

	return newProfile;
}

export async function getCurrentProfile() {
	const user = await currentUser();
	if (!user) return auth().redirectToSignIn();

	const profile = await prisma.profile.findUnique({
		where: {
			userId: user.id,
		},
	});
	if (profile) return profile;
}

export async function getCurrentProfilePage(req: NextApiRequest) {
	const authInfo = await getAuth(req);
	if (!authInfo.sessionId) return auth().redirectToSignIn();

	const profile = await prisma.profile.findUnique({
		where: {
			userId: authInfo.userId as string,
		},
	});
	if (profile) return profile;
}

export async function getServer(id: string, profileId: string) {
	const server = await prisma.server.findUnique({
		where: {
			id,
			members: {
				some: {
					profileId,
				},
			},
		},
		include: {
			channels: {
				orderBy: {
					createdAt: "asc",
				},
			},
			members: {
				include: {
					profile: true,
				},
				orderBy: {
					role: "asc",
				},
			},
		},
	});
	if (server) return server;
}

export async function getGeneralServer(id: string, profileId: string) {
	const server = await prisma.server.findUnique({
		where: {
			id,
			members: {
				some: {
					profileId,
				},
			},
		},
		include: {
			channels: {
				where: {
					name: "general",
				},
				orderBy: {
					createdAt: "asc",
				},
			},
		},
	});
	if (server?.channels[0]?.name !== "general") return null;
	if (server) return server;
}

export async function getAllServers(id: string) {
	const servers = await prisma.server.findMany({
		where: {
			members: {
				some: {
					profileId: id,
				},
			},
		},
	});
	if (servers) return servers;
}

export async function getFirstServer(id: string) {
	const server = await prisma.server.findFirst({
		where: {
			members: {
				some: {
					profileId: id,
				},
			},
		},
	});
	if (server) return redirect(`/servers/${server.id}`);
}

export async function getServerByInviteCode(inviteCode: string, profileId: string) {
	const server = await prisma.server.findFirst({
		where: {
			inviteCode,
			members: {
				some: {
					profileId,
				},
			},
		},
	});
	return server;
}

export async function getMember(serverId: string, profileId: string) {
	const member = await prisma.member.findFirst({
		where: {
			serverId,
			profileId,
		},
	});
	if (member) return member;
}


export async function getChannel(channelId: string) {
	const channel = await prisma.channel.findUnique({
		where: {
			id: channelId,

		},
	});
	if (channel) return channel;
}

export 	async function getConversation(memberOneId: string, memberTwoId: string) {
	try {
		const conversation = await prisma.conversation.findFirst({
			where: {
				AND: [
					{
					memberOneId: memberOneId,
					},
					{
					memberTwoId: memberTwoId,
					},
				],
			},
			include: {
				memberOne : {
					include: {
						profile: true,
					},
				},
				memberTwo: {
					include: {
						profile: true,
					},
				},
				}
		});
		return conversation;
	} catch (error) {
		console.log(error);
		return null ;

	}
}


export async function createConversation(memberOneId: string, memberTwoId: string) {
	try {
		const conversation = await prisma.conversation.create({
			data: {
				memberOneId,
				memberTwoId,
			},
			include: {
				memberOne : {
					include: {
						profile: true,
					},
				},
				memberTwo: {
					include: {
						profile: true,
					},
				},
				}
		});
		return conversation;
	} catch (error) {
		console.log(error);
		return null;

	}
}

export async function getOrCreateConversation(memberOneId: string, memberTwoId: string) {
	if (!memberOneId || !memberTwoId) return ;
		const conversation =
			(await getConversation(memberOneId, memberTwoId)) || (await getConversation(memberTwoId, memberOneId));
	if (conversation) return conversation;
	const newConversation = await createConversation(memberOneId, memberTwoId);
	return newConversation;
}



export async function getCurrentMember(serverId: string, profileId: string) {
	const member = await prisma.member.findFirst({
		where: {
			serverId,
			profileId,
		},
		include: {
			profile: true,
		},
	});
	if (member) return member;
}
