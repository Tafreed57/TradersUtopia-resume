import { ServerHeader } from "@/components/layout/server-header";
import { SideBarItem } from "@/components/layout/side-bar-item";
import { ServerChannel } from "@/components/server-channel";
import { ServerSearch } from "@/components/server-search";
import { ServerSection } from "@/components/server-section";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";

import { getCurrentProfile, getServer } from "@/lib/query";
import { ChannelType, MemberRole } from "@prisma/client";
import { Hash, Mic, ShieldAlert, ShieldCheck, Video, Home, Settings } from "lucide-react";
import { redirect } from "next/navigation";
import Link from "next/link";

interface ServerSideBarProps {
	serverId: string;
}

const iconMap = {
	[ChannelType.TEXT]: <Hash className="mr-2 h-4 w-4" />,
	[ChannelType.AUDIO]: <Mic className="mr-2 h-4 w-4" />,
	[ChannelType.VIDEO]: <Video className="mr-2 h-4 w-4" />,
};

const roleIconMap = {
	[MemberRole.GUEST]: null,
	[MemberRole.ADMIN]: <ShieldAlert className="text-rose-500 mr-2 h-4 w-4" />,
	[MemberRole.MODERATOR]: <ShieldCheck className="text-indigo-500 mr-2 h-4 w-4" />,
};

export async function ServerSideBar({ serverId }: ServerSideBarProps) {
	const profile = await getCurrentProfile();
	if (!profile) {
		return redirect("/");
	}

	const server = await getServer(serverId, profile.id);

	const textChannels = server?.channels.filter((channel) => channel.type === ChannelType.TEXT);
	const audioChannels = server?.channels.filter((channel) => channel.type === ChannelType.AUDIO);
	const videoChannels = server?.channels.filter((channel) => channel.type === ChannelType.VIDEO);

	if (!server) {
		return redirect("/");
	}

	const role = server?.members?.find((member) => member.profileId === profile.id)?.role;
	return (
		<div className="flex flex-col space-y-4 items-center h-full text-primary w-full dark:bg-[#2B2D31] bg-[#F2F3F5] ">
			<ServerHeader server={server} role={role} />
			<Separator className="h-[2px] bg-zinc-300 dark:bg-zinc-700 rounded-md w-10 mx-auto" />
			<ScrollArea className="flex-1 w-full px-3">
				<ServerSearch
					data={[
						{
							label: "Text Channels",
							type: "channel",
							data: textChannels?.map((channel) => ({
								icon: iconMap[channel.type],
								id: channel.id,
								name: channel.name,
							})),
						},
						{
							label: "Voice Channels",
							type: "channel",
							data: audioChannels?.map((channel) => ({
								icon: iconMap[channel.type],
								id: channel.id,
								name: channel.name,
							})),
						},
						{
							label: "Video Channels",
							type: "channel",
							data: videoChannels?.map((channel) => ({
								icon: iconMap[channel.type],
								id: channel.id,
								name: channel.name,
							})),
						},
					]}
				/>
				<Separator className=" bg-zinc-200 dark:bg-zinc-700 rounded-md my-2" />
				{!!textChannels?.length && (
					<div className="mb-2">
						<ServerSection
							sectionType="channels"
							channelType={ChannelType.TEXT}
							role={role}
							label="Text Channels"
						/>
						<div className="flex flex-col space-y-[2px]">
							{textChannels.map((channel) => (
								<ServerChannel key={channel.id} channel={channel} server={server} role={role} />
							))}
						</div>
					</div>
				)}
				{!!audioChannels?.length && (
					<div className="mb-2">
						<ServerSection
							sectionType="channels"
							channelType={ChannelType.AUDIO}
							role={role}
							label="Voice Channels"
						/>
						<div className="flex flex-col space-y-[2px]">
							{audioChannels.map((channel) => (
								<ServerChannel key={channel.id} channel={channel} server={server} role={role} />
							))}
						</div>
					</div>
				)}
				{!!videoChannels?.length && (
					<div className="mb-2">
						<ServerSection
							sectionType="channels"
							channelType={ChannelType.VIDEO}
							role={role}
							label="Video Channels"
						/>
						<div className="flex flex-col space-y-[2px]">
							{videoChannels.map((channel) => (
								<ServerChannel key={channel.id} channel={channel} server={server} role={role} />
							))}
						</div>
					</div>
				)}
			</ScrollArea>
			
			{/* Settings and Homepage Buttons */}
			<div className="pb-3 px-3 w-full space-y-2">
				{/* Settings Button */}
				<Link href="/dashboard">
					<Button 
						variant="ghost"
						className="w-full justify-start text-zinc-500 dark:text-zinc-400 hover:bg-zinc-700/10 dark:hover:bg-zinc-700/50 hover:text-zinc-600 dark:hover:text-zinc-300 transition"
					>
						<Settings className="h-4 w-4 mr-2" />
						Dashboard Settings
					</Button>
				</Link>
				
				{/* Homepage Button */}
				<Link href="/">
					<Button 
						variant="ghost" 
						className="w-full justify-start text-zinc-500 dark:text-zinc-400 hover:bg-zinc-700/10 dark:hover:bg-zinc-700/50 hover:text-zinc-600 dark:hover:text-zinc-300 transition"
					>
						<Home className="h-4 w-4 mr-2" />
						Back to Homepage
					</Button>
				</Link>
			</div>
		</div>
	);
}
