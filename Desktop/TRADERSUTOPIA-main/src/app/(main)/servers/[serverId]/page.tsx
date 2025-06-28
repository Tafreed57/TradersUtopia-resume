import { getCurrentProfile, getGeneralServer, getServer } from "@/lib/query";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

interface ServerIdPageProps {
	params: {
		serverId: string;
	};
}

export default async function ServerIdPage({ params }: ServerIdPageProps) {
	const profile = await getCurrentProfile();
	if (!profile) {
		return auth().redirectToSignIn();
	}

	console.log(`🔍 [SERVER-PAGE] Attempting to access server: ${params.serverId}`);

	// First try to get the general server
	const generalServer = await getGeneralServer(params.serverId, profile.id);

	if (generalServer && generalServer.channels?.[0]?.id) {
		console.log(`✅ [SERVER-PAGE] Redirecting to general channel: ${generalServer.channels[0].id}`);
		redirect(`/servers/${params.serverId}/channels/${generalServer.channels[0].id}`);
	}

	// If no general server, try to get any server to check if user is a member
	const server = await getServer(params.serverId, profile.id);

	if (server && server.channels?.[0]?.id) {
		console.log(`✅ [SERVER-PAGE] Redirecting to first available channel: ${server.channels[0].id}`);
		redirect(`/servers/${params.serverId}/channels/${server.channels[0].id}`);
	}

	// If server doesn't exist or user is not a member, redirect to dashboard
	console.log(`❌ [SERVER-PAGE] Server not found or user not a member: ${params.serverId}`);
	redirect("/dashboard");
}
