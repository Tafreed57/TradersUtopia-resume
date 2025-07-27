// Login-triggered auto sync function
// async function performLoginSync(userEmail: string) {
//   try {
//     // Find all profiles with this email
//     const allProfiles = await prisma.profile.findMany({
//       where: { email: userEmail },
//       orderBy: { createdAt: 'desc' },
//     });

//     if (allProfiles.length <= 1) {
//       return;
//     }

//     // Check if there's an ACTIVE profile to sync from
//     const activeProfile = allProfiles.find(
//       p => p.subscriptionStatus === 'ACTIVE'
//     );
//     const freeProfiles = allProfiles.filter(
//       p => p.subscriptionStatus === 'FREE' && p.id !== activeProfile?.id
//     );

//     if (activeProfile && freeProfiles.length > 0) {
//       // Update all FREE profiles to match the ACTIVE one
//       for (const freeProfile of freeProfiles) {
//         await prisma.profile.update({
//           where: { id: freeProfile.id },
//           data: {
//             subscriptionStatus: activeProfile.subscriptionStatus,
//             subscriptionStart: activeProfile.subscriptionStart,
//             subscriptionEnd: activeProfile.subscriptionEnd,
//             stripeCustomerId: activeProfile.stripeCustomerId,
//             stripeSessionId: activeProfile.stripeSessionId,
//             stripeProductId: activeProfile.stripeProductId,
//           },
//         });
//       }
//     }
//   } catch (error) {
//     console.error(`❌ [Login Sync] Failed for ${userEmail}:`, error);
//   }
// }

// export async function getCurrentProfileForAuth() {
//   const { userId } = await auth();

//   if (!userId) {
//     throw new Error('Unauthorized');
//   }

//   const profile = await prisma.profile.findUnique({
//     where: {
//       userId,
//     },
//   });

//   if (!profile) {
//     throw new Error('Profile not found');
//   }

//   return profile;
// }

// ✅ PERFORMANCE: Use this for dashboard/server access that might need login sync
// export async function getCurrentProfileWithSync() {
//   try {
//     const user = await currentUser();
//     if (!user) return (await auth()).redirectToSignIn();

//     const userEmail = user.primaryEmailAddress?.emailAddress;
//     const name =
//       user?.fullName ||
//       user?.firstName ||
//       user?.lastName ||
//       user.primaryEmailAddress?.emailAddress.split('@')[0] ||
//       'unknown';

//     // First check if profile exists
//     const existingProfile = await prisma.profile.findUnique({
//       where: { userId: user.id },
//       select: {
//         id: true,
//         userId: true,
//         name: true,
//         email: true,
//         imageUrl: true,
//         createdAt: true,
//         updatedAt: true,
//         stripeCustomerId: true,
//         stripeSessionId: true,
//         subscriptionEnd: true,
//         subscriptionStart: true,
//         subscriptionStatus: true,
//         stripeProductId: true,
//         backupCodes: true,
//         isAdmin: true,
//         pushNotifications: true,
//         pushSubscriptions: true,
//       },
//     });

//     if (existingProfile) {
//       // Profile exists, only sync if it's the first access in a while (session-based)
//       const lastSync = new Date(existingProfile.updatedAt);
//       const timeSinceLastUpdate = Date.now() - lastSync.getTime();
//       const shouldSync = timeSinceLastUpdate > 24 * 60 * 60 * 1000; // 24 hours

//       if (userEmail && shouldSync) {
//         // Background sync for periodic cleanup
//         Promise.resolve()
//           .then(() => performLoginSync(userEmail))
//           .catch(error => {
//             console.error(`❌ [Login Sync] Background sync failed:`, error);
//           });
//       }

//       return existingProfile;
//     }

//     // Profile doesn't exist, create it and run sync
//     const profile = await prisma.profile.create({
//       data: {
//         userId: user.id,
//         email: userEmail as string,
//         name: name,
//         imageUrl: user?.imageUrl,
//       },
//     });

//     const server = await prisma.server.findFirstOrThrow({
//       where: {
//         name: 'TradersUtopia HQ',
//       },
//       select: {
//         id: true,
//       },
//     });

//     const member = await prisma.member.create({
//       data: {
//         profileId: profile.id,
//         serverId: server.id,
//         role: 'GUEST',
//       },
//     });

//     if (userEmail) {
//       // Run sync for new profiles
//       Promise.resolve()
//         .then(() => performLoginSync(userEmail))
//         .catch(error => {
//           console.error(`❌ [Login Sync] New profile sync failed:`, error);
//         });
//     }

//     return profile;
//   } catch (error) {
//     console.error('❌ [getCurrentProfileWithSync] Error:', error);

//     // Check if user is actually authenticated but there's just a temporary issue
//     try {
//       const { userId } = await auth();
//       if (userId) {
//         console.error(
//           '🔴 [Profile Error] User is authenticated but profile loading failed. This might be a temporary database issue.'
//         );
//         console.error(
//           '🔄 [Profile Error] Throwing error instead of redirecting to prevent homepage redirect loop'
//         );
//         throw error;
//       }
//     } catch (authError) {
//       console.error('❌ [Auth Error] User not authenticated:', authError);
//     }

//     // Only redirect to sign-in if user is actually not authenticated
//     return (await auth()).redirectToSignIn();
//   }
// }

// export async function getCurrentProfile() {
//   const { userId } = await auth();

//   if (!userId) {
//     return null;
//   }

//   const profile = await prisma.profile.findUnique({
//     where: {
//       userId,
//     },
//   });

//   return profile;
// }

// export async function getServer(serverId: string, profileId: string) {
//   const server = await prisma.server.findUnique({
//     where: {
//       id: serverId,
//       members: {
//         some: {
//           profileId,
//         },
//       },
//     },
//     include: {
//       channels: {
//         orderBy: {
//           position: 'asc',
//         },
//       },
//       sections: {
//         include: {
//           channels: {
//             orderBy: {
//               position: 'asc',
//             },
//           },
//           parent: true,
//           children: {
//             include: {
//               channels: {
//                 orderBy: {
//                   position: 'asc',
//                 },
//               },
//               children: {
//                 include: {
//                   channels: {
//                     orderBy: {
//                       position: 'asc',
//                     },
//                   },
//                 },
//               },
//             },
//             orderBy: {
//               position: 'asc',
//             },
//           },
//         },
//         orderBy: {
//           position: 'asc',
//         },
//       },
//       members: {
//         include: {
//           profile: true,
//         },
//         orderBy: {
//           role: 'asc',
//         },
//       },
//     },
//   });

//   return server;
// }

// export async function getGeneralServer(id: string, profileId: string) {
//   const server = await prisma.server.findUnique({
//     where: {
//       id,
//       members: {
//         some: {
//           profileId,
//         },
//       },
//     },
//     include: {
//       channels: {
//         where: {
//           name: 'general',
//         },
//         orderBy: {
//           createdAt: 'asc',
//         },
//       },
//     },
//   });
//   if (server?.channels[0]?.name !== 'general') return null;
//   if (server) return server;
// }

// export async function getAllServers(id: string) {
//   const servers = await prisma.server.findMany({
//     where: {
//       members: {
//         some: {
//           profileId: id,
//         },
//       },
//     },
//   });
//   if (servers) return servers;
// }

// async function getFirstServer(id: string) {
//   const server = await prisma.server.findFirst({
//     where: {
//       members: {
//         some: {
//           profileId: id,
//         },
//       },
//     },
//   });
//   if (server) return redirect(`/servers/${server.id}`);
// }

// export async function getMember(serverId: string, profileId: string) {
//   const member = await prisma.member.findFirst({
//     where: {
//       serverId,
//       profileId,
//     },
//     include: {
//       profile: true,
//     },
//   });

//   return member;
// }

// export async function getChannel(channelId: string) {
//   const channel = await prisma.channel.findUnique({
//     where: {
//       id: channelId,
//     },
//     include: {
//       section: true,
//     },
//   });

//   return channel;
// }

// export async function getAdminProfile(userId: string) {
//   const profile = await prisma.profile.findUnique({
//     where: {
//       userId,
//       isAdmin: true,
//     },
//   });
//   if (!profile) {
//     throw new Error('Profile not found or insufficient permissions');
//   }
//   return profile;
// }
