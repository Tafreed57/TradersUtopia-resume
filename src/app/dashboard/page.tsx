import { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import { DiscordProfile } from "@/components/user/discord-profile";
import { ModeToggle } from "@/components/mode-toggler";
import { TwoFactorAuth } from "@/components/security/two-factor-auth";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { SubscriptionManager } from "@/components/subscription/subscription-manager";
import { initProfile, getAllServers } from "@/lib/query";
import { redirect } from "next/navigation";
import { ProductPaymentGate } from "@/components/product-payment-gate";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, User, Settings, MessageSquare, Crown, Users } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AdminButton } from "@/components/admin-button";
import { AutoJoinDefault } from "@/components/auto-join-default";

export default async function Dashboard() {
	const profile = await initProfile();
	console.log(profile);

	// Get user's servers but don't redirect - let them choose what to do
	const servers = await getAllServers(profile.id);

	// Configure which Stripe products are allowed for dashboard access
	const allowedProductIds = [
		"prod_SWIyAf2tfVrJao", // Your current product ID
		// Add more product IDs here as you create them
	];

	return (
		<ProductPaymentGate 
			allowedProductIds={allowedProductIds}
			productName="Premium Dashboard Access"
			upgradeUrl="https://buy.stripe.com/test_28E6oG8nd5Bm3N1esU4Ja01"
			features={[
				"Exclusive dashboard access",
				"Advanced server management",
				"Premium support",
				"Priority features"
			]}
		>
			<main className="max-w-[75rem] w-full mx-auto p-6">
				<header className="flex items-center justify-between w-full h-16 gap-4 mb-8">
					<div className="flex gap-4">
						<ModeToggle />
					</div>
					<div className="flex items-center gap-2">
						<NotificationBell />
						<UserButton
							afterSignOutUrl="/"
							appearance={{
								elements: {
									userButtonAvatarBox: "size-6",
								},
							}}
						/>
					</div>
				</header>

				{/* Auto-join to default server */}
				{/* DISABLED: This was causing automatic redirects and misdirection issues */}
				{/* <AutoJoinDefault /> */}

				{/* Admin Controls - Testing Only */}
				<Card className="mb-6 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border-red-200 dark:border-red-800">
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-red-800 dark:text-red-200">
							<Crown className="h-5 w-5" />
							Admin Controls (Testing)
						</CardTitle>
						<CardDescription className="text-red-600 dark:text-red-300">
							For testing purposes only - Grant yourself admin privileges
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-red-700 dark:text-red-200">
									Current Role: <span className="font-semibold">{profile.isAdmin ? "Admin" : "Regular User"}</span>
								</p>
								<p className="text-xs text-red-600 dark:text-red-300 mt-1">
									{profile.isAdmin 
										? "You have admin access - you can send messages, create servers, and manage channels"
										: "You have read-only access - click below to gain admin privileges"
									}
								</p>
							</div>
							<AdminButton isAdmin={profile.isAdmin} />
						</div>
					</CardContent>
				</Card>

				{/* Servers Section */}
				<Card className="mb-6">
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Users className="h-5 w-5" />
							Traders Utopia Community
						</CardTitle>
						<CardDescription>
							{profile.isAdmin 
								? "You have admin access - manage the community server"
								: "You have read-only access - view the community discussions"
							}
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
							{servers.map((server) => (
								<Link key={server.id} href={`/servers/${server.id}`}>
									<Button variant="outline" className="w-full h-16 justify-start">
										{server.imageUrl ? (
											<img 
												src={server.imageUrl} 
												alt={server.name}
												className="w-8 h-8 rounded-full mr-3"
											/>
										) : (
											<div className="w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold mr-3">
												{server.name.charAt(0).toUpperCase()}
											</div>
										)}
										<div className="flex flex-col items-start">
											<span className="truncate font-semibold">{server.name}</span>
											<span className="text-xs text-gray-500">
												{profile.isAdmin ? "Admin Access" : "Read Only"}
											</span>
										</div>
									</Button>
								</Link>
							))}
						</div>
						
						{servers.length === 0 && (
							<div className="text-center py-8 text-gray-500">
								<Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
								<p>Setting up your community server...</p>
								<p className="text-sm">You'll be automatically joined to Traders Utopia</p>
							</div>
						)}
					</CardContent>
				</Card>

				<Tabs defaultValue="profile" className="w-full">
					<TabsList className="grid w-full grid-cols-3">
						<TabsTrigger value="profile" className="flex items-center gap-2">
							<User className="h-4 w-4" />
							Profile
						</TabsTrigger>
						<TabsTrigger value="security" className="flex items-center gap-2">
							<Shield className="h-4 w-4" />
							Security
						</TabsTrigger>
						<TabsTrigger value="settings" className="flex items-center gap-2">
							<Settings className="h-4 w-4" />
							Settings
						</TabsTrigger>
					</TabsList>

					<TabsContent value="profile" className="mt-6">
						<DiscordProfile />
					</TabsContent>

					<TabsContent value="security" className="mt-6">
						<div className="grid gap-6">
							<Card>
								<CardHeader>
									<CardTitle>Account Security</CardTitle>
									<CardDescription>
										Manage your account security settings and two-factor authentication
									</CardDescription>
								</CardHeader>
								<CardContent>
									{console.log('Dashboard passing twoFactorEnabled:', profile.twoFactorEnabled)}
									<TwoFactorAuth initialTwoFactorEnabled={profile.twoFactorEnabled} />
								</CardContent>
							</Card>
						</div>
					</TabsContent>

					<TabsContent value="settings" className="mt-6">
						<div className="grid gap-6">
							{/* Subscription Management */}
							<SubscriptionManager />
							
							{/* General Settings */}
							<Card>
								<CardHeader>
									<CardTitle>General Settings</CardTitle>
									<CardDescription>
										Customize your experience and preferences
									</CardDescription>
								</CardHeader>
								<CardContent>
									<div className="space-y-4">
										<div className="flex items-center justify-between">
											<div>
												<h4 className="font-medium">Theme</h4>
												<p className="text-sm text-gray-600 dark:text-gray-300">
													Toggle between light and dark mode
												</p>
											</div>
											<ModeToggle />
										</div>
										<div className="flex items-center justify-between">
											<div>
												<h4 className="font-medium">Notifications</h4>
												<p className="text-sm text-gray-600 dark:text-gray-300">
													Manage your notification preferences
												</p>
											</div>
											<NotificationBell />
										</div>
									</div>
								</CardContent>
							</Card>
						</div>
					</TabsContent>
				</Tabs>
			</main>
		</ProductPaymentGate>
	);
} 