"use client";

import { useUser } from "@clerk/nextjs";
import {
    ControlBar,
    GridLayout,
    LiveKitRoom,
    ParticipantTile,
    RoomAudioRenderer,
    useTracks
} from "@livekit/components-react";
import "@livekit/components-styles";
import { Track } from "livekit-client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useLoading } from "@/contexts/loading-provider";

interface MediaRoomProps {
	serverId: string;
	chatId: string;
	video: boolean;
	audio: boolean;
}

export function MediaRoom({ serverId, chatId, video, audio }: MediaRoomProps) {
	const { user, isLoaded } = useUser();
	const router = useRouter();
	const [token, setToken] = useState("");
	const { startLoading, stopLoading } = useLoading();

	useEffect(() => {
		const name =
			user?.fullName ||
			user?.firstName ||
			user?.lastName ||
			user?.primaryEmailAddress?.emailAddress.split("@")[0];
		if (!name) return;
		
		startLoading("Connecting to voice channel...");
		
		(async () => {
			console.log("resp");
			try {
				const resp = await fetch(`/api/get-participant-token?room=${chatId}&username=${name}`);

				const data = await resp.json();
				setToken(data.token);
			} catch (e) {
				console.error(e);
			} finally {
				stopLoading();
			}
		})();
	}, [chatId, user?.firstName, user?.lastName, user?.fullName, user?.primaryEmailAddress?.emailAddress, startLoading, stopLoading]);

	if (token === "" || !isLoaded) {
		return null; // Loading is handled by LoadingProvider
	}

	return (
		<LiveKitRoom
			video={video}
			audio={audio}
			token={token}
			serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL}
			connect={true}
			onDisconnected={() => {
				router.push(`/servers/${serverId}`);
			}}
			// Use the default LiveKit theme for nice styles.
			data-lk-theme="default"
			className="flex flex-col flex-1 h-[80%]"
		>
			{/* Your custom component with basic video conferencing functionality. */}
			<MyVideoConference />
			{/* The RoomAudioRenderer takes care of room-wide audio for you. */}
			<RoomAudioRenderer />
			{/* Controls for the user to start/stop audio, video, and screen
      share tracks and to leave the room. */}
			<ControlBar />
		</LiveKitRoom>
	);
}

function MyVideoConference() {
	// `useTracks` returns all camera and screen share tracks. If a user
	// joins without a published camera track, a placeholder track is returned.
	const tracks = useTracks(
		[
			{ source: Track.Source.Camera, withPlaceholder: true },
			{ source: Track.Source.ScreenShare, withPlaceholder: false },
		],
		{ onlySubscribed: false }
	);
	return (
		<GridLayout tracks={tracks} >
			{/* The GridLayout accepts zero or one child. The child is used
      as a template to render all passed in tracks. */}
			<ParticipantTile />
		</GridLayout>
	);
}
