import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggler";
import Link from "next/link";
import Image from "next/image";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { SimplePricingButtons } from "@/components/simple-pricing-buttons";
import { AuthHeader } from "@/components/auth-header";
import { EnhancedTrialButton } from "@/components/enhanced-trial-button";
import { SubscriptionProtectedLink } from "@/components/subscription-protected-link";
import { Sparkles, CheckCircle, Crown, Users, TrendingUp, Shield, Home } from "lucide-react";

export default function PricingPage() {
	return (
		<div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-black text-white relative overflow-hidden">
			{/* Animated Background Effects */}
			<div className="absolute inset-0 overflow-hidden">
				<div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/8 rounded-full blur-3xl animate-pulse"></div>
				<div className="absolute top-60 -left-40 w-96 h-96 bg-purple-500/6 rounded-full blur-3xl animate-pulse delay-1000"></div>
				<div className="absolute bottom-40 right-20 w-64 h-64 bg-yellow-500/8 rounded-full blur-3xl animate-pulse delay-2000"></div>
				<div className="absolute top-20 left-1/2 w-72 h-72 bg-green-500/5 rounded-full blur-3xl animate-pulse delay-3000"></div>
				<div className="absolute bottom-20 left-1/4 w-56 h-56 bg-pink-500/6 rounded-full blur-3xl animate-pulse delay-4000"></div>
			</div>

			<div className="relative z-10">
				{/* Enhanced Promotional Banner */}
				<div className="bg-gradient-to-r from-purple-600/20 via-indigo-600/20 to-purple-700/20 backdrop-blur-xl border-b border-purple-400/20 text-white text-center py-4 px-4">
					<div className="flex items-center justify-center gap-3 text-sm md:text-base font-semibold">
						<div className="w-8 h-8 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center animate-pulse">
							<Sparkles className="w-4 h-4 text-black" />
						</div>
						<span className="bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent font-bold">
							PRICE INCREASING AGAIN
						</span>
						<span className="text-yellow-300 animate-pulse">Time's up!</span>
					</div>
				</div>

				{/* Enhanced Header */}
				<header className="flex items-center justify-between p-6 max-w-7xl mx-auto bg-gradient-to-r from-gray-800/60 via-gray-800/40 to-gray-900/60 backdrop-blur-xl rounded-2xl border border-gray-700/30 mx-6 mt-6 shadow-2xl">
					<div className="flex items-center gap-6">
						{/* Enhanced Logo */}
						<div className="flex items-center gap-4">
							<div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-xl flex items-center justify-center shadow-lg">
								<Image src="/logo.png" alt="TradersUtopia" width={24} height={24} />
							</div>
							<div>
								<span className="text-white text-xl font-bold">TradersUtopia</span>
								<p className="text-gray-400 text-sm">Premium Trading Signals</p>
							</div>
						</div>
						
						{/* Authentication Section */}
						<div className="hidden md:block">
							<AuthHeader />
						</div>
					</div>
					<div className="flex items-center gap-4">
						<Link href="/">
							<Button variant="ghost" className="text-white hover:bg-white/10 bg-gray-700/30 backdrop-blur-sm border border-gray-600/30">
								<Home className="w-4 h-4 mr-2" />
								Homepage
							</Button>
						</Link>
						<SubscriptionProtectedLink 
							href="/dashboard"
							variant="ghost"
							className="text-white hover:bg-white/10 bg-gray-700/30 backdrop-blur-sm border border-gray-600/30"
						>
							<Crown className="w-4 h-4 mr-2" />
							Access Platform
						</SubscriptionProtectedLink>
						<ModeToggle />
					</div>
				</header>

				{/* Enhanced Main Content */}
				<main className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] px-6 py-16">
					{/* Hero Section */}
					<div className="text-center max-w-6xl mx-auto mb-16">
						<div className="flex items-center justify-center mb-6">
							<div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-2xl">
								<TrendingUp className="w-8 h-8 text-white" />
							</div>
						</div>
						
						<h1 className="text-4xl md:text-7xl font-bold mb-8 leading-tight">
							Join{" "}
							<span className="bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
								Traders Utopia
							</span>
						</h1>
						
						<p className="text-xl md:text-2xl text-gray-300 mb-8 max-w-4xl mx-auto leading-relaxed">
							Shehroze Trade Alerts and Education - Professional Trading Community
						</p>

						<div className="flex items-center justify-center gap-8 text-gray-400 text-sm">
							<div className="flex items-center gap-2">
								<Users className="w-4 h-4" />
								<span>5000+ Active Traders</span>
							</div>
							<div className="flex items-center gap-2">
								<Shield className="w-4 h-4" />
								<span>Proven Track Record</span>
							</div>
							<div className="flex items-center gap-2">
								<TrendingUp className="w-4 h-4" />
								<span>Real-Time Alerts</span>
							</div>
						</div>
					</div>

					{/* Enhanced Pricing Card */}
					<div className="bg-gradient-to-br from-gray-800/80 via-gray-800/60 to-gray-900/80 backdrop-blur-md rounded-3xl p-10 max-w-4xl w-full border border-gray-600/30 shadow-2xl hover:shadow-3xl transition-all duration-500 hover:border-yellow-400/50">
						{/* Card Header */}
						<div className="text-center mb-12">
							<div className="flex items-center justify-center mb-6">
								<div className="w-20 h-20 bg-gradient-to-br from-yellow-400 via-yellow-500 to-orange-500 rounded-2xl flex items-center justify-center shadow-2xl">
									<Crown className="w-10 h-10 text-black" />
								</div>
							</div>
							
							<h2 className="text-3xl md:text-4xl font-bold mb-6">
								<span className="bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
									🌟 Premium Trading Alerts
								</span>
							</h2>
							
							<div className="text-5xl md:text-6xl font-bold mb-4">
								<span className="bg-gradient-to-r from-white to-gray-200 bg-clip-text text-transparent">
									$149.99
								</span>
								<span className="text-xl text-gray-400 font-normal">/month</span>
							</div>
							
							<div className="inline-flex items-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-3 rounded-full">
								<CheckCircle className="w-5 h-5" />
								<span className="font-semibold">14 day free trial</span>
							</div>
						</div>

						{/* Enhanced Features List */}
						<div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
							<div className="space-y-6">
								<div className="flex items-start gap-4 p-6 bg-gradient-to-r from-blue-600/20 to-blue-700/20 rounded-2xl border border-blue-400/30 hover:border-blue-400/50 transition-all duration-300 hover:shadow-lg hover:shadow-blue-400/20">
									<div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
										<span className="text-2xl">📈</span>
									</div>
									<div>
										<p className="text-white font-semibold text-lg mb-2">Real-Time Swing Trade Alerts</p>
										<p className="text-blue-200 text-sm">Only high-probability setups, no spam</p>
									</div>
								</div>

								<div className="flex items-start gap-4 p-6 bg-gradient-to-r from-purple-600/20 to-purple-700/20 rounded-2xl border border-purple-400/30 hover:border-purple-400/50 transition-all duration-300 hover:shadow-lg hover:shadow-purple-400/20">
									<div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
										<span className="text-2xl">💎</span>
									</div>
									<div>
										<p className="text-white font-semibold text-lg mb-2">Bonus Investing Alerts</p>
										<p className="text-purple-200 text-sm">Targeting 30–50%+ returns with long-term plays</p>
									</div>
								</div>

								<div className="flex items-start gap-4 p-6 bg-gradient-to-r from-green-600/20 to-green-700/20 rounded-2xl border border-green-400/30 hover:border-green-400/50 transition-all duration-300 hover:shadow-lg hover:shadow-green-400/20">
									<div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
										<span className="text-2xl">🎙️</span>
									</div>
									<div>
										<p className="text-white font-semibold text-lg mb-2">Live Daily Classes</p>
										<p className="text-green-200 text-sm">Monday to Friday, 9:00–9:30 PM EST, hosted in live voice chat sessions</p>
									</div>
								</div>
							</div>

							<div className="space-y-6">
								<div className="flex items-start gap-4 p-6 bg-gradient-to-r from-orange-600/20 to-orange-700/20 rounded-2xl border border-orange-400/30 hover:border-orange-400/50 transition-all duration-300 hover:shadow-lg hover:shadow-orange-400/20">
									<div className="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
										<span className="text-2xl">🔒</span>
									</div>
									<div>
										<p className="text-white font-semibold text-lg mb-2">Private Access Channels</p>
										<p className="text-orange-200 text-sm">Get alerts and insights that free members can't see</p>
									</div>
								</div>

								<div className="flex items-start gap-4 p-6 bg-gradient-to-r from-teal-600/20 to-teal-700/20 rounded-2xl border border-teal-400/30 hover:border-teal-400/50 transition-all duration-300 hover:shadow-lg hover:shadow-teal-400/20">
									<div className="w-12 h-12 bg-teal-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
										<span className="text-2xl">🤝</span>
									</div>
									<div>
										<p className="text-white font-semibold text-lg mb-2">Supportive Network</p>
										<p className="text-teal-200 text-sm">Learn from experienced traders and level up faster</p>
									</div>
								</div>

								<div className="flex items-start gap-4 p-6 bg-gradient-to-r from-indigo-600/20 to-indigo-700/20 rounded-2xl border border-indigo-400/30 hover:border-indigo-400/50 transition-all duration-300 hover:shadow-lg hover:shadow-indigo-400/20">
									<div className="w-12 h-12 bg-indigo-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
										<span className="text-2xl">🌐</span>
									</div>
									<div>
										<p className="text-white font-semibold text-lg mb-2">Community Only Resources</p>
										<p className="text-indigo-200 text-sm">Exclusive tools, discussions, and education</p>
									</div>
								</div>
							</div>
						</div>

						{/* Enhanced Action Buttons */}
						<div className="bg-gradient-to-r from-gray-800/60 to-gray-900/60 rounded-2xl p-8 border border-gray-600/30">
							<SignedIn>
								<SimplePricingButtons />
							</SignedIn>
							<SignedOut>
								<div className="space-y-6">
									<EnhancedTrialButton isSignedIn={false}>
										Start 14-Day Free Trial - $149.99/month
									</EnhancedTrialButton>
									
									<div className="text-center">
										<p className="text-gray-400 text-sm flex items-center justify-center gap-2">
											<CheckCircle className="w-4 h-4 text-green-400" />
											14-day free trial • Cancel anytime
										</p>
									</div>
								</div>
							</SignedOut>
						</div>
					</div>

					{/* Enhanced Platform Access Section */}
					<div className="mt-16 text-center bg-gradient-to-r from-gray-800/40 to-gray-900/40 backdrop-blur-md rounded-2xl p-8 border border-gray-600/30 max-w-2xl w-full">
						<p className="text-gray-300 mb-6 text-lg">Already a member?</p>
						<SubscriptionProtectedLink 
							href="/dashboard"
							className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 border-0 text-white px-8 py-4 text-lg rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
						>
							<Crown className="w-5 h-5 mr-2" />
							Access Trading Platform
						</SubscriptionProtectedLink>
					</div>
				</main>
			</div>
		</div>
	);
} 